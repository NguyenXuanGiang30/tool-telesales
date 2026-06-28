# Gateway Command Plane and Simulator Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-grade Gateway command queue so Android Agent or simulator devices can poll commands, ACK/NACK them, and receive `DIAL` commands when calls are allocated.

**Architecture:** Keep command lifecycle state in a focused in-memory `DeviceCommandQueue` that mirrors the current in-memory registry/session architecture. Wire it into `CallRouter` so call allocation enqueues a `DIAL` command, and expose small REST endpoints for Android Agent polling and ACK/NACK. Extend the S9 simulator with command handling helpers so end-to-end command flow can be verified without hardware.

**Tech Stack:** Python dataclasses, FastAPI, pytest, existing Gateway models/router/API/simulator patterns.

---

## File Structure

- `backend/gateway/command_queue.py`
  - Owns `CommandStatus`, `DeviceCommand`, `DeviceCommandQueue`.
  - Handles enqueue, delivery, ACK, NACK, expiry, history.

- `backend/gateway/router.py`
  - Accepts optional `DeviceCommandQueue`.
  - Enqueues `DIAL` after a device is allocated.

- `backend/gateway/api.py`
  - Creates the global `command_queue`.
  - Adds command polling, ACK/NACK, and history endpoints.
  - Passes the queue into `CallRouter`.

- `backend/gateway/simulators/s9_simulator.py`
  - Adds simulator helpers for command ACK payloads and state events driven by commands.

- `backend/tests/gateway/test_command_queue.py`
  - Unit tests for command lifecycle.

- `backend/tests/gateway/test_router.py`
  - Adds assertions that allocation enqueues `DIAL`.

- `backend/tests/gateway/test_api.py`
  - Adds API command polling and ACK/NACK tests.

- `backend/tests/gateway/test_s9_simulator.py`
  - Adds simulator command-flow tests.

---

## Task 1: Command Queue Domain Model

**Files:**

- Create: `backend/gateway/command_queue.py`
- Test: `backend/tests/gateway/test_command_queue.py`

- [ ] **Step 1: Write failing command queue tests**

Create `backend/tests/gateway/test_command_queue.py`:

```python
from datetime import timedelta

from backend.gateway.command_queue import CommandStatus, DeviceCommandQueue
from backend.gateway.models import CommandName, utc_now


def test_enqueue_and_next_command_marks_delivered():
    queue = DeviceCommandQueue(default_ttl_seconds=30)

    queued = queue.enqueue(
        device_id="S9_01",
        command=CommandName.DIAL,
        call_id="call-1",
        payload={"phone_number": "0901000001"},
    )
    delivered = queue.next_for_device("S9_01")

    assert delivered is not None
    assert delivered.command_id == queued.command_id
    assert delivered.status == CommandStatus.DELIVERED
    assert delivered.attempt_count == 1
    assert delivered.delivered_at is not None
    assert delivered.payload == {"phone_number": "0901000001"}


def test_ack_command_marks_terminal_success():
    queue = DeviceCommandQueue()
    queued = queue.enqueue("S9_01", CommandName.PING)
    queue.next_for_device("S9_01")

    acked = queue.ack("S9_01", queued.command_id)

    assert acked.status == CommandStatus.ACKED
    assert acked.acknowledged_at is not None
    assert queue.next_for_device("S9_01") is None


def test_nack_command_records_error_and_is_terminal():
    queue = DeviceCommandQueue()
    queued = queue.enqueue("S9_01", CommandName.DIAL, call_id="call-1")
    queue.next_for_device("S9_01")

    nacked = queue.nack("S9_01", queued.command_id, "telephony_failed")

    assert nacked.status == CommandStatus.NACKED
    assert nacked.last_error == "telephony_failed"
    assert nacked.acknowledged_at is not None
    assert queue.next_for_device("S9_01") is None


def test_next_command_expires_overdue_commands_before_delivery():
    now = utc_now()
    queue = DeviceCommandQueue(default_ttl_seconds=5)
    queued = queue.enqueue("S9_01", CommandName.PING, now=now)

    result = queue.next_for_device("S9_01", now=now + timedelta(seconds=6))

    assert result is None
    assert queue.get(queued.command_id).status == CommandStatus.EXPIRED


def test_history_is_scoped_by_device():
    queue = DeviceCommandQueue()
    queue.enqueue("S9_01", CommandName.PING)
    queue.enqueue("S9_02", CommandName.PING)

    history = queue.list_for_device("S9_01")

    assert len(history) == 1
    assert history[0].device_id == "S9_01"
```

- [ ] **Step 2: Run command queue tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_command_queue.py -v
```

Expected: FAIL because `backend.gateway.command_queue` does not exist.

- [ ] **Step 3: Implement command queue**

Create `backend/gateway/command_queue.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from threading import RLock
from typing import Any
from uuid import uuid4

from .models import CommandName, utc_now


class CommandStatus(str, Enum):
    QUEUED = "queued"
    DELIVERED = "delivered"
    ACKED = "acked"
    NACKED = "nacked"
    EXPIRED = "expired"
    FAILED = "failed"


TERMINAL_STATUSES = {
    CommandStatus.ACKED,
    CommandStatus.NACKED,
    CommandStatus.EXPIRED,
    CommandStatus.FAILED,
}


@dataclass
class DeviceCommand:
    command_id: str
    device_id: str
    command: CommandName
    call_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    status: CommandStatus = CommandStatus.QUEUED
    attempt_count: int = 0
    created_at: datetime = field(default_factory=utc_now)
    delivered_at: datetime | None = None
    acknowledged_at: datetime | None = None
    expires_at: datetime | None = None
    last_error: str | None = None

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    def as_dict(self) -> dict[str, Any]:
        return {
            "command_id": self.command_id,
            "device_id": self.device_id,
            "command": self.command.value,
            "call_id": self.call_id,
            "payload": dict(self.payload),
            "status": self.status.value,
            "attempt_count": self.attempt_count,
            "created_at": self.created_at.isoformat(),
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "acknowledged_at": (
                self.acknowledged_at.isoformat() if self.acknowledged_at else None
            ),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_error": self.last_error,
        }


class DeviceCommandQueue:
    def __init__(self, default_ttl_seconds: int = 30) -> None:
        self._commands: dict[str, DeviceCommand] = {}
        self._order: list[str] = []
        self._default_ttl_seconds = default_ttl_seconds
        self._lock = RLock()

    def enqueue(
        self,
        device_id: str,
        command: CommandName,
        call_id: str | None = None,
        payload: dict[str, Any] | None = None,
        ttl_seconds: int | None = None,
        now: datetime | None = None,
    ) -> DeviceCommand:
        created_at = now or utc_now()
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl_seconds
        queued = DeviceCommand(
            command_id=str(uuid4()),
            device_id=device_id,
            command=command,
            call_id=call_id,
            payload=dict(payload or {}),
            created_at=created_at,
            expires_at=created_at + timedelta(seconds=ttl),
        )
        with self._lock:
            self._commands[queued.command_id] = queued
            self._order.append(queued.command_id)
            return queued

    def get(self, command_id: str) -> DeviceCommand:
        with self._lock:
            return self._commands[command_id]

    def list_for_device(self, device_id: str) -> list[DeviceCommand]:
        with self._lock:
            return [
                self._commands[command_id]
                for command_id in self._order
                if self._commands[command_id].device_id == device_id
            ]

    def next_for_device(
        self, device_id: str, now: datetime | None = None
    ) -> DeviceCommand | None:
        current_time = now or utc_now()
        with self._lock:
            self._expire_overdue_locked(current_time)
            for command_id in self._order:
                command = self._commands[command_id]
                if command.device_id != device_id or command.is_terminal:
                    continue
                command.status = CommandStatus.DELIVERED
                command.delivered_at = current_time
                command.attempt_count += 1
                return command
            return None

    def ack(
        self, device_id: str, command_id: str, now: datetime | None = None
    ) -> DeviceCommand:
        with self._lock:
            command = self._get_for_device_locked(device_id, command_id)
            command.status = CommandStatus.ACKED
            command.acknowledged_at = now or utc_now()
            command.last_error = None
            return command

    def nack(
        self,
        device_id: str,
        command_id: str,
        reason: str,
        now: datetime | None = None,
    ) -> DeviceCommand:
        with self._lock:
            command = self._get_for_device_locked(device_id, command_id)
            command.status = CommandStatus.NACKED
            command.acknowledged_at = now or utc_now()
            command.last_error = reason
            return command

    def expire_overdue(self, now: datetime | None = None) -> list[DeviceCommand]:
        with self._lock:
            return self._expire_overdue_locked(now or utc_now())

    def _expire_overdue_locked(self, now: datetime) -> list[DeviceCommand]:
        expired: list[DeviceCommand] = []
        for command in self._commands.values():
            if command.is_terminal or command.expires_at is None:
                continue
            if command.expires_at <= now:
                command.status = CommandStatus.EXPIRED
                command.last_error = "command_expired"
                expired.append(command)
        return expired

    def _get_for_device_locked(self, device_id: str, command_id: str) -> DeviceCommand:
        command = self._commands[command_id]
        if command.device_id != device_id:
            raise KeyError(command_id)
        return command
```

- [ ] **Step 4: Run command queue tests to verify they pass**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_command_queue.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit command queue**

Run:

```powershell
git status --short
git add backend\gateway\command_queue.py backend\tests\gateway\test_command_queue.py
git commit -m "feat: add gateway device command queue"
```

Expected: commit succeeds.

---

## Task 2: Router Enqueues DIAL Commands

**Files:**

- Modify: `backend/gateway/router.py`
- Modify: `backend/tests/gateway/test_router.py`

- [ ] **Step 1: Add failing router command test**

Append to `backend/tests/gateway/test_router.py`:

```python
from backend.gateway.command_queue import DeviceCommandQueue
from backend.gateway.models import CommandName


def test_route_call_enqueues_dial_command_for_allocated_device():
    registry = DeviceRegistry()
    sessions = CallSessionManager()
    commands = DeviceCommandQueue()
    router = CallRouter(registry=registry, sessions=sessions, command_queue=commands)
    registry.register_device("S9_01", "192.168.1.10", audio_port=50001)

    session = router.enqueue_and_allocate(CallRequest(phone_number="0901000001"))
    command = commands.next_for_device("S9_01")

    assert command is not None
    assert command.command == CommandName.DIAL
    assert command.device_id == "S9_01"
    assert command.call_id == session.call_id
    assert command.payload == {
        "phone_number": "0901000001",
        "sim_slot": session.sim_slot,
        "audio_in_port": 50001,
        "audio_out_port": 50001,
    }
```

If imports already exist, merge them instead of duplicating names.

- [ ] **Step 2: Run router test to verify it fails**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_router.py::test_route_call_enqueues_dial_command_for_allocated_device -v
```

Expected: FAIL because `CallRouter.__init__` does not accept `command_queue`.

- [ ] **Step 3: Update router to enqueue DIAL**

Replace `backend/gateway/router.py` with:

```python
from __future__ import annotations

from collections import deque
from threading import RLock

from .command_queue import DeviceCommandQueue
from .models import CallRequest, CallSession, CallState, CommandName
from .registry import DeviceRegistry
from .session_manager import CallSessionManager


class CallRouter:
    def __init__(
        self,
        registry: DeviceRegistry,
        sessions: CallSessionManager,
        command_queue: DeviceCommandQueue | None = None,
    ) -> None:
        self._registry = registry
        self._sessions = sessions
        self._command_queue = command_queue
        self._queue: deque[str] = deque()
        self._lock = RLock()

    @property
    def queue_size(self) -> int:
        with self._lock:
            return len(self._queue)

    def enqueue_and_allocate(self, request: CallRequest) -> CallSession:
        with self._lock:
            session = self._sessions.create_queued_session(request)
            allocated = self._try_allocate(session.call_id)
            if allocated:
                return allocated
            self._queue.append(session.call_id)
            return session

    def complete_call(self, call_id: str) -> CallSession | None:
        with self._lock:
            session = self._sessions.get(call_id)
            self._remove_from_queue(call_id)
            if session.device_id:
                self._registry.release(session.device_id)
            self._sessions.mark_completed(call_id)
            return self._allocate_next_queued()

    def fail_call(self, call_id: str, reason: str) -> CallSession | None:
        with self._lock:
            session = self._sessions.get(call_id)
            self._remove_from_queue(call_id)
            if session.device_id:
                self._registry.release(session.device_id)
            self._sessions.mark_failed(call_id, reason)
            return self._allocate_next_queued()

    def _allocate_next_queued(self) -> CallSession | None:
        while self._queue:
            call_id = self._queue.popleft()
            if self._sessions.get(call_id).state != CallState.QUEUED:
                continue
            allocated = self._try_allocate(call_id)
            if allocated:
                return allocated
        return None

    def _remove_from_queue(self, call_id: str) -> None:
        try:
            self._queue.remove(call_id)
        except ValueError:
            return

    def _try_allocate(self, call_id: str) -> CallSession | None:
        device = self._registry.find_available_device()
        if not device:
            return None
        sim_slot = self._select_sim_slot(device)
        self._registry.mark_busy(device.device_id, call_id)
        session = self._sessions.attach_device(
            call_id=call_id,
            device_id=device.device_id,
            sim_slot=sim_slot,
            audio_in_port=device.audio_port,
            audio_out_port=device.audio_port,
        )
        self._enqueue_dial_command(session)
        return session

    def _enqueue_dial_command(self, session: CallSession) -> None:
        if not self._command_queue or not session.device_id:
            return
        self._command_queue.enqueue(
            device_id=session.device_id,
            command=CommandName.DIAL,
            call_id=session.call_id,
            payload={
                "phone_number": session.phone_number,
                "sim_slot": session.sim_slot,
                "audio_in_port": session.audio_in_port,
                "audio_out_port": session.audio_out_port,
            },
        )

    @staticmethod
    def _select_sim_slot(device) -> int:
        for slot in device.sim_slots:
            if slot.enabled:
                return slot.slot_id
        raise RuntimeError(f"Device {device.device_id} has no enabled SIM slot")
```

- [ ] **Step 4: Run router tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_router.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit router integration**

Run:

```powershell
git status --short
git add backend\gateway\router.py backend\tests\gateway\test_router.py
git commit -m "feat: enqueue dial commands on call allocation"
```

Expected: commit succeeds.

---

## Task 3: Command Polling and ACK/NACK API

**Files:**

- Modify: `backend/gateway/api.py`
- Modify: `backend/tests/gateway/test_api.py`

- [ ] **Step 1: Add failing API tests**

Append to `backend/tests/gateway/test_api.py`:

```python
def test_dial_allocated_call_exposes_next_device_command():
    client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": "S9_COMMAND_01",
            "ip_address": "192.168.1.50",
            "audio_port": 50100,
        },
    )

    dial_response = client.post(
        "/api/v1/gateway/calls/dial",
        json={"phone_number": "0901000001"},
    )
    call_id = dial_response.json()["call_id"]

    command_response = client.get(
        "/api/v1/gateway/devices/S9_COMMAND_01/commands/next"
    )

    assert command_response.status_code == 200
    body = command_response.json()
    assert body["command"]["command"] == "DIAL"
    assert body["command"]["device_id"] == "S9_COMMAND_01"
    assert body["command"]["call_id"] == call_id
    assert body["command"]["payload"]["phone_number"] == "0901000001"
    assert body["command"]["status"] == "delivered"


def test_device_can_ack_and_nack_commands():
    client.post(
        "/api/v1/gateway/devices/register",
        json={"device_id": "S9_COMMAND_02", "ip_address": "192.168.1.51"},
    )
    client.post("/api/v1/gateway/calls/dial", json={"phone_number": "0901000002"})
    command = client.get(
        "/api/v1/gateway/devices/S9_COMMAND_02/commands/next"
    ).json()["command"]

    ack_response = client.post(
        f"/api/v1/gateway/devices/S9_COMMAND_02/commands/{command['command_id']}/ack",
        json={"status": "acked"},
    )

    assert ack_response.status_code == 200
    assert ack_response.json()["status"] == "acked"

    client.post(
        "/api/v1/gateway/devices/register",
        json={"device_id": "S9_COMMAND_03", "ip_address": "192.168.1.52"},
    )
    client.post("/api/v1/gateway/calls/dial", json={"phone_number": "0901000003"})
    command = client.get(
        "/api/v1/gateway/devices/S9_COMMAND_03/commands/next"
    ).json()["command"]

    nack_response = client.post(
        f"/api/v1/gateway/devices/S9_COMMAND_03/commands/{command['command_id']}/ack",
        json={"status": "nacked", "error": "telephony_failed"},
    )

    assert nack_response.status_code == 200
    assert nack_response.json()["status"] == "nacked"
    assert nack_response.json()["last_error"] == "telephony_failed"


def test_next_command_returns_null_when_queue_empty():
    client.post(
        "/api/v1/gateway/devices/register",
        json={"device_id": "S9_COMMAND_EMPTY", "ip_address": "192.168.1.53"},
    )

    response = client.get(
        "/api/v1/gateway/devices/S9_COMMAND_EMPTY/commands/next"
    )

    assert response.status_code == 200
    assert response.json() == {"command": None}
```

If `client` uses a fixture in the current file, adapt only the function signatures to match the existing file.

- [ ] **Step 2: Run API tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_api.py -v
```

Expected: FAIL because command endpoints do not exist and router is not wired to a command queue.

- [ ] **Step 3: Update Gateway API**

Modify `backend/gateway/api.py`.

Add this import near the other gateway imports:

```python
from .command_queue import DeviceCommandQueue
```

Change the global objects to:

```python
device_registry = DeviceRegistry()
session_manager = CallSessionManager()
command_queue = DeviceCommandQueue()
call_router = CallRouter(
    registry=device_registry,
    sessions=session_manager,
    command_queue=command_queue,
)
```

Add this Pydantic model below `DialPayload`:

```python
class CommandAckPayload(BaseModel):
    status: str
    error: str | None = None
```

Add these helper functions below the model definitions:

```python
def _ensure_device_exists(device_id: str) -> None:
    try:
        device_registry.get_device(device_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc
```

Append these endpoints before `@gateway_api_router.post("/calls/dial")`:

```python
@gateway_api_router.get("/devices/{device_id}/commands/next")
def next_gateway_device_command(device_id: str):
    _ensure_device_exists(device_id)
    command = command_queue.next_for_device(device_id)
    return {"command": command.as_dict() if command else None}


@gateway_api_router.get("/devices/{device_id}/commands")
def list_gateway_device_commands(device_id: str):
    _ensure_device_exists(device_id)
    return [command.as_dict() for command in command_queue.list_for_device(device_id)]


@gateway_api_router.post("/devices/{device_id}/commands/{command_id}/ack")
def ack_gateway_device_command(
    device_id: str, command_id: str, payload: CommandAckPayload
):
    _ensure_device_exists(device_id)
    try:
        if payload.status == "acked":
            command = command_queue.ack(device_id, command_id)
        elif payload.status == "nacked":
            command = command_queue.nack(
                device_id,
                command_id,
                payload.error or "device_nacked_command",
            )
        else:
            raise HTTPException(
                status_code=400, detail="status must be 'acked' or 'nacked'"
            )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Command not found") from exc
    return command.as_dict()
```

- [ ] **Step 4: Run API tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_api.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gateway tests to catch global-state issues**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
```

Expected: PASS.

- [ ] **Step 6: Commit command API**

Run:

```powershell
git status --short
git add backend\gateway\api.py backend\tests\gateway\test_api.py
git commit -m "feat: expose device command polling API"
```

Expected: commit succeeds.

---

## Task 4: S9 Simulator Command Flow Helpers

**Files:**

- Modify: `backend/gateway/simulators/s9_simulator.py`
- Test: `backend/tests/gateway/test_s9_simulator.py`

- [ ] **Step 1: Write failing simulator tests**

Create `backend/tests/gateway/test_s9_simulator.py`:

```python
from backend.gateway.models import CommandName, DeviceEventType
from backend.gateway.simulators.s9_simulator import S9Simulator


def test_s9_simulator_acknowledges_command_payload():
    simulator = S9Simulator("S9_SIM_01", "192.168.1.60", audio_port=50200)
    command = {
        "command_id": "cmd-1",
        "command": CommandName.PING.value,
        "call_id": None,
        "payload": {},
    }

    ack = simulator.ack_command(command)

    assert ack == {
        "command_id": "cmd-1",
        "status": "acked",
        "error": None,
    }


def test_s9_simulator_handles_dial_command_as_ringing_event():
    simulator = S9Simulator("S9_SIM_01", "192.168.1.60", audio_port=50200)
    command = {
        "command_id": "cmd-2",
        "command": CommandName.DIAL.value,
        "call_id": "call-1",
        "payload": {"phone_number": "0901000001"},
    }

    event = simulator.handle_command(command)

    assert simulator.active_call_id == "call-1"
    assert event["type"] == "event"
    assert event["event"] == DeviceEventType.RINGING.value
    assert event["device_id"] == "S9_SIM_01"
    assert event["call_id"] == "call-1"
    assert event["payload"]["phone_number"] == "0901000001"


def test_s9_simulator_nacks_unsupported_command():
    simulator = S9Simulator("S9_SIM_01", "192.168.1.60", audio_port=50200)
    command = {
        "command_id": "cmd-3",
        "command": "UNSUPPORTED",
        "call_id": None,
        "payload": {},
    }

    ack = simulator.ack_command(command)

    assert ack == {
        "command_id": "cmd-3",
        "status": "nacked",
        "error": "unsupported_command:UNSUPPORTED",
    }
```

- [ ] **Step 2: Run simulator tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_s9_simulator.py -v
```

Expected: FAIL because `ack_command` and `handle_command` do not exist.

- [ ] **Step 3: Implement simulator command helpers**

Modify `backend/gateway/simulators/s9_simulator.py`.

Change the import line to:

```python
from backend.gateway.models import CommandName, DeviceEventType, DeviceHealth
```

Add these methods inside `S9Simulator` after `health_event`:

```python
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
```

- [ ] **Step 4: Run simulator tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_s9_simulator.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit simulator helpers**

Run:

```powershell
git status --short
git add backend\gateway\simulators\s9_simulator.py backend\tests\gateway\test_s9_simulator.py
git commit -m "feat: add S9 simulator command flow"
```

Expected: commit succeeds.

---

## Task 5: End-to-End Command Flow Verification

**Files:**

- Test: `backend/tests/gateway/test_command_flow.py`

- [ ] **Step 1: Write failing end-to-end command flow test**

Create `backend/tests/gateway/test_command_flow.py`:

```python
from fastapi.testclient import TestClient

from backend.main import app
from backend.gateway.models import DeviceEventType
from backend.gateway.simulators.s9_simulator import S9Simulator


client = TestClient(app)


def test_gateway_to_simulator_dial_command_flow():
    simulator = S9Simulator("S9_E2E_01", "192.168.1.70", audio_port=50300)
    register = simulator.register_event()

    register_response = client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": register["device_id"],
            "ip_address": register["payload"]["ip_address"],
            "app_version": register["payload"]["app_version"],
            "audio_port": register["payload"]["audio_port"],
        },
    )
    assert register_response.status_code == 200

    dial_response = client.post(
        "/api/v1/gateway/calls/dial",
        json={"phone_number": "0901999000", "campaign_id": "camp-e2e"},
    )
    assert dial_response.status_code == 200
    call_id = dial_response.json()["call_id"]

    command_response = client.get(
        "/api/v1/gateway/devices/S9_E2E_01/commands/next"
    )
    command = command_response.json()["command"]
    assert command["command"] == "DIAL"
    assert command["call_id"] == call_id

    ack_payload = simulator.ack_command(command)
    ack_response = client.post(
        f"/api/v1/gateway/devices/S9_E2E_01/commands/{command['command_id']}/ack",
        json=ack_payload,
    )
    assert ack_response.status_code == 200
    assert ack_response.json()["status"] == "acked"

    event = simulator.handle_command(command)
    assert event["event"] == DeviceEventType.RINGING.value
    assert event["call_id"] == call_id
```

- [ ] **Step 2: Run end-to-end test**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_command_flow.py -v
```

Expected: PASS if Tasks 1-4 were implemented correctly. If it fails, fix only the behavior named by the failure.

- [ ] **Step 3: Run gateway test suite**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
```

Expected: PASS.

- [ ] **Step 4: Commit end-to-end command flow test**

Run:

```powershell
git status --short
git add backend\tests\gateway\test_command_flow.py
git commit -m "test: verify gateway simulator command flow"
```

Expected: commit succeeds.

---

## Task 6: Package 1 Final Verification

**Files:**

- No production file changes expected.

- [ ] **Step 1: Run Gateway tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
```

Expected: all Gateway tests PASS.

- [ ] **Step 2: Run AI runtime tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime -v
```

Expected: all AI runtime tests PASS.

- [ ] **Step 3: Run TypeScript lint**

Run:

```powershell
npm.cmd run lint
```

Expected: TypeScript check exits 0.

- [ ] **Step 4: Check branch status**

Run:

```powershell
git status --short --branch
```

Expected: clean working tree on `feature/boxphone-gateway-core`.

- [ ] **Step 5: Report verification**

Include these exact result categories in the final implementation response:

```text
Gateway tests: command and final pytest summary line.
AI runtime tests: command and final pytest summary line.
TypeScript lint: command and exit status.
Branch status: output of git status --short --branch.
```

---

## Self-Review

Spec coverage:

- Gateway command queue is covered by Tasks 1-3.
- `DIAL` command on allocation is covered by Task 2.
- Android Agent polling/ACK contract is covered by Task 3.
- Simulator command flow is covered by Task 4.
- End-to-end simulator-certified flow is covered by Task 5.
- Final verification is covered by Task 6.

Out of scope for this Package 1 plan:

- Flutter Android Agent project.
- Audio router implementation.
- Dashboard UI.
- Token pairing/security hardening.
- Soak test runner.

Those are separate implementation packages from the production handover spec.

Placeholder scan:

- This plan contains no incomplete markers or unspecified implementation steps.
- Every code-producing task has explicit files, commands, and expected outcomes.

Type consistency:

- `CommandName` is reused from `backend.gateway.models`.
- `CommandStatus` and `DeviceCommand` are defined in Task 1 and reused by later tasks through `DeviceCommandQueue`.
- Router integration keeps existing constructor compatibility by making `command_queue` optional.
- API responses use `DeviceCommand.as_dict()` so enum values serialize as strings.
