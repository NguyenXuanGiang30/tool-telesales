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
