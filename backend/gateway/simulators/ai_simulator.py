from __future__ import annotations

from backend.gateway.ai_adapter import AISessionEvent, SilentAIAdapter


class TextFrameAIAdapter(SilentAIAdapter):
    async def receive_audio(self, call_id: str, pcm_frame: bytes) -> list[bytes]:
        text = pcm_frame.decode("utf-8", errors="replace")
        if not text.startswith("TEXT:"):
            return []
        utterance = text.removeprefix("TEXT:").strip().lower()
        if "bao gia" in utterance:
            return [b"TEXT:Da, em se gui bao gia va tu van them cho anh chi."]
        return [b"TEXT:Da, em da nghe thong tin cua anh chi."]


def create_silent_ai_adapter() -> SilentAIAdapter:
    return SilentAIAdapter()


__all__ = ["AISessionEvent", "SilentAIAdapter", "create_silent_ai_adapter", "TextFrameAIAdapter"]
