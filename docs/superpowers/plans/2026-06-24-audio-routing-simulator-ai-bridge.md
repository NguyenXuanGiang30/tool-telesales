# Audio Routing Simulator and AI Runtime Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route simulator/device audio packets to the correct AI runtime session and return AI output packets to the correct device/call.

**Architecture:** Add `AudioSessionRouter` as a focused backend service around existing `AudioPacket`, `CallSessionManager`, and `RuntimeAIAdapter`. The router validates active session ownership before forwarding PCM/text-frame payloads to AI and records per-call metrics.

**Tech Stack:** Python dataclasses, existing Gateway `AudioPacket`, AI runtime adapter, pytest.

---

## Task 1: Audio Metrics Model

**Files:**

- Create: `backend/gateway/audio_metrics.py`
- Test: `backend/tests/gateway/test_audio_metrics.py`

- [ ] **Step 1: Write failing metrics tests**

Create `backend/tests/gateway/test_audio_metrics.py`:

```python
from backend.gateway.audio_metrics import AudioMetricsRegistry


def test_records_input_output_bytes_and_packets():
    metrics = AudioMetricsRegistry()

    metrics.record_input(call_id="call-001", byte_count=160, sequence_number=1)
    metrics.record_input(call_id="call-001", byte_count=160, sequence_number=2)
    metrics.record_output(call_id="call-001", byte_count=320, sequence_number=1)

    snapshot = metrics.get("call-001")
    assert snapshot.packets_in == 2
    assert snapshot.bytes_in == 320
    assert snapshot.packets_out == 1
    assert snapshot.bytes_out == 320
    assert snapshot.dropped_input_sequences == 0


def test_counts_sequence_gaps_and_records_errors():
    metrics = AudioMetricsRegistry()

    metrics.record_input(call_id="call-002", byte_count=160, sequence_number=1)
    metrics.record_input(call_id="call-002", byte_count=160, sequence_number=4)
    metrics.record_error(call_id="call-002", error="unknown_call")

    snapshot = metrics.get("call-002")
    assert snapshot.dropped_input_sequences == 2
    assert snapshot.last_input_sequence == 4
    assert snapshot.last_error == "unknown_call"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_audio_metrics.py -v
```

Expected: FAIL because `backend.gateway.audio_metrics` does not exist.

- [ ] **Step 3: Implement metrics registry**

Create `backend/gateway/audio_metrics.py`:

```python
from __future__ import annotations

from dataclasses import asdict, dataclass
from threading import RLock


@dataclass
class AudioSessionMetrics:
    call_id: str
    device_id: str | None = None
    packets_in: int = 0
    packets_out: int = 0
    bytes_in: int = 0
    bytes_out: int = 0
    last_input_sequence: int | None = None
    last_output_sequence: int | None = None
    dropped_input_sequences: int = 0
    dropped_output_sequences: int = 0
    last_error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class AudioMetricsRegistry:
    def __init__(self) -> None:
        self._metrics: dict[str, AudioSessionMetrics] = {}
        self._lock = RLock()

    def get(self, call_id: str, device_id: str | None = None) -> AudioSessionMetrics:
        with self._lock:
            metrics = self._metrics.setdefault(call_id, AudioSessionMetrics(call_id=call_id, device_id=device_id))
            if device_id and metrics.device_id is None:
                metrics.device_id = device_id
            return metrics

    def list_all(self) -> list[AudioSessionMetrics]:
        with self._lock:
            return list(self._metrics.values())

    def record_input(self, call_id: str, byte_count: int, sequence_number: int, device_id: str | None = None) -> None:
        with self._lock:
            metrics = self.get(call_id, device_id)
            metrics.packets_in += 1
            metrics.bytes_in += byte_count
            if metrics.last_input_sequence is not None and sequence_number > metrics.last_input_sequence + 1:
                metrics.dropped_input_sequences += sequence_number - metrics.last_input_sequence - 1
            metrics.last_input_sequence = sequence_number

    def record_output(self, call_id: str, byte_count: int, sequence_number: int, device_id: str | None = None) -> None:
        with self._lock:
            metrics = self.get(call_id, device_id)
            metrics.packets_out += 1
            metrics.bytes_out += byte_count
            if metrics.last_output_sequence is not None and sequence_number > metrics.last_output_sequence + 1:
                metrics.dropped_output_sequences += sequence_number - metrics.last_output_sequence - 1
            metrics.last_output_sequence = sequence_number

    def record_error(self, call_id: str, error: str, device_id: str | None = None) -> None:
        with self._lock:
            self.get(call_id, device_id).last_error = error
```

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_audio_metrics.py -v
```

Expected: PASS.

Run:

```powershell
git add backend\gateway\audio_metrics.py backend\tests\gateway\test_audio_metrics.py
git commit -m "feat: add audio session metrics"
```

Expected: commit succeeds.

## Task 2: Audio Session Router

**Files:**

- Create: `backend/gateway/audio_router.py`
- Test: `backend/tests/gateway/test_audio_router.py`

- [ ] **Step 1: Write failing router tests**

Create `backend/tests/gateway/test_audio_router.py`:

```python
import pytest

from backend.gateway.audio_metrics import AudioMetricsRegistry
from backend.gateway.audio_protocol import AudioDirection, AudioPacket
from backend.gateway.audio_router import AudioRoutingError, AudioSessionRouter
from backend.gateway.models import CallRequest, CallState
from backend.gateway.registry import DeviceRegistry
from backend.gateway.session_manager import CallSessionManager


class EchoAIAdapter:
    async def receive_audio(self, call_id: str, pcm_frame: bytes) -> list[bytes]:
        return [b"AI:" + pcm_frame]


def connected_session():
    registry = DeviceRegistry()
    sessions = CallSessionManager()
    registry.register_device("s9-001", "127.0.0.1", audio_port=46001)
    session = sessions.create_queued_session(CallRequest(phone_number="+84901234567"))
    sessions.attach_device(session.call_id, "s9-001", sim_slot=1, audio_in_port=46001, audio_out_port=46002)
    sessions.set_state(session.call_id, CallState.CONNECTED)
    return registry, sessions, session


def make_packet(call_id: str, device_id: str = "s9-001") -> AudioPacket:
    return AudioPacket(
        direction=AudioDirection.CUSTOMER_TO_AI,
        call_id=call_id,
        device_id=device_id,
        sequence_number=1,
        timestamp_ms=1,
        sample_rate=16000,
        channels=1,
        payload=b"hello",
    )


@pytest.mark.asyncio
async def test_routes_customer_audio_to_ai_and_returns_ai_packets():
    registry, sessions, session = connected_session()
    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=EchoAIAdapter(), metrics=AudioMetricsRegistry())

    responses = await router.handle_packet(make_packet(session.call_id))

    assert responses[0].direction == AudioDirection.AI_TO_CUSTOMER
    assert responses[0].payload == b"AI:hello"
    assert responses[0].device_id == "s9-001"


@pytest.mark.asyncio
async def test_rejects_wrong_device_for_call():
    registry, sessions, session = connected_session()
    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=EchoAIAdapter(), metrics=AudioMetricsRegistry())

    with pytest.raises(AudioRoutingError, match="device_mismatch"):
        await router.handle_packet(make_packet(session.call_id, device_id="s9-other"))
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_audio_router.py -v
```

Expected: FAIL because `backend.gateway.audio_router` does not exist.

- [ ] **Step 3: Implement async router**

Create `backend/gateway/audio_router.py`:

```python
from __future__ import annotations

from backend.gateway.ai_adapter import AIAdapter
from backend.gateway.audio_metrics import AudioMetricsRegistry
from backend.gateway.audio_protocol import AudioDirection, AudioPacket
from backend.gateway.models import CallState
from backend.gateway.registry import DeviceRegistry
from backend.gateway.session_manager import CallSessionManager


class AudioRoutingError(RuntimeError):
    pass


ACTIVE_AUDIO_STATES = {CallState.CONNECTED, CallState.AI_LISTENING, CallState.AI_THINKING, CallState.AI_SPEAKING}


class AudioSessionRouter:
    def __init__(self, sessions: CallSessionManager, registry: DeviceRegistry, ai_adapter: AIAdapter, metrics: AudioMetricsRegistry) -> None:
        self._sessions = sessions
        self._registry = registry
        self._ai_adapter = ai_adapter
        self._metrics = metrics

    async def handle_packet(self, packet: AudioPacket) -> list[AudioPacket]:
        if packet.direction != AudioDirection.CUSTOMER_TO_AI:
            self._metrics.record_error(packet.call_id, "invalid_direction", packet.device_id)
            raise AudioRoutingError("invalid_direction")

        try:
            session = self._sessions.get(packet.call_id)
        except KeyError as exc:
            self._metrics.record_error(packet.call_id, "unknown_call", packet.device_id)
            raise AudioRoutingError("unknown_call") from exc

        if session.state not in ACTIVE_AUDIO_STATES:
            self._metrics.record_error(packet.call_id, "call_not_active", packet.device_id)
            raise AudioRoutingError("call_not_active")
        if session.device_id != packet.device_id:
            self._metrics.record_error(packet.call_id, "device_mismatch", packet.device_id)
            raise AudioRoutingError("device_mismatch")

        self._registry.get_device(packet.device_id)
        self._metrics.record_input(packet.call_id, len(packet.payload), packet.sequence_number, packet.device_id)
        frames = await self._ai_adapter.receive_audio(packet.call_id, packet.payload)

        responses: list[AudioPacket] = []
        for index, frame in enumerate(frames, start=1):
            self._metrics.record_output(packet.call_id, len(frame), index, packet.device_id)
            responses.append(
                AudioPacket(
                    direction=AudioDirection.AI_TO_CUSTOMER,
                    call_id=packet.call_id,
                    device_id=packet.device_id,
                    sequence_number=index,
                    timestamp_ms=packet.timestamp_ms,
                    sample_rate=packet.sample_rate,
                    channels=packet.channels,
                    payload=frame,
                )
            )
        return responses
```

- [ ] **Step 4: Add ended-call and unknown-call tests**

Append tests that assert:

```python
with pytest.raises(AudioRoutingError, match="unknown_call"):
    await router.handle_packet(make_packet("missing-call"))

sessions.set_state(session.call_id, CallState.COMPLETED)
with pytest.raises(AudioRoutingError, match="call_not_active"):
    await router.handle_packet(make_packet(session.call_id))
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_audio_router.py -v
```

Expected: PASS.

Run:

```powershell
git add backend\gateway\audio_router.py backend\tests\gateway\test_audio_router.py
git commit -m "feat: add session-aware audio router"
```

Expected: commit succeeds.

## Task 3: Simulator Text-Frame Audio Flow

**Files:**

- Modify: `backend/gateway/simulators/s9_simulator.py`
- Modify: `backend/gateway/simulators/ai_simulator.py`
- Test: `backend/tests/gateway/test_audio_simulator_flow.py`

- [ ] **Step 1: Write failing simulator flow test**

Create `backend/tests/gateway/test_audio_simulator_flow.py`:

```python
import pytest

from backend.gateway.audio_metrics import AudioMetricsRegistry
from backend.gateway.audio_protocol import AudioDirection
from backend.gateway.audio_router import AudioSessionRouter
from backend.gateway.models import CallRequest, CallState
from backend.gateway.registry import DeviceRegistry
from backend.gateway.session_manager import CallSessionManager
from backend.gateway.simulators.ai_simulator import TextFrameAIAdapter
from backend.gateway.simulators.s9_simulator import S9Simulator


@pytest.mark.asyncio
async def test_text_frame_round_trip_returns_ai_text_response():
    registry = DeviceRegistry()
    sessions = CallSessionManager()
    simulator = S9Simulator(device_id="s9-001", ip_address="127.0.0.1", audio_port=46001)
    registry.register_device(simulator.device_id, simulator.ip_address, audio_port=simulator.audio_port)
    session = sessions.create_queued_session(CallRequest(phone_number="+84901234567"))
    sessions.attach_device(session.call_id, simulator.device_id, sim_slot=1, audio_in_port=46001, audio_out_port=46002)
    sessions.set_state(session.call_id, CallState.CONNECTED)

    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=TextFrameAIAdapter(), metrics=AudioMetricsRegistry())
    responses = await router.handle_packet(simulator.customer_text_packet(session.call_id, "toi quan tam bao gia"))

    assert responses[0].direction == AudioDirection.AI_TO_CUSTOMER
    assert responses[0].payload.startswith(b"TEXT:")
    assert b"bao gia" in responses[0].payload
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_audio_simulator_flow.py -v
```

Expected: FAIL because `customer_text_packet` and `TextFrameAIAdapter` do not exist.

- [ ] **Step 3: Add simulator text-packet helper**

Modify `backend/gateway/simulators/s9_simulator.py` by importing `AudioDirection` and `AudioPacket`, then add this method inside `S9Simulator`:

```python
def customer_text_packet(self, call_id: str, text: str, sequence_number: int = 1) -> AudioPacket:
    return AudioPacket(
        direction=AudioDirection.CUSTOMER_TO_AI,
        call_id=call_id,
        device_id=self.device_id,
        sequence_number=sequence_number,
        timestamp_ms=1,
        sample_rate=16000,
        channels=1,
        payload=f"TEXT:{text}".encode("utf-8"),
    )
```

- [ ] **Step 4: Add deterministic simulator AI adapter**

Modify `backend/gateway/simulators/ai_simulator.py`:

```python
class TextFrameAIAdapter(SilentAIAdapter):
    async def receive_audio(self, call_id: str, pcm_frame: bytes) -> list[bytes]:
        text = pcm_frame.decode("utf-8", errors="replace")
        if not text.startswith("TEXT:"):
            return []
        utterance = text.removeprefix("TEXT:").strip().lower()
        if "bao gia" in utterance:
            return [b"TEXT:Da, em se gui bao gia va tu van them cho anh chi."]
        return [b"TEXT:Da, em da nghe thong tin cua anh chi."]
```

Update `__all__` so `TextFrameAIAdapter` is exported.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_audio_simulator_flow.py backend\tests\gateway\test_audio_router.py -v
```

Expected: PASS.

Run:

```powershell
git add backend\gateway\simulators backend\tests\gateway\test_audio_simulator_flow.py
git commit -m "feat: route simulator audio into AI runtime"
```

Expected: commit succeeds.

## Task 4: Audio Metrics API

**Files:**

- Modify: `backend/gateway/api.py`
- Test: `backend/tests/gateway/test_api.py`

- [ ] **Step 1: Write failing API test**

Append to `backend/tests/gateway/test_api.py`:

```python
from backend.gateway.api import audio_metrics


def test_lists_audio_metrics(client):
    audio_metrics.record_input("call-metrics-001", 160, 1, "s9-001")
    audio_metrics.record_output("call-metrics-001", 240, 1, "s9-001")

    response = client.get("/api/v1/gateway/audio/metrics")

    assert response.status_code == 200
    assert response.json()[0]["call_id"] == "call-metrics-001"
    assert response.json()[0]["packets_in"] == 1
    assert response.json()[0]["packets_out"] == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_api.py -v
```

Expected: FAIL because `audio_metrics` and `/audio/metrics` do not exist.

- [ ] **Step 3: Add metrics endpoint**

Modify `backend/gateway/api.py`:

```python
from .audio_metrics import AudioMetricsRegistry

audio_metrics = AudioMetricsRegistry()


@gateway_api_router.get("/audio/metrics")
def list_audio_metrics():
    return [metrics.to_dict() for metrics in audio_metrics.list_all()]
```

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_api.py -v
```

Expected: PASS.

Run:

```powershell
git add backend\gateway\api.py backend\tests\gateway\test_api.py
git commit -m "feat: expose audio metrics API"
```

Expected: commit succeeds.

## Task 5: Package Verification

- [ ] **Step 1: Run Gateway package tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
```

Expected: PASS.

- [ ] **Step 2: Run AI runtime tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime -v
```

Expected: PASS.

- [ ] **Step 3: Run frontend type check because dashboard consumes metrics later**

Run:

```powershell
npm.cmd run lint
```

Expected: exit code 0.

- [ ] **Step 4: Check branch status**

Run:

```powershell
git status --short --branch
```

Expected: only intended package files are modified or working tree is clean after commits.

---

## Detailed File Contracts

### `backend/gateway/audio_metrics.py`

Required public API:

```python
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class AudioSessionMetrics:
    call_id: str
    device_id: str
    packets_in: int = 0
    packets_out: int = 0
    bytes_in: int = 0
    bytes_out: int = 0
    last_input_sequence: int | None = None
    dropped_input_sequences: int = 0
    last_packet_at: datetime | None = None
    last_error: str | None = None

    def as_dict(self) -> dict:
        return {
            "call_id": self.call_id,
            "device_id": self.device_id,
            "packets_in": self.packets_in,
            "packets_out": self.packets_out,
            "bytes_in": self.bytes_in,
            "bytes_out": self.bytes_out,
            "last_input_sequence": self.last_input_sequence,
            "dropped_input_sequences": self.dropped_input_sequences,
            "last_packet_at": self.last_packet_at.isoformat() if self.last_packet_at else None,
            "last_error": self.last_error,
        }
```

`AudioMetricsRegistry` methods:

```python
class AudioMetricsRegistry:
    def get(self, call_id: str, device_id: str) -> AudioSessionMetrics:
        return AudioSessionMetrics(call_id=call_id, device_id=device_id)

    def record_input(self, call_id: str, device_id: str, sequence_number: int, byte_count: int) -> AudioSessionMetrics:
        return self.get(call_id, device_id)

    def record_output(self, call_id: str, device_id: str, byte_count: int) -> AudioSessionMetrics:
        return self.get(call_id, device_id)

    def record_error(self, call_id: str, device_id: str, error: str) -> AudioSessionMetrics:
        return self.get(call_id, device_id)

    def list_all(self) -> list[AudioSessionMetrics]:
        return []
```

Sequence gap rule:

- First input sequence sets `last_input_sequence`.
- If next sequence is exactly previous + 1, dropped count is unchanged.
- If next sequence is greater than previous + 1, add the missing count.
- If next sequence is lower or equal, do not decrement counters; record `last_error = "out_of_order_sequence"`.

### `backend/gateway/audio_router.py`

Required public API:

```python
class AudioRoutingError(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


class AudioSessionRouter:
    def __init__(
        self,
        sessions: CallSessionManager,
        registry: DeviceRegistry,
        ai_adapter: AIAdapter,
        metrics: AudioMetricsRegistry,
    ) -> None:
        self._sessions = sessions
        self._registry = registry
        self._ai_adapter = ai_adapter
        self._metrics = metrics

    async def handle_packet(self, packet: AudioPacket) -> list[AudioPacket]:
        raise AudioRoutingError("not_initialized")
```

Validation reasons:

- `unknown_call`
- `device_mismatch`
- `call_not_active`
- `invalid_direction`

Output packet rules:

- Direction is `AudioDirection.AI_TO_CUSTOMER`.
- `call_id` and `device_id` match input packet.
- `sequence_number` starts at 0 per output response and increments for each returned audio frame.
- `timestamp_ms` uses input timestamp for the first frame and adds 20 ms per additional frame.
- `sample_rate` and `channels` match input packet.

### `backend/gateway/simulators/s9_simulator.py`

Add:

```python
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
```

The payload must be:

```python
f"TEXT:{text}".encode("utf-8")
```

### `backend/gateway/api.py`

Audio metrics endpoint:

```text
GET /api/v1/gateway/audio/metrics
```

Response:

```json
[
  {
    "call_id": "call-1",
    "device_id": "S9_01",
    "packets_in": 3,
    "packets_out": 1,
    "bytes_in": 960,
    "bytes_out": 320,
    "last_input_sequence": 3,
    "dropped_input_sequences": 0,
    "last_packet_at": "2026-06-24T10:00:00",
    "last_error": null
  }
]
```

---

## Detailed Test Matrix

### Metrics tests

- First input packet sets counters to one packet and byte length.
- Sequential input packets do not increment dropped count.
- Sequence gap from 1 to 4 increments dropped count by 2.
- Out-of-order sequence records `out_of_order_sequence`.
- Output packets increment `packets_out` and `bytes_out`.
- `list_all` returns all tracked calls.

### Router tests

Setup for valid route:

1. Create `DeviceRegistry`.
2. Create `CallSessionManager`.
3. Register device `S9_AUDIO_01`.
4. Create queued session with phone number.
5. Attach device to session.
6. Build `ConversationRuntime` with `BuiltInConversationAgent`.
7. Build `RuntimeAIAdapter`.
8. Build `AudioSessionRouter`.
9. Send `AudioPacket(CUSTOMER_TO_AI, payload=b"TEXT:toi quan tam bao gia")`.

Assertions:

- AI session result disposition is `interested`.
- Metrics has `packets_in == 1`.
- No output packet is required when `NoopTTSProvider` is used.

Rejection tests:

- Unknown call raises `AudioRoutingError("unknown_call")`.
- Packet from `S9_WRONG` for call owned by `S9_AUDIO_01` raises `wrong_device_for_call`.
- Completed session raises `call_already_ended`.
- `AI_TO_CUSTOMER` input into `handle_packet` raises `unsupported_direction`.
- Metrics `last_error` is updated for each rejected packet when call/device can be identified.

### API tests

- Empty metrics registry returns `[]`.
- After direct registry record, metrics endpoint returns the recorded item.
- Datetime fields serialize as strings or `null`.

---

## Integration Flow

The intended simulator flow after this package:

```text
S9Simulator.customer_text_packet(call_id, "toi quan tam bao gia")
  -> AudioSessionRouter.handle_packet(packet)
  -> RuntimeAIAdapter.receive_audio(call_id, b"TEXT:toi quan tam bao gia")
  -> ConversationRuntime.handle_transcript(call_id, "toi quan tam bao gia")
  -> BuiltInConversationAgent generates interested result
  -> AudioMetricsRegistry records packet
```

This flow is the hardware-free proof that Gateway session routing and AI session routing are correctly joined.

---

## Delivery Gate

This package is complete only when:

- `backend/tests/gateway/test_audio_metrics.py` passes.
- `backend/tests/gateway/test_audio_router.py` passes.
- `backend/tests/gateway/test_audio_simulator_flow.py` passes.
- Full `backend/tests/gateway -v` passes.
- AI runtime tests pass.
- TypeScript lint still passes.
