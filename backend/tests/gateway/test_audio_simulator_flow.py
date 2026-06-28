import asyncio
import pytest

from backend.gateway.audio_metrics import AudioMetricsRegistry
from backend.gateway.audio_protocol import AudioDirection
from backend.gateway.audio_router import AudioSessionRouter
from backend.gateway.models import CallRequest, CallState
from backend.gateway.registry import DeviceRegistry
from backend.gateway.session_manager import CallSessionManager
from backend.gateway.simulators.ai_simulator import TextFrameAIAdapter
from backend.gateway.simulators.s9_simulator import S9Simulator


def run(coro):
    return asyncio.run(coro)


def test_text_frame_round_trip_returns_ai_text_response():
    registry = DeviceRegistry()
    sessions = CallSessionManager()
    simulator = S9Simulator(device_id="s9-001", ip_address="127.0.0.1", audio_port=46001)
    registry.register_device(simulator.device_id, simulator.ip_address, audio_port=simulator.audio_port)
    session = sessions.create_queued_session(CallRequest(phone_number="+84901234567"))
    sessions.attach_device(session.call_id, simulator.device_id, sim_slot=1, audio_in_port=46001, audio_out_port=46002)
    sessions.set_state(session.call_id, CallState.CONNECTED)

    router = AudioSessionRouter(sessions=sessions, registry=registry, ai_adapter=TextFrameAIAdapter(), metrics=AudioMetricsRegistry())
    responses = run(router.handle_packet(simulator.customer_text_packet(session.call_id, "toi quan tam bao gia")))

    assert len(responses) == 1
    assert responses[0].direction == AudioDirection.AI_TO_CUSTOMER
    assert responses[0].payload.startswith(b"TEXT:")
    assert b"bao gia" in responses[0].payload
