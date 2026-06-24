from __future__ import annotations

from typing import Any

from backend.gateway.ai_adapter import AISessionEvent
from .conversation import ConversationRuntime
from .providers import STTProvider, StaticTranscriptSTTProvider
from .schemas import AISessionStart, AudioInputFrame


class RuntimeAIAdapter:
    def __init__(
        self,
        runtime: ConversationRuntime,
        stt_provider: STTProvider | None = None,
    ) -> None:
        self._runtime = runtime
        self._stt_provider = stt_provider or StaticTranscriptSTTProvider()
        self._seq: dict[str, int] = {}

    async def start_session(self, event: AISessionEvent) -> dict[str, Any]:
        start = AISessionStart(
            call_id=event.call_id,
            phone_number=event.phone_number,
            campaign_id=event.campaign_id,
            lead_id=event.lead_id,
            sample_rate=event.sample_rate,
            channels=event.channels,
        )
        self._seq[event.call_id] = 0
        await self._runtime.start_session(start)
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
        session = self._runtime.get_session(call_id)
        seq = self._seq.get(call_id, 0)
        self._seq[call_id] = seq + 1

        frame = AudioInputFrame(
            call_id=call_id,
            sequence_number=seq,
            timestamp_ms=seq * 20,
            pcm=pcm_frame,
        )

        turn = await self._stt_provider.transcribe(frame)
        if not turn:
            return []

        response = await self._runtime.handle_transcript(call_id, turn.text)
        return response.audio_frames

    async def end_session(self, call_id: str, reason: str) -> dict[str, Any]:
        self._seq.pop(call_id, None)
        result = await self._runtime.end_session(call_id, reason)
        return result.as_dict()
