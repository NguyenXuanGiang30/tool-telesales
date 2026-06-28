from __future__ import annotations

from dataclasses import dataclass, field

from backend.gateway.models import CommandName, DeviceEventType, DeviceHealth
from backend.gateway.audio_protocol import AudioDirection, AudioPacket


@dataclass
class S9Simulator:
    device_id: str
    ip_address: str
    audio_port: int
    app_version: str = "sim-1.0.0"
    connected: bool = False
    active_call_id: str | None = None
    events: list[dict] = field(default_factory=list)

    def register_event(self) -> dict:
        self.connected = True
        event = {
            "type": "event",
            "event": DeviceEventType.REGISTERED.value,
            "device_id": self.device_id,
            "payload": {
                "ip_address": self.ip_address,
                "app_version": self.app_version,
                "audio_port": self.audio_port,
            },
        }
        self.events.append(event)
        return event

    def heartbeat_event(self) -> dict:
        event = {
            "type": "event",
            "event": DeviceEventType.HEARTBEAT.value,
            "device_id": self.device_id,
            "payload": {},
        }
        self.events.append(event)
        return event

    def health_event(self, health: DeviceHealth) -> dict:
        event = {
            "type": "event",
            "event": DeviceEventType.HEALTH.value,
            "device_id": self.device_id,
            "payload": {
                "battery_percent": health.battery_percent,
                "temperature_c": health.temperature_c,
                "signal_dbm": health.signal_dbm,
                "charging": health.charging,
                "network_type": health.network_type,
                "storage_free_mb": health.storage_free_mb,
            },
        }
        self.events.append(event)
        return event

    def ack_command(self, command: dict) -> dict:
        command_name = command.get("command")
        if command_name not in {item.value for item in CommandName}:
            return {
                "command_id": command["command_id"],
                "status": "nacked",
                "error": f"unsupported_command:{command_name}",
            }
        return {
            "command_id": command["command_id"],
            "status": "acked",
            "error": None,
        }

    def handle_command(self, command: dict) -> dict:
        command_name = command.get("command")
        if command_name == CommandName.DIAL.value:
            call_id = str(command["call_id"])
            self.active_call_id = call_id
            event = {
                "type": "event",
                "event": DeviceEventType.RINGING.value,
                "device_id": self.device_id,
                "call_id": call_id,
                "payload": {
                    "phone_number": command.get("payload", {}).get("phone_number"),
                },
            }
            self.events.append(event)
            return event
        if command_name == CommandName.HANGUP.value:
            call_id = command.get("call_id") or self.active_call_id
            self.active_call_id = None
            event = {
                "type": "event",
                "event": DeviceEventType.DISCONNECTED.value,
                "device_id": self.device_id,
                "call_id": call_id,
                "payload": {"reason": "hangup_command"},
            }
            self.events.append(event)
            return event
        event = {
            "type": "event",
            "event": DeviceEventType.ERROR.value,
            "device_id": self.device_id,
            "call_id": command.get("call_id"),
            "payload": {"reason": f"unsupported_command:{command_name}"},
        }
        self.events.append(event)
        return event

    def connected_event(self, call_id: str) -> dict:
        self.active_call_id = call_id
        event = {
            "type": "event",
            "event": DeviceEventType.CONNECTED.value,
            "device_id": self.device_id,
            "call_id": call_id,
            "payload": {},
        }
        self.events.append(event)
        return event

    def disconnected_event(self, call_id: str, reason: str = "normal") -> dict:
        self.active_call_id = None
        event = {
            "type": "event",
            "event": DeviceEventType.DISCONNECTED.value,
            "device_id": self.device_id,
            "call_id": call_id,
            "payload": {"reason": reason},
        }
        self.events.append(event)
        return event

    def customer_text_packet(
        self,
        call_id: str,
        text: str,
        sequence_number: int = 1,
        timestamp_ms: int = 20,
        sample_rate: int = 16000,
        channels: int = 1,
    ) -> AudioPacket:
        payload = f"TEXT:{text}".encode("utf-8")
        return AudioPacket(
            direction=AudioDirection.CUSTOMER_TO_AI,
            call_id=call_id,
            device_id=self.device_id,
            sequence_number=sequence_number,
            timestamp_ms=timestamp_ms,
            sample_rate=sample_rate,
            channels=channels,
            payload=payload,
        )
