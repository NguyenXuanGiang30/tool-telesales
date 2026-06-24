import asyncio

from backend.gateway.ai_adapter import AISessionEvent
from backend.gateway.ai_runtime.adapter import RuntimeAIAdapter
from backend.gateway.ai_runtime.builtin_agent import BuiltInConversationAgent
from backend.gateway.ai_runtime.conversation import ConversationRuntime
from backend.gateway.ai_runtime.providers import StaticTranscriptSTTProvider


def run(coro):
    return asyncio.run(coro)


def test_runtime_adapter_bridge_lifecycle():
    runtime = ConversationRuntime(dialog_provider=BuiltInConversationAgent())
    stt = StaticTranscriptSTTProvider(transcript="toi quan tam")
    adapter = RuntimeAIAdapter(runtime=runtime, stt_provider=stt)

    event = AISessionEvent(
        call_id="call-bridge-1",
        phone_number="0987654321",
        sample_rate=16000,
        channels=1,
    )

    start_res = run(adapter.start_session(event))
    assert start_res["type"] == "session.accepted"
    assert start_res["call_id"] == "call-bridge-1"

    audio_out = run(adapter.receive_audio("call-bridge-1", b"\x00" * 320))
    assert isinstance(audio_out, list)

    session = runtime.get_session("call-bridge-1")
    assert len(session.transcripts) == 1
    assert session.transcripts[0].text == "toi quan tam"

    end_res = run(adapter.end_session("call-bridge-1", reason="completed"))
    assert end_res["type"] == "result"
    assert end_res["call_id"] == "call-bridge-1"
    assert end_res["disposition"] == "interested"
    assert end_res["next_action"] == "send_quote"
