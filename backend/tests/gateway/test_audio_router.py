import asyncio
import pytest
from backend.gateway.audio_metrics import AudioMetricsRegistry
from backend.gateway.audio_protocol import AudioDirection, AudioPacket
from backend.gateway.audio_router import AudioRoutingError, AudioSessionRouter
from backend.gateway.models import CallRequest, CallState
from backend.gateway.registry import DeviceRegistry
from backend.gateway.session_manager import CallSessionManager


def run(coro):
    return asyncio.run(coro)


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


def make_packet(call_id: str, device_id: str = "s9-001", direction=AudioDirection.CUSTOMER_TO_AI) -> AudioPacket:
    return AudioPacket(
        direction=direction,
        call_id=call_id,
        device_id=device_id,
        sequence_number=1,
        timestamp_ms=1,
        sample_rate=16000,
        channels=1,
        payload=b"hello",
    )


def test_routes_customer_audio_to_ai_and_returns_ai_packets():
    registry, sessions, session = connected_session()
    metrics = AudioMetricsRegistry()
    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=EchoAIAdapter(), metrics=metrics)

    responses = run(router.handle_packet(make_packet(session.call_id)))

    assert len(responses) == 1
    assert responses[0].direction == AudioDirection.AI_TO_CUSTOMER
    assert responses[0].payload == b"AI:hello"
    assert responses[0].device_id == "s9-001"
    assert responses[0].sequence_number == 1

    snapshot = metrics.get(session.call_id, "s9-001")
    assert snapshot.packets_in == 1
    assert snapshot.packets_out == 1


def test_rejects_wrong_device_for_call():
    registry, sessions, session = connected_session()
    metrics = AudioMetricsRegistry()
    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=EchoAIAdapter(), metrics=metrics)

    with pytest.raises(AudioRoutingError) as exc_info:
        run(router.handle_packet(make_packet(session.call_id, device_id="s9-other")))
    assert exc_info.value.reason == "device_mismatch"

    snapshot = metrics.get(session.call_id, "s9-other")
    assert snapshot.last_error == "device_mismatch"


def test_rejects_unknown_call():
    registry, sessions, session = connected_session()
    metrics = AudioMetricsRegistry()
    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=EchoAIAdapter(), metrics=metrics)

    with pytest.raises(AudioRoutingError) as exc_info:
        run(router.handle_packet(make_packet("missing-call")))
    assert exc_info.value.reason == "unknown_call"

    snapshot = metrics.get("missing-call", "s9-001")
    assert snapshot.last_error == "unknown_call"


def test_rejects_inactive_call():
    registry, sessions, session = connected_session()
    sessions.set_state(session.call_id, CallState.COMPLETED)
    metrics = AudioMetricsRegistry()
    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=EchoAIAdapter(), metrics=metrics)

    with pytest.raises(AudioRoutingError) as exc_info:
        run(router.handle_packet(make_packet(session.call_id)))
    assert exc_info.value.reason == "call_not_active"

    snapshot = metrics.get(session.call_id, "s9-001")
    assert snapshot.last_error == "call_not_active"


def test_rejects_unsupported_direction():
    registry, sessions, session = connected_session()
    metrics = AudioMetricsRegistry()
    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=EchoAIAdapter(), metrics=metrics)

    with pytest.raises(AudioRoutingError) as exc_info:
        run(router.handle_packet(make_packet(session.call_id, direction=AudioDirection.AI_TO_CUSTOMER)))
    assert exc_info.value.reason == "invalid_direction"

    snapshot = metrics.get(session.call_id, "s9-001")
    assert snapshot.last_error == "invalid_direction"
