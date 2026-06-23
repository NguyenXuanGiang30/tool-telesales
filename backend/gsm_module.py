import threading
import time
import queue
import re
from dataclasses import dataclass, field
from typing import Optional, Callable

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    serial = None
    list_ports = None

def escape_inner_at(command: str) -> str:
    return command.replace("\\", "\\\\").replace('"', '\\"')

def is_unsolicited(token: str) -> bool:
    token = token.strip()
    if not token:
        return False
    prefixes = (
        "RING",
        "NO CARRIER",
        "BUSY",
        "NO ANSWER",
        "+CMTI:",
        "+CLIP:",
        "+CRING:",
        "+PDP DEACT",
        "NORMAL POWER DOWN",
    )
    return token.startswith(prefixes)

def command_lines_to_text(lines: list[str]) -> str:
    return "\n".join(line for line in lines if line is not None)

@dataclass
class CommandResult:
    command: str
    ok: bool
    lines: list[str] = field(default_factory=list)
    timed_out: bool = False
    prompt_seen: bool = False
    error: str = ""

    @property
    def text(self) -> str:
        return command_lines_to_text(self.lines)

class ModernGsmModem:
    def __init__(self, port: str = "", baudrate: int = 115200, wrapper_template: str = 'AT+CSIM={slot},"{command}"', multiplex: bool = True) -> None:
        self.port = port
        self.baudrate = baudrate
        self.wrapper_template = wrapper_template
        self.multiplex = multiplex
        self.serial: Optional[serial.Serial] = None if serial else None
        self._running = threading.Event()
        self._reader_thread: Optional[threading.Thread] = None
        self._rx_queue: queue.Queue = queue.Queue()
        self._command_lock = threading.Lock()
        self._event_callback: Optional[Callable[[str], None]] = None
        self._trace_callback: Optional[Callable[[str, str], None]] = None

    def is_connected(self) -> bool:
        return bool(self.serial and self.serial.is_open)

    def connect(self, port: str, baudrate: int, wrapper_template: str = 'AT+CSIM={slot},"{command}"', multiplex: bool = True) -> dict:
        self.disconnect()
        if serial is None:
            raise RuntimeError("Thiếu pyserial. Cài: pip install pyserial")
        self.port = port
        self.baudrate = baudrate
        self.wrapper_template = wrapper_template
        self.multiplex = multiplex
        self.serial = serial.Serial(port=self.port, baudrate=self.baudrate, timeout=0.1, write_timeout=2)
        self.serial.reset_input_buffer()
        self.serial.reset_output_buffer()
        self._running.set()
        self._reader_thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._reader_thread.start()
        
        ping = self.execute("AT", timeout=3, success_markers=("OK",))
        if not ping.ok:
            self.disconnect()
            raise RuntimeError("Modem không trả lời AT.")
        self.execute("ATE0", timeout=3, success_markers=("OK",))
        return self.get_device_info()

    def disconnect(self) -> None:
        self._running.clear()
        if self._reader_thread and self._reader_thread.is_alive():
            self._reader_thread.join(timeout=1.0)
        self._reader_thread = None
        if self.serial and self.serial.is_open:
            try:
                self.serial.close()
            except Exception:
                pass
        self.serial = None

    def wrap_command(self, slot_id: Optional[int], command: str) -> str:
        if slot_id is None or not self.multiplex:
            return command
        inner = escape_inner_at(command)
        return self.wrapper_template.format(slot=slot_id, command=inner)

    def _reader_loop(self) -> None:
        buffer = ""
        while self._running.is_set() and self.serial and self.serial.is_open:
            try:
                waiting = self.serial.in_waiting
                chunk = self.serial.read(waiting or 1)
            except Exception:
                break
            if not chunk:
                continue
            buffer += chunk.decode("latin-1", errors="ignore")
            buffer = self._consume_buffer(buffer)

    def _consume_buffer(self, buffer: str) -> str:
        current: list[str] = []
        i = 0
        while i < len(buffer):
            ch = buffer[i]
            if ch in "\r\n":
                token = "".join(current).strip()
                if token:
                    self._push_token(token)
                current = []
                i += 1
                while i < len(buffer) and buffer[i] in "\r\n":
                    i += 1
                continue
            if ch == ">":
                token = "".join(current).strip()
                if token:
                    self._push_token(token)
                current = []
                self._push_token(">")
                i += 1
                if i < len(buffer) and buffer[i] == " ":
                    i += 1
                continue
            current.append(ch)
            i += 1
        return "".join(current)

    def _push_token(self, token: str) -> None:
        token = token.strip()
        if not token:
            return
        self._rx_queue.put(token)
        if self._event_callback and is_unsolicited(token):
            try:
                self._event_callback(token)
            except Exception:
                pass

    def _drain_rx_queue(self) -> None:
        while True:
            try:
                self._rx_queue.get_nowait()
            except queue.Empty:
                break

    def _write(self, payload: bytes) -> None:
        if not self.serial or not self.serial.is_open:
            raise RuntimeError("Modem chưa kết nối.")
        self.serial.write(payload)
        self.serial.flush()

    @staticmethod
    def _matches(token: str, marker: str) -> bool:
        token = token.strip()
        marker = marker.strip()
        if not marker:
            return False
        return token == marker or token.startswith(marker)

    def execute(
        self,
        command: str,
        slot_id: Optional[int] = None,
        timeout: float = 3.0,
        success_markers: tuple[str, ...] = ("OK",),
        terminal_markers: tuple[str, ...] = ("ERROR", "+CME ERROR", "+CMS ERROR"),
        expect_prompt: bool = False,
        payload: bytes | str | None = None,
        prompt_timeout: float = 15.0,
    ) -> CommandResult:
        if not self.is_connected():
            return CommandResult(command=command, ok=False, error="Chưa kết nối modem")

        wire_command = self.wrap_command(slot_id, command)
        with self._command_lock:
            self._drain_rx_queue()
            try:
                self._write((wire_command + "\r").encode("utf-8"))
            except Exception as exc:
                return CommandResult(command=command, ok=False, error=str(exc))

            lines: list[str] = []
            prompt_seen = False
            payload_sent = False
            deadline = time.monotonic() + timeout

            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return CommandResult(command=command, ok=False, lines=lines, timed_out=True, prompt_seen=prompt_seen, error="Hết thời gian chờ phản hồi")

                try:
                    token = self._rx_queue.get(timeout=min(0.2, remaining))
                except queue.Empty:
                    continue

                if not token or token in {command, wire_command}:
                    continue

                lines.append(token)

                if expect_prompt and token == ">":
                    prompt_seen = True
                    if payload is None:
                        return CommandResult(command=command, ok=True, lines=lines, prompt_seen=True)
                    try:
                        data = payload if isinstance(payload, bytes) else payload.encode("utf-8")
                        self._write(data)
                        payload_sent = True
                        deadline = time.monotonic() + prompt_timeout
                    except Exception as exc:
                        return CommandResult(command=command, ok=False, lines=lines, prompt_seen=True, error=str(exc))
                    continue

                if any(self._matches(token, marker) for marker in terminal_markers):
                    return CommandResult(command=command, ok=False, lines=lines, error=token)

                if payload_sent or not expect_prompt:
                    if any(self._matches(token, marker) for marker in success_markers):
                        return CommandResult(command=command, ok=True, lines=lines, prompt_seen=prompt_seen)

    def get_device_info(self) -> dict:
        info = {"model": "", "firmware": "", "imei": "", "imsi": ""}
        for command, key, slot, timeout in (
            ("ATI", "model", None, 3),
            ("AT+CGMR", "firmware", None, 3),
            ("AT+GSN", "imei", None, 3),
            ("AT+CIMI", "imsi", 0 if self.multiplex else None, 3),
        ):
            result = self.execute(command, slot_id=slot, timeout=timeout, success_markers=("OK",))
            if result.ok:
                parts = [line for line in result.lines if line not in {command, "OK"}]
                info[key] = " | ".join(parts).strip()
        return info

