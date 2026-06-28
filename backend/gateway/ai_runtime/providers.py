from __future__ import annotations

from typing import Protocol

from backend.gateway.ai_runtime.schemas import (
    AudioInputFrame,
    ConversationContext,
    DialogReply,
    TranscriptTurn,
)


class STTProvider(Protocol):
    async def transcribe(self, frame: AudioInputFrame) -> TranscriptTurn | None:
        """Return a transcript turn when enough audio has been received."""


class DialogProvider(Protocol):
    async def start_session(self, context: ConversationContext) -> DialogReply:
        """Generate the first assistant reply for a session."""

    async def generate_reply(
        self, context: ConversationContext, turn: TranscriptTurn
    ) -> DialogReply:
        """Generate an assistant reply for a customer transcript turn."""


class TTSProvider(Protocol):
    async def synthesize(self, text: str, context: ConversationContext) -> list[bytes]:
        """Convert assistant text into audio frames."""


class NoopTTSProvider:
    async def synthesize(self, text: str, context: ConversationContext) -> list[bytes]:
        return []


class StaticTranscriptSTTProvider:
    def __init__(self, transcript: str | None = None) -> None:
        self.transcript = transcript

    async def transcribe(self, frame: AudioInputFrame) -> TranscriptTurn | None:
        if not self.transcript:
            return None
        return TranscriptTurn(call_id=frame.call_id, text=self.transcript)
