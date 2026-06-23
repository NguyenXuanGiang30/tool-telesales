# Boxphone Gateway Core and Simulators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working slice of the Boxphone platform: Gateway domain core, device registry, call routing, session isolation, audio packet contract, AI adapter contract, and local simulators for S9 devices and AI.

**Architecture:** This plan creates a new focused `backend/gateway` package instead of expanding the existing large `backend/main.py`. The first slice is intentionally simulator-first so routing, state transitions, and adapter contracts can be tested without physical Samsung S9 devices or Flutter APKs.

**Tech Stack:** Python 3.11+, FastAPI-compatible backend modules, pytest, dataclasses, enums, asyncio, JSON-over-WebSocket control schema, UDP PCM packet header contract.

---

## Scope Check

The approved spec covers several independent subsystems: Boxphone Gateway, Flutter Android Agent, native/root audio bridge, built-in AI conversation agent, external AI adapter, dashboard, and production hardening.

This plan implements only the first testable subsystem:

- Gateway domain core.
- Device registry.
- Call router and queue primitives.
- Session manager.
- Audio packet header contract.
- AI adapter contract.
- S9 and AI simulators.
- Gateway API mount points for the current FastAPI app.

Separate plans should follow for:

- Flutter Android Agent APK.
- Native/root audio bridge.
- Built-in AI conversation agent.
- External local AI sample adapter.
- Dashboard and production hardening.

## File Structure

Create:

- `backend/gateway/__init__.py`: package exports.
- `backend/gateway/models.py`: enums and dataclasses for devices, calls, sessions, commands, events, health.
- `backend/gateway/registry.py`: in-memory device registry with heartbeat and health updates.
- `backend/gateway/session_manager.py`: call session lifecycle and session lookup.
- `backend/gateway/router.py`: device allocation, queueing, release, and call state transitions.
- `backend/gateway/audio_protocol.py`: binary audio packet header encode/decode.
- `backend/gateway/ai_adapter.py`: adapter interface and echo/silent simulator.
- `backend/gateway/control_protocol.py`: JSON command/event parsing and validation.
- `backend/gateway/api.py`: FastAPI router for devices, calls, sessions, simulator hooks.
- `backend/gateway/simulators/__init__.py`: simulator package exports.
- `backend/gateway/simulators/s9_simulator.py`: local S9 simulator for control events.
- `backend/gateway/simulators/ai_simulator.py`: local AI adapter simulator.
- `backend/tests/gateway/test_models.py`
- `backend/tests/gateway/test_registry.py`
- `backend/tests/gateway/test_session_manager.py`
- `backend/tests/gateway/test_router.py`
- `backend/tests/gateway/test_audio_protocol.py`
- `backend/tests/gateway/test_ai_adapter.py`
- `backend/tests/gateway/test_control_protocol.py`

Modify:

- `backend/main.py`: mount `gateway_api_router` under `/api/v1/gateway` without removing existing routes.
- `backend/requirements.txt`: add `pytest` if test execution in the environment needs it.

## Task 1: Gateway Domain Models

**Files:**

- Create: `backend/gateway/__init__.py`
- Create: `backend/gateway/models.py`
- Test: `backend/tests/gateway/test_models.py`

- [ ] **Step 1: Write the failing model tests**

Create `backend/tests/gateway/test_models.py`:

```python
from backend.gateway.models import (
    CallState,
    DeviceHealth,
    DeviceRecord,
    DeviceStatus,
    SimSlot,
)


def test_device_record_defaults_to_idle_without_active_call():
    device = DeviceRecord(device_id="S9_01", ip_address="192.168.1.10")

    assert device.device_id == "S9_01"
    assert device.status == DeviceStatus.IDLE
    assert device.active_call_id is None
    assert device.sim_slots == [
        SimSlot(slot_id=1, enabled=True),
        SimSlot(slot_id=2, enabled=True),
    ]


def test_device_health_marks_hot_device_as_unhealthy():
    health = DeviceHealth(
        battery_percent=80,
        temperature_c=48.5,
        signal_dbm=-74,
        charging=True,
    )

    assert health.is_healthy is False


def test_call_state_order_contains_connected_lifecycle():
    lifecycle = [
        CallState.QUEUED,
        CallState.ALLOCATING_DEVICE,
        CallState.DIALING,
        CallState.RINGING,
        CallState.CONNECTED,
        CallState.ENDING,
        CallState.COMPLETED,
    ]

    assert [state.value for state in lifecycle] == [
        "queued",
        "allocating_device",
        "dialing",
        "ringing",
        "connected",
        "ending",
        "completed",
    ]
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest backend\tests\gateway\test_models.py -v
```

Expected: FAIL because `backend.gateway.models` does not exist.

- [ ] **Step 3: Implement domain models**

Create `backend/gateway/__init__.py`:

```python
"""Boxphone Gateway package."""
```

Create `backend/gateway/models.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DeviceStatus(str, Enum):
    OFFLINE = "offline"
    ONLINE = "online"
    IDLE = "idle"
    BUSY = "busy"
    DEGRADED = "degraded"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class CallState(str, Enum):
    QUEUED = "queued"
    ALLOCATING_DEVICE = "allocating_device"
    DIALING = "dialing"
    RINGING = "ringing"
    CONNECTED = "connected"
    AI_LISTENING = "ai_listening"
    AI_THINKING = "ai_thinking"
    AI_SPEAKING = "ai_speaking"
    ENDING = "ending"
    COMPLETED = "completed"
    FAILED = "failed"


class CommandName(str, Enum):
    DIAL = "DIAL"
    HANGUP = "HANGUP"
    HOLD = "HOLD"
    RESUME = "RESUME"
    SELECT_SIM = "SELECT_SIM"
    PING = "PING"
    START_AUDIO = "START_AUDIO"
    STOP_AUDIO = "STOP_AUDIO"


class DeviceEventType(str, Enum):
    REGISTERED = "REGISTERED"
    HEARTBEAT = "HEARTBEAT"
    RINGING = "RINGING"
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    BUSY = "BUSY"
    NO_ANSWER = "NO_ANSWER"
    ERROR = "ERROR"
    AUDIO_STARTED = "AUDIO_STARTED"
    AUDIO_STOPPED = "AUDIO_STOPPED"
    HEALTH = "HEALTH"


@dataclass(frozen=True)
class SimSlot:
    slot_id: int
    enabled: bool = True
    carrier: str | None = None
    phone_number: str | None = None
    daily_call_limit: int | None = None
    calls_today: int = 0


@dataclass(frozen=True)
class DeviceHealth:
    battery_percent: int | None = None
    temperature_c: float | None = None
    signal_dbm: int | None = None
    charging: bool | None = None
    network_type: str | None = None
    storage_free_mb: int | None = None

    @property
    def is_healthy(self) -> bool:
        if self.temperature_c is not None and self.temperature_c > 45.0:
            return False
        if self.signal_dbm is not None and self.signal_dbm < -110:
            return False
        if self.battery_percent is not None and self.battery_percent < 10:
            return False
        return True


@dataclass
class DeviceRecord:
    device_id: str
    ip_address: str
    status: DeviceStatus = DeviceStatus.IDLE
    app_version: str | None = None
    last_heartbeat_at: datetime = field(default_factory=utc_now)
    active_call_id: str | None = None
    audio_port: int | None = None
    sim_slots: list[SimSlot] = field(
        default_factory=lambda: [SimSlot(slot_id=1), SimSlot(slot_id=2)]
    )
    health: DeviceHealth = field(default_factory=DeviceHealth)

    @property
    def can_accept_call(self) -> bool:
        return (
            self.status == DeviceStatus.IDLE
            and self.active_call_id is None
            and self.health.is_healthy
            and any(slot.enabled for slot in self.sim_slots)
        )


@dataclass
class CallRequest:
    phone_number: str
    campaign_id: str | None = None
    lead_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CallSession:
    call_id: str
    phone_number: str
    state: CallState
    campaign_id: str | None = None
    lead_id: str | None = None
    device_id: str | None = None
    sim_slot: int | None = None
    audio_in_port: int | None = None
    audio_out_port: int | None = None
    ai_session_id: str | None = None
    failure_reason: str | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
    connected_at: datetime | None = None
    ended_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
python -m pytest backend\tests\gateway\test_models.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git status --short
git add backend\gateway\__init__.py backend\gateway\models.py backend\tests\gateway\test_models.py
git commit -m "feat: add gateway domain models"
```

Expected if repository exists: commit succeeds. If this workspace still has no `.git`, record `fatal: not a git repository` and continue without commit.

## Task 2: Device Registry

**Files:**

- Create: `backend/gateway/registry.py`
- Test: `backend/tests/gateway/test_registry.py`

- [ ] **Step 1: Write registry tests**

Create `backend/tests/gateway/test_registry.py`:

```python
from datetime import timedelta

from backend.gateway.models import DeviceHealth, DeviceStatus, utc_now
from backend.gateway.registry import DeviceRegistry


def test_register_device_creates_idle_record():
    registry = DeviceRegistry()

    device = registry.register_device(
        device_id="S9_01",
        ip_address="192.168.1.10",
        app_version="1.0.0",
        audio_port=50001,
    )

    assert device.device_id == "S9_01"
    assert device.status == DeviceStatus.IDLE
    assert device.audio_port == 50001
    assert registry.get_device("S9_01") == device


def test_heartbeat_updates_timestamp_and_status():
    registry = DeviceRegistry()
    registry.register_device("S9_01", "192.168.1.10")
    before = registry.get_device("S9_01").last_heartbeat_at

    updated = registry.heartbeat("S9_01")

    assert updated.last_heartbeat_at >= before
    assert updated.status == DeviceStatus.IDLE


def test_mark_stale_devices_offline():
    registry = DeviceRegistry(heartbeat_timeout_seconds=10)
    device = registry.register_device("S9_01", "192.168.1.10")
    device.last_heartbeat_at = utc_now() - timedelta(seconds=20)

    stale = registry.mark_stale_devices_offline()

    assert stale == ["S9_01"]
    assert registry.get_device("S9_01").status == DeviceStatus.OFFLINE


def test_health_update_degrades_hot_device():
    registry = DeviceRegistry()
    registry.register_device("S9_01", "192.168.1.10")

    device = registry.update_health(
        "S9_01",
        DeviceHealth(battery_percent=90, temperature_c=49.0, signal_dbm=-70),
    )

    assert device.status == DeviceStatus.DEGRADED
    assert device.can_accept_call is False
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest backend\tests\gateway\test_registry.py -v
```

Expected: FAIL because `DeviceRegistry` does not exist.

- [ ] **Step 3: Implement DeviceRegistry**

Create `backend/gateway/registry.py`:

```python
from __future__ import annotations

from datetime import timedelta
from threading import RLock

from .models import DeviceHealth, DeviceRecord, DeviceStatus, utc_now


class DeviceRegistry:
    def __init__(self, heartbeat_timeout_seconds: int = 10) -> None:
        self._devices: dict[str, DeviceRecord] = {}
        self._heartbeat_timeout_seconds = heartbeat_timeout_seconds
        self._lock = RLock()

    def register_device(
        self,
        device_id: str,
        ip_address: str,
        app_version: str | None = None,
        audio_port: int | None = None,
    ) -> DeviceRecord:
        with self._lock:
            existing = self._devices.get(device_id)
            if existing:
                existing.ip_address = ip_address
                existing.app_version = app_version or existing.app_version
                existing.audio_port = audio_port or existing.audio_port
                existing.last_heartbeat_at = utc_now()
                if existing.status == DeviceStatus.OFFLINE:
                    existing.status = DeviceStatus.IDLE
                return existing

            device = DeviceRecord(
                device_id=device_id,
                ip_address=ip_address,
                app_version=app_version,
                audio_port=audio_port,
                status=DeviceStatus.IDLE,
            )
            self._devices[device_id] = device
            return device

    def get_device(self, device_id: str) -> DeviceRecord:
        with self._lock:
            return self._devices[device_id]

    def list_devices(self) -> list[DeviceRecord]:
        with self._lock:
            return list(self._devices.values())

    def heartbeat(self, device_id: str) -> DeviceRecord:
        with self._lock:
            device = self._devices[device_id]
            device.last_heartbeat_at = utc_now()
            if device.status == DeviceStatus.OFFLINE:
                device.status = DeviceStatus.IDLE
            return device

    def update_health(self, device_id: str, health: DeviceHealth) -> DeviceRecord:
        with self._lock:
            device = self._devices[device_id]
            device.health = health
            if not health.is_healthy and device.status == DeviceStatus.IDLE:
                device.status = DeviceStatus.DEGRADED
            if health.is_healthy and device.status == DeviceStatus.DEGRADED:
                device.status = DeviceStatus.IDLE
            return device

    def mark_busy(self, device_id: str, call_id: str) -> DeviceRecord:
        with self._lock:
            device = self._devices[device_id]
            device.status = DeviceStatus.BUSY
            device.active_call_id = call_id
            return device

    def release(self, device_id: str) -> DeviceRecord:
        with self._lock:
            device = self._devices[device_id]
            device.active_call_id = None
            if device.health.is_healthy:
                device.status = DeviceStatus.IDLE
            else:
                device.status = DeviceStatus.DEGRADED
            return device

    def find_available_device(self) -> DeviceRecord | None:
        with self._lock:
            for device in self._devices.values():
                if device.can_accept_call:
                    return device
            return None

    def mark_stale_devices_offline(self) -> list[str]:
        with self._lock:
            cutoff = utc_now() - timedelta(seconds=self._heartbeat_timeout_seconds)
            stale: list[str] = []
            for device in self._devices.values():
                if device.last_heartbeat_at < cutoff and device.status != DeviceStatus.OFFLINE:
                    device.status = DeviceStatus.OFFLINE
                    device.active_call_id = None
                    stale.append(device.device_id)
            return stale
```

- [ ] **Step 4: Run registry tests**

Run:

```powershell
python -m pytest backend\tests\gateway\test_registry.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git status --short
git add backend\gateway\registry.py backend\tests\gateway\test_registry.py
git commit -m "feat: add gateway device registry"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and continue.

## Task 3: Session Manager

**Files:**

- Create: `backend/gateway/session_manager.py`
- Test: `backend/tests/gateway/test_session_manager.py`

- [ ] **Step 1: Write session manager tests**

Create `backend/tests/gateway/test_session_manager.py`:

```python
from backend.gateway.models import CallRequest, CallState
from backend.gateway.session_manager import CallSessionManager


def test_create_queued_session_assigns_call_id():
    manager = CallSessionManager()

    session = manager.create_queued_session(
        CallRequest(phone_number="0987654321", campaign_id="camp-1", lead_id="lead-1")
    )

    assert session.call_id
    assert session.phone_number == "0987654321"
    assert session.campaign_id == "camp-1"
    assert session.lead_id == "lead-1"
    assert session.state == CallState.QUEUED


def test_attach_device_moves_session_to_dialing():
    manager = CallSessionManager()
    session = manager.create_queued_session(CallRequest(phone_number="0987654321"))

    updated = manager.attach_device(
        call_id=session.call_id,
        device_id="S9_01",
        sim_slot=1,
        audio_in_port=50001,
        audio_out_port=50001,
    )

    assert updated.state == CallState.DIALING
    assert updated.device_id == "S9_01"
    assert updated.sim_slot == 1
    assert updated.audio_in_port == 50001


def test_mark_failed_sets_reason_and_end_time():
    manager = CallSessionManager()
    session = manager.create_queued_session(CallRequest(phone_number="0987654321"))

    failed = manager.mark_failed(session.call_id, "no_device_available")

    assert failed.state == CallState.FAILED
    assert failed.failure_reason == "no_device_available"
    assert failed.ended_at is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest backend\tests\gateway\test_session_manager.py -v
```

Expected: FAIL because `CallSessionManager` does not exist.

- [ ] **Step 3: Implement session manager**

Create `backend/gateway/session_manager.py`:

```python
from __future__ import annotations

from threading import RLock
from uuid import uuid4

from .models import CallRequest, CallSession, CallState, utc_now


class CallSessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, CallSession] = {}
        self._lock = RLock()

    def create_queued_session(self, request: CallRequest) -> CallSession:
        with self._lock:
            call_id = str(uuid4())
            session = CallSession(
                call_id=call_id,
                phone_number=request.phone_number,
                campaign_id=request.campaign_id,
                lead_id=request.lead_id,
                metadata=dict(request.metadata),
                state=CallState.QUEUED,
            )
            self._sessions[call_id] = session
            return session

    def get(self, call_id: str) -> CallSession:
        with self._lock:
            return self._sessions[call_id]

    def list_sessions(self) -> list[CallSession]:
        with self._lock:
            return list(self._sessions.values())

    def set_state(self, call_id: str, state: CallState) -> CallSession:
        with self._lock:
            session = self._sessions[call_id]
            session.state = state
            session.updated_at = utc_now()
            if state == CallState.CONNECTED and session.connected_at is None:
                session.connected_at = utc_now()
            if state in {CallState.COMPLETED, CallState.FAILED} and session.ended_at is None:
                session.ended_at = utc_now()
            return session

    def attach_device(
        self,
        call_id: str,
        device_id: str,
        sim_slot: int,
        audio_in_port: int | None,
        audio_out_port: int | None,
    ) -> CallSession:
        with self._lock:
            session = self._sessions[call_id]
            session.device_id = device_id
            session.sim_slot = sim_slot
            session.audio_in_port = audio_in_port
            session.audio_out_port = audio_out_port
            session.ai_session_id = call_id
            session.state = CallState.DIALING
            session.updated_at = utc_now()
            return session

    def mark_failed(self, call_id: str, reason: str) -> CallSession:
        with self._lock:
            session = self._sessions[call_id]
            session.state = CallState.FAILED
            session.failure_reason = reason
            session.updated_at = utc_now()
            session.ended_at = utc_now()
            return session

    def mark_completed(self, call_id: str) -> CallSession:
        with self._lock:
            session = self._sessions[call_id]
            session.state = CallState.COMPLETED
            session.updated_at = utc_now()
            session.ended_at = utc_now()
            return session
```

- [ ] **Step 4: Run session tests**

Run:

```powershell
python -m pytest backend\tests\gateway\test_session_manager.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git status --short
git add backend\gateway\session_manager.py backend\tests\gateway\test_session_manager.py
git commit -m "feat: add call session manager"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and continue.

## Task 4: Call Router

**Files:**

- Create: `backend/gateway/router.py`
- Test: `backend/tests/gateway/test_router.py`

- [ ] **Step 1: Write router tests**

Create `backend/tests/gateway/test_router.py`:

```python
from backend.gateway.models import CallRequest, CallState, DeviceStatus
from backend.gateway.registry import DeviceRegistry
from backend.gateway.router import CallRouter
from backend.gateway.session_manager import CallSessionManager


def make_router():
    registry = DeviceRegistry()
    sessions = CallSessionManager()
    return CallRouter(registry=registry, sessions=sessions), registry, sessions


def test_route_call_allocates_idle_device():
    router, registry, _sessions = make_router()
    registry.register_device("S9_01", "192.168.1.10", audio_port=50001)

    session = router.enqueue_and_allocate(CallRequest(phone_number="0987654321"))

    assert session.state == CallState.DIALING
    assert session.device_id == "S9_01"
    assert session.sim_slot == 1
    assert registry.get_device("S9_01").status == DeviceStatus.BUSY
    assert registry.get_device("S9_01").active_call_id == session.call_id


def test_route_call_queues_when_no_device_available():
    router, _registry, _sessions = make_router()

    session = router.enqueue_and_allocate(CallRequest(phone_number="0987654321"))

    assert session.state == CallState.QUEUED
    assert session.device_id is None
    assert router.queue_size == 1


def test_complete_call_releases_device_and_allocates_next_queued_call():
    router, registry, _sessions = make_router()
    registry.register_device("S9_01", "192.168.1.10", audio_port=50001)
    active = router.enqueue_and_allocate(CallRequest(phone_number="0900000001"))
    queued = router.enqueue_and_allocate(CallRequest(phone_number="0900000002"))

    next_session = router.complete_call(active.call_id)

    assert next_session is not None
    assert next_session.call_id == queued.call_id
    assert next_session.state == CallState.DIALING
    assert registry.get_device("S9_01").active_call_id == queued.call_id
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest backend\tests\gateway\test_router.py -v
```

Expected: FAIL because `CallRouter` does not exist.

- [ ] **Step 3: Implement CallRouter**

Create `backend/gateway/router.py`:

```python
from __future__ import annotations

from collections import deque
from threading import RLock

from .models import CallRequest, CallSession
from .registry import DeviceRegistry
from .session_manager import CallSessionManager


class CallRouter:
    def __init__(self, registry: DeviceRegistry, sessions: CallSessionManager) -> None:
        self._registry = registry
        self._sessions = sessions
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
            if session.device_id:
                self._registry.release(session.device_id)
            self._sessions.mark_completed(call_id)
            return self._allocate_next_queued()

    def fail_call(self, call_id: str, reason: str) -> CallSession | None:
        with self._lock:
            session = self._sessions.get(call_id)
            if session.device_id:
                self._registry.release(session.device_id)
            self._sessions.mark_failed(call_id, reason)
            return self._allocate_next_queued()

    def _allocate_next_queued(self) -> CallSession | None:
        while self._queue:
            call_id = self._queue.popleft()
            allocated = self._try_allocate(call_id)
            if allocated:
                return allocated
        return None

    def _try_allocate(self, call_id: str) -> CallSession | None:
        device = self._registry.find_available_device()
        if not device:
            return None
        sim_slot = self._select_sim_slot(device)
        self._registry.mark_busy(device.device_id, call_id)
        return self._sessions.attach_device(
            call_id=call_id,
            device_id=device.device_id,
            sim_slot=sim_slot,
            audio_in_port=device.audio_port,
            audio_out_port=device.audio_port,
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
python -m pytest backend\tests\gateway\test_router.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git status --short
git add backend\gateway\router.py backend\tests\gateway\test_router.py
git commit -m "feat: add gateway call router"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and continue.

## Task 5: Audio Packet Protocol

**Files:**

- Create: `backend/gateway/audio_protocol.py`
- Test: `backend/tests/gateway/test_audio_protocol.py`

- [ ] **Step 1: Write audio packet tests**

Create `backend/tests/gateway/test_audio_protocol.py`:

```python
from backend.gateway.audio_protocol import AudioPacket, AudioDirection


def test_audio_packet_round_trip_preserves_payload_and_metadata():
    packet = AudioPacket(
        direction=AudioDirection.CUSTOMER_TO_AI,
        call_id="call-123",
        device_id="S9_01",
        sequence_number=7,
        timestamp_ms=123456789,
        sample_rate=16000,
        channels=1,
        payload=b"\x01\x02\x03\x04",
    )

    encoded = packet.encode()
    decoded = AudioPacket.decode(encoded)

    assert decoded.direction == AudioDirection.CUSTOMER_TO_AI
    assert decoded.call_id == "call-123"
    assert decoded.device_id == "S9_01"
    assert decoded.sequence_number == 7
    assert decoded.timestamp_ms == 123456789
    assert decoded.sample_rate == 16000
    assert decoded.channels == 1
    assert decoded.payload == b"\x01\x02\x03\x04"


def test_audio_packet_rejects_invalid_payload_length():
    packet = AudioPacket(
        direction=AudioDirection.AI_TO_CUSTOMER,
        call_id="call-123",
        device_id="S9_01",
        sequence_number=1,
        timestamp_ms=1,
        sample_rate=16000,
        channels=1,
        payload=b"abc",
    )
    encoded = packet.encode()[:-1]

    try:
        AudioPacket.decode(encoded)
    except ValueError as exc:
        assert "payload length" in str(exc)
    else:
        raise AssertionError("Expected ValueError for truncated packet")
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest backend\tests\gateway\test_audio_protocol.py -v
```

Expected: FAIL because `audio_protocol.py` does not exist.

- [ ] **Step 3: Implement audio protocol**

Create `backend/gateway/audio_protocol.py`:

```python
from __future__ import annotations

import json
import struct
from dataclasses import dataclass
from enum import IntEnum


class AudioDirection(IntEnum):
    CUSTOMER_TO_AI = 1
    AI_TO_CUSTOMER = 2


@dataclass(frozen=True)
class AudioPacket:
    direction: AudioDirection
    call_id: str
    device_id: str
    sequence_number: int
    timestamp_ms: int
    sample_rate: int
    channels: int
    payload: bytes
    version: int = 1

    def encode(self) -> bytes:
        metadata = {
            "version": self.version,
            "direction": int(self.direction),
            "call_id": self.call_id,
            "device_id": self.device_id,
            "sequence_number": self.sequence_number,
            "timestamp_ms": self.timestamp_ms,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "payload_length": len(self.payload),
            "codec": "pcm16",
        }
        metadata_bytes = json.dumps(metadata, separators=(",", ":")).encode("utf-8")
        return struct.pack("!H", len(metadata_bytes)) + metadata_bytes + self.payload

    @classmethod
    def decode(cls, raw: bytes) -> "AudioPacket":
        if len(raw) < 2:
            raise ValueError("packet is too short")
        (metadata_length,) = struct.unpack("!H", raw[:2])
        metadata_end = 2 + metadata_length
        if len(raw) < metadata_end:
            raise ValueError("metadata length exceeds packet size")
        metadata = json.loads(raw[2:metadata_end].decode("utf-8"))
        payload = raw[metadata_end:]
        expected_length = int(metadata["payload_length"])
        if len(payload) != expected_length:
            raise ValueError(
                f"payload length mismatch: expected {expected_length}, got {len(payload)}"
            )
        return cls(
            version=int(metadata["version"]),
            direction=AudioDirection(int(metadata["direction"])),
            call_id=str(metadata["call_id"]),
            device_id=str(metadata["device_id"]),
            sequence_number=int(metadata["sequence_number"]),
            timestamp_ms=int(metadata["timestamp_ms"]),
            sample_rate=int(metadata["sample_rate"]),
            channels=int(metadata["channels"]),
            payload=payload,
        )
```

- [ ] **Step 4: Run audio protocol tests**

Run:

```powershell
python -m pytest backend\tests\gateway\test_audio_protocol.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git status --short
git add backend\gateway\audio_protocol.py backend\tests\gateway\test_audio_protocol.py
git commit -m "feat: add audio packet protocol"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and continue.

## Task 6: Control Protocol

**Files:**

- Create: `backend/gateway/control_protocol.py`
- Test: `backend/tests/gateway/test_control_protocol.py`

- [ ] **Step 1: Write control protocol tests**

Create `backend/tests/gateway/test_control_protocol.py`:

```python
from backend.gateway.control_protocol import (
    build_command,
    parse_device_event,
)
from backend.gateway.models import CommandName, DeviceEventType


def test_build_dial_command_contains_command_id_and_payload():
    command = build_command(
        command=CommandName.DIAL,
        call_id="call-123",
        payload={"phone_number": "0987654321", "sim_slot": 1},
    )

    assert command["type"] == "command"
    assert command["command"] == "DIAL"
    assert command["call_id"] == "call-123"
    assert command["command_id"]
    assert command["payload"]["sim_slot"] == 1


def test_parse_device_event_validates_required_fields():
    event = parse_device_event(
        {
            "type": "event",
            "event": "CONNECTED",
            "device_id": "S9_01",
            "call_id": "call-123",
            "payload": {"network": "lte"},
        }
    )

    assert event.event == DeviceEventType.CONNECTED
    assert event.device_id == "S9_01"
    assert event.call_id == "call-123"


def test_parse_device_event_rejects_missing_device_id():
    try:
        parse_device_event({"type": "event", "event": "HEARTBEAT"})
    except ValueError as exc:
        assert "device_id" in str(exc)
    else:
        raise AssertionError("Expected ValueError for missing device_id")
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest backend\tests\gateway\test_control_protocol.py -v
```

Expected: FAIL because `control_protocol.py` does not exist.

- [ ] **Step 3: Implement control protocol**

Create `backend/gateway/control_protocol.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from .models import CommandName, DeviceEventType


@dataclass(frozen=True)
class DeviceEvent:
    event: DeviceEventType
    device_id: str
    call_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)


def build_command(
    command: CommandName,
    call_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "type": "command",
        "command": command.value,
        "command_id": str(uuid4()),
        "call_id": call_id,
        "payload": payload or {},
    }


def parse_device_event(raw: dict[str, Any]) -> DeviceEvent:
    if raw.get("type") != "event":
        raise ValueError("device message type must be event")
    device_id = raw.get("device_id")
    if not device_id:
        raise ValueError("device_id is required")
    event_name = raw.get("event")
    if not event_name:
        raise ValueError("event is required")
    try:
        event = DeviceEventType(str(event_name))
    except ValueError as exc:
        raise ValueError(f"unsupported event: {event_name}") from exc
    payload = raw.get("payload") or {}
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    call_id = raw.get("call_id")
    return DeviceEvent(event=event, device_id=str(device_id), call_id=call_id, payload=payload)
```

- [ ] **Step 4: Run control protocol tests**

Run:

```powershell
python -m pytest backend\tests\gateway\test_control_protocol.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git status --short
git add backend\gateway\control_protocol.py backend\tests\gateway\test_control_protocol.py
git commit -m "feat: add gateway control protocol"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and continue.

## Task 7: AI Adapter Contract and Simulator

**Files:**

- Create: `backend/gateway/ai_adapter.py`
- Create: `backend/gateway/simulators/__init__.py`
- Create: `backend/gateway/simulators/ai_simulator.py`
- Test: `backend/tests/gateway/test_ai_adapter.py`

- [ ] **Step 1: Write AI adapter tests**

Create `backend/tests/gateway/test_ai_adapter.py`:

```python
import asyncio

from backend.gateway.ai_adapter import AISessionEvent, SilentAIAdapter


def test_silent_ai_adapter_returns_hangup_after_timeout_event():
    async def run():
        adapter = SilentAIAdapter()
        await adapter.start_session(
            AISessionEvent(
                call_id="call-123",
                phone_number="0987654321",
                sample_rate=16000,
                channels=1,
            )
        )
        result = await adapter.end_session("call-123", reason="test_complete")
        return result

    result = asyncio.run(run())

    assert result["type"] == "result"
    assert result["call_id"] == "call-123"
    assert result["disposition"] == "completed"


def test_silent_ai_adapter_echoes_no_audio_frames():
    async def run():
        adapter = SilentAIAdapter()
        await adapter.start_session(
            AISessionEvent(
                call_id="call-123",
                phone_number="0987654321",
                sample_rate=16000,
                channels=1,
            )
        )
        output = await adapter.receive_audio("call-123", b"\x00" * 640)
        return output

    output = asyncio.run(run())

    assert output == []
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest backend\tests\gateway\test_ai_adapter.py -v
```

Expected: FAIL because `ai_adapter.py` does not exist.

- [ ] **Step 3: Implement AI adapter**

Create `backend/gateway/ai_adapter.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AISessionEvent:
    call_id: str
    phone_number: str
    sample_rate: int
    channels: int
    campaign_id: str | None = None
    lead_id: str | None = None


class AIAdapter(Protocol):
    async def start_session(self, event: AISessionEvent) -> dict:
        ...

    async def receive_audio(self, call_id: str, pcm_frame: bytes) -> list[bytes]:
        ...

    async def end_session(self, call_id: str, reason: str) -> dict:
        ...


class SilentAIAdapter:
    def __init__(self) -> None:
        self.started_sessions: dict[str, AISessionEvent] = {}

    async def start_session(self, event: AISessionEvent) -> dict:
        self.started_sessions[event.call_id] = event
        return {
            "type": "session.accepted",
            "call_id": event.call_id,
            "audio": {
                "sample_rate": event.sample_rate,
                "channels": event.channels,
                "codec": "pcm16",
            },
        }

    async def receive_audio(self, call_id: str, pcm_frame: bytes) -> list[bytes]:
        if call_id not in self.started_sessions:
            raise KeyError(f"AI session not found: {call_id}")
        return []

    async def end_session(self, call_id: str, reason: str) -> dict:
        if call_id not in self.started_sessions:
            raise KeyError(f"AI session not found: {call_id}")
        self.started_sessions.pop(call_id)
        return {
            "type": "result",
            "call_id": call_id,
            "disposition": "completed",
            "summary": f"Session ended with reason: {reason}",
            "tags": [],
            "next_action": "none",
        }
```

Create `backend/gateway/simulators/__init__.py`:

```python
"""Gateway simulators."""
```

Create `backend/gateway/simulators/ai_simulator.py`:

```python
from __future__ import annotations

from backend.gateway.ai_adapter import AISessionEvent, SilentAIAdapter


def create_silent_ai_adapter() -> SilentAIAdapter:
    return SilentAIAdapter()


__all__ = ["AISessionEvent", "SilentAIAdapter", "create_silent_ai_adapter"]
```

- [ ] **Step 4: Run AI adapter tests**

Run:

```powershell
python -m pytest backend\tests\gateway\test_ai_adapter.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git status --short
git add backend\gateway\ai_adapter.py backend\gateway\simulators\__init__.py backend\gateway\simulators\ai_simulator.py backend\tests\gateway\test_ai_adapter.py
git commit -m "feat: add AI adapter contract"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and continue.

## Task 8: S9 Control Simulator

**Files:**

- Create: `backend/gateway/simulators/s9_simulator.py`

- [ ] **Step 1: Add simulator implementation**

Create `backend/gateway/simulators/s9_simulator.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field

from backend.gateway.models import DeviceEventType, DeviceHealth


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
```

- [ ] **Step 2: Run import smoke check**

Run:

```powershell
python -c "from backend.gateway.simulators.s9_simulator import S9Simulator; s=S9Simulator('S9_01','127.0.0.1',50001); print(s.register_event()['event'])"
```

Expected output:

```text
REGISTERED
```

- [ ] **Step 3: Commit**

Run:

```powershell
git status --short
git add backend\gateway\simulators\s9_simulator.py
git commit -m "feat: add S9 simulator"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and continue.

## Task 9: Gateway API Router

**Files:**

- Create: `backend/gateway/api.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create Gateway API router**

Create `backend/gateway/api.py`:

```python
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .models import CallRequest, DeviceHealth
from .registry import DeviceRegistry
from .router import CallRouter
from .session_manager import CallSessionManager


gateway_api_router = APIRouter(prefix="/gateway", tags=["gateway"])

device_registry = DeviceRegistry()
session_manager = CallSessionManager()
call_router = CallRouter(registry=device_registry, sessions=session_manager)


class RegisterDevicePayload(BaseModel):
    device_id: str
    ip_address: str
    app_version: str | None = None
    audio_port: int | None = None


class HealthPayload(BaseModel):
    battery_percent: int | None = None
    temperature_c: float | None = None
    signal_dbm: int | None = None
    charging: bool | None = None
    network_type: str | None = None
    storage_free_mb: int | None = None


class DialPayload(BaseModel):
    phone_number: str
    campaign_id: str | None = None
    lead_id: str | None = None
    metadata: dict = {}


@gateway_api_router.get("/devices")
def list_gateway_devices():
    return [asdict(device) for device in device_registry.list_devices()]


@gateway_api_router.post("/devices/register")
def register_gateway_device(payload: RegisterDevicePayload):
    device = device_registry.register_device(
        device_id=payload.device_id,
        ip_address=payload.ip_address,
        app_version=payload.app_version,
        audio_port=payload.audio_port,
    )
    return asdict(device)


@gateway_api_router.post("/devices/{device_id}/heartbeat")
def heartbeat_gateway_device(device_id: str):
    try:
        device = device_registry.heartbeat(device_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc
    return asdict(device)


@gateway_api_router.post("/devices/{device_id}/health")
def update_gateway_device_health(device_id: str, payload: HealthPayload):
    try:
        device = device_registry.update_health(
            device_id,
            DeviceHealth(
                battery_percent=payload.battery_percent,
                temperature_c=payload.temperature_c,
                signal_dbm=payload.signal_dbm,
                charging=payload.charging,
                network_type=payload.network_type,
                storage_free_mb=payload.storage_free_mb,
            ),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc
    return asdict(device)


@gateway_api_router.post("/calls/dial")
def dial_gateway_call(payload: DialPayload):
    session = call_router.enqueue_and_allocate(
        CallRequest(
            phone_number=payload.phone_number,
            campaign_id=payload.campaign_id,
            lead_id=payload.lead_id,
            metadata=payload.metadata,
        )
    )
    return asdict(session)


@gateway_api_router.post("/calls/{call_id}/complete")
def complete_gateway_call(call_id: str):
    try:
        next_session = call_router.complete_call(call_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Call not found") from exc
    return {
        "completed_call_id": call_id,
        "next_session": asdict(next_session) if next_session else None,
    }


@gateway_api_router.get("/sessions")
def list_gateway_sessions():
    return [asdict(session) for session in session_manager.list_sessions()]
```

- [ ] **Step 2: Mount router in existing FastAPI app**

Modify `backend/main.py` near existing imports:

```python
from gateway.api import gateway_api_router
```

Modify `backend/main.py` after `app.include_router(api_router)`:

```python
app.include_router(gateway_api_router, prefix="/api/v1")
```

The final include area should look like:

```python
app.include_router(api_router)
app.include_router(gateway_api_router, prefix="/api/v1")
```

- [ ] **Step 3: Run API import smoke check**

Run:

```powershell
python -c "from backend.gateway.api import gateway_api_router; print(gateway_api_router.prefix)"
```

Expected output:

```text
/gateway
```

- [ ] **Step 4: Commit**

Run:

```powershell
git status --short
git add backend\gateway\api.py backend\main.py
git commit -m "feat: mount gateway API router"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and continue.

## Task 10: Full Gateway Core Test Run

**Files:**

- Verify all `backend/gateway` files.
- Verify all `backend/tests/gateway` tests.

- [ ] **Step 1: Run gateway test suite**

Run:

```powershell
python -m pytest backend\tests\gateway -v
```

Expected: all gateway tests PASS.

- [ ] **Step 2: Run existing backend test if Python environment supports it**

Run:

```powershell
python -m pytest backend\test_cases.py -v
```

Expected: existing test behavior is unchanged. If dependency mocks fail due local Python environment, capture the first failure line and do not change gateway code for unrelated dependency issues.

- [ ] **Step 3: Run TypeScript build check if node dependencies are installed**

Run:

```powershell
npm.cmd run lint
```

Expected if `node_modules` exists: TypeScript check completes or shows pre-existing unrelated errors. If `node_modules` does not exist, capture dependency errors and do not install packages unless explicitly approved.

- [ ] **Step 4: Write implementation notes**

Append to the final implementation response:

```text
Gateway core implemented:
- Device registry
- Call session manager
- Call router
- Audio packet protocol
- Control protocol
- AI adapter contract
- S9 simulator
- Gateway API router

Verification:
- Gateway pytest result: record the final summary line from `python -m pytest backend\tests\gateway -v`.
- Existing backend pytest result: record the final summary line from `python -m pytest backend\tests -v`.
- TypeScript check result: record the final summary line from `npm.cmd run lint`.
```

- [ ] **Step 5: Commit final gateway core slice**

Run:

```powershell
git status --short
git add backend\gateway backend\tests\gateway backend\main.py
git commit -m "feat: complete gateway core simulator slice"
```

Expected if repository exists: commit succeeds. If no `.git`, record the git error and leave the working tree changes in place.

## Self-Review

Spec coverage in this plan:

- Covers Gateway core, device registry, call router, session isolation, audio header contract, AI adapter contract, and simulators.
- Does not implement Flutter Android Agent APK; that needs a separate plan.
- Does not implement native/root audio bridge; that needs a separate plan after hardware/root feasibility is confirmed.
- Does not implement built-in STT/LLM/TTS agent; this plan only defines the adapter interface and silent simulator.
- Does not implement dashboard UI; this plan creates API surfaces for a later dashboard plan.

Completion scan:

- The plan contains no deferred-marker text and no unspecified file paths.
- Each code-producing step includes exact files and code blocks.

Type consistency:

- `CallRequest`, `CallSession`, `DeviceRecord`, `DeviceHealth`, `DeviceStatus`, and `CallState` are defined in Task 1 and reused consistently.
- `DeviceRegistry`, `CallSessionManager`, and `CallRouter` signatures match their tests.
- Audio protocol uses `AudioPacket` and `AudioDirection` consistently.
