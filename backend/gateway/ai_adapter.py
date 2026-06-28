from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AISessionEvent:
    call_id: str
    phone_number: str
    sample_rate: int
    channels: int
    campaign_id: str | None = None
    lead_id: str | None = None


class AIAdapter(Protocol):
    async def start_session(self, event: AISessionEvent) -> dict:
        ...

    async def receive_audio(self, call_id: str, pcm_frame: bytes) -> list[bytes]:
        ...

    async def end_session(self, call_id: str, reason: str) -> dict:
        ...


class SilentAIAdapter:
    def __init__(self) -> None:
        self.started_sessions: dict[str, AISessionEvent] = {}

    async def start_session(self, event: AISessionEvent) -> dict:
        self.started_sessions[event.call_id] = event
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
        if call_id not in self.started_sessions:
            raise KeyError(f"AI session not found: {call_id}")
        return []

    async def end_session(self, call_id: str, reason: str) -> dict:
        if call_id not in self.started_sessions:
            raise KeyError(f"AI session not found: {call_id}")
        self.started_sessions.pop(call_id)
        return {
            "type": "result",
            "call_id": call_id,
            "disposition": "completed",
            "summary": f"Session ended with reason: {reason}",
            "tags": [],
            "next_action": "none",
        }
