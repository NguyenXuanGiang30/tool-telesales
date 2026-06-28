from backend.gateway.ai_runtime.schemas import (
    AIDisposition,
    AIResult,
    AISessionStart,
    AISessionState,
    ConversationSession,
    DialogReply,
    TranscriptTurn,
)


def test_ai_session_start_defaults_to_pcm16_mono_16k():
    start = AISessionStart(call_id="call-1", phone_number="0987654321")

    assert start.call_id == "call-1"
    assert start.sample_rate == 16000
    assert start.channels == 1
    assert start.codec == "pcm16"
    assert start.metadata == {}


def test_conversation_session_tracks_transcripts_and_responses():
    session = ConversationSession.from_start(
        AISessionStart(call_id="call-1", phone_number="0987654321")
    )
    turn = TranscriptTurn(call_id="call-1", text="toi quan tam")
    reply = DialogReply(
        text="Da, em se gui bao gia.",
        disposition=AIDisposition.INTERESTED,
        tags=["interested"],
        next_action="send_quote",
        complete=True,
    )

    session.add_transcript(turn)
    session.add_reply(reply)

    assert session.state == AISessionState.STARTED
    assert session.transcripts == [turn]
    assert session.replies == [reply]


def test_ai_result_serializes_business_outcome():
    result = AIResult(
        call_id="call-1",
        disposition=AIDisposition.CALLBACK,
        summary="Khach muon goi lai vao ngay mai.",
        tags=["callback"],
        next_action="schedule_callback",
    )

    assert result.as_dict() == {
        "type": "result",
        "call_id": "call-1",
        "disposition": "callback",
        "summary": "Khach muon goi lai vao ngay mai.",
        "tags": ["callback"],
        "next_action": "schedule_callback",
    }
