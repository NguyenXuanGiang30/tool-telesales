import asyncio

from backend.gateway.ai_runtime.builtin_agent import BuiltInConversationAgent
from backend.gateway.ai_runtime.providers import NoopTTSProvider, StaticTranscriptSTTProvider
from backend.gateway.ai_runtime.schemas import (
    AIDisposition,
    AISessionStart,
    AudioInputFrame,
    ConversationContext,
    ConversationSession,
    TranscriptTurn,
)


def run(coro):
    return asyncio.run(coro)


def make_context() -> ConversationContext:
    session = ConversationSession.from_start(
        AISessionStart(call_id="call-1", phone_number="0987654321")
    )
    return ConversationContext(session=session)


def test_builtin_agent_returns_greeting_on_start():
    agent = BuiltInConversationAgent()
    context = make_context()

    reply = run(agent.start_session(context))

    assert "Xin chao" in reply.text
    assert reply.complete is False
    assert reply.next_action == "none"


def test_builtin_agent_classifies_interested_customer():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="toi quan tam gui bao gia")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.INTERESTED
    assert "interested" in reply.tags
    assert reply.next_action == "send_quote"
    assert reply.complete is True


def test_builtin_agent_classifies_refusal_customer():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="khong can tu van dung goi nua")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.NOT_INTERESTED
    assert reply.tags == ["not_interested"]
    assert reply.next_action == "none"
    assert reply.complete is True


def test_builtin_agent_classifies_callback_customer():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="luc khac goi lai cho toi")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.CALLBACK
    assert reply.tags == ["callback"]
    assert reply.next_action == "schedule_callback"


def test_builtin_agent_classifies_human_request():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="cho toi gap nhan vien")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.HUMAN_REQUESTED
    assert reply.next_action == "transfer"
    assert reply.command == {"type": "transfer", "reason": "human_requested"}


def test_builtin_agent_classifies_accented_interested_customer():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="tôi quan tâm báo giá")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.INTERESTED
    assert reply.next_action == "send_quote"


def test_builtin_agent_classifies_accented_human_request():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="cho tôi gặp nhân viên")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.HUMAN_REQUESTED
    assert reply.next_action == "transfer"


def test_builtin_agent_classifies_accented_callback_customer():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="lúc khác gọi lại cho tôi")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.CALLBACK
    assert reply.next_action == "schedule_callback"


def test_builtin_agent_refusal_wins_over_interested_keywords():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="không cần tư vấn")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.NOT_INTERESTED
    assert reply.next_action == "none"


def test_builtin_agent_refusal_wins_over_callback_keywords():
    agent = BuiltInConversationAgent()
    context = make_context()
    turn = TranscriptTurn(call_id="call-1", text="đừng gọi lại cho tôi")

    reply = run(agent.generate_reply(context, turn))

    assert reply.disposition == AIDisposition.NOT_INTERESTED
    assert reply.tags == ["not_interested"]
    assert reply.next_action == "none"
    assert reply.complete is True


def test_noop_tts_provider_returns_empty_audio_frames():
    provider = NoopTTSProvider()
    context = make_context()

    frames = run(provider.synthesize("xin chao", context))

    assert frames == []


def test_static_transcript_stt_returns_none_without_configured_transcript():
    provider = StaticTranscriptSTTProvider()
    frame = AudioInputFrame(
        call_id="call-2", sequence_number=1, timestamp_ms=100, pcm=b"audio"
    )

    assert run(provider.transcribe(frame)) is None

    provider = StaticTranscriptSTTProvider("")

    assert run(provider.transcribe(frame)) is None


def test_static_transcript_stt_returns_turn_with_frame_call_id_and_text():
    provider = StaticTranscriptSTTProvider("xin chao")
    frame = AudioInputFrame(
        call_id="call-3", sequence_number=1, timestamp_ms=100, pcm=b"audio"
    )

    turn = run(provider.transcribe(frame))

    assert turn == TranscriptTurn(call_id="call-3", text="xin chao")
