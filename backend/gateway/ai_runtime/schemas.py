from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

from backend.gateway.models import utc_now


class AISessionState(str, Enum):
    STARTED = "started"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    COMPLETED = "completed"
    FAILED = "failed"


class AIDisposition(str, Enum):
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    CALLBACK = "callback"
    HUMAN_REQUESTED = "human_requested"
    NO_ANSWER = "no_answer"
    VOICEMAIL = "voicemail"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True)
class AISessionStart:
    call_id: str
    phone_number: str
    campaign_id: str | None = None
    lead_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    sample_rate: int = 16000
    channels: int = 1
    codec: str = "pcm16"


@dataclass(frozen=True)
class AudioInputFrame:
    call_id: str
    sequence_number: int
    timestamp_ms: int
    pcm: bytes


@dataclass(frozen=True)
class TranscriptTurn:
    call_id: str
    text: str
    confidence: float = 1.0
    started_at_ms: int | None = None
    ended_at_ms: int | None = None


@dataclass(frozen=True)
class DialogReply:
    text: str
    disposition: AIDisposition | None = None
    tags: list[str] = field(default_factory=list)
    next_action: str = "none"
    command: dict[str, Any] | None = None
    complete: bool = False


@dataclass(frozen=True)
class AssistantResponse:
    call_id: str
    text: str
    audio_frames: list[bytes] = field(default_factory=list)
    command: dict[str, Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AIResult:
    call_id: str
    disposition: AIDisposition
    summary: str
    tags: list[str] = field(default_factory=list)
    next_action: str = "none"

    def as_dict(self) -> dict[str, Any]:
        return {
            "type": "result",
            "call_id": self.call_id,
            "disposition": self.disposition.value,
            "summary": self.summary,
            "tags": list(self.tags),
            "next_action": self.next_action,
        }


@dataclass
class ConversationSession:
    call_id: str
    phone_number: str
    campaign_id: str | None = None
    lead_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    sample_rate: int = 16000
    channels: int = 1
    codec: str = "pcm16"
    state: AISessionState = AISessionState.STARTED
    transcripts: list[TranscriptTurn] = field(default_factory=list)
    replies: list[DialogReply] = field(default_factory=list)
    result: AIResult | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    @classmethod
    def from_start(cls, start: AISessionStart) -> "ConversationSession":
        return cls(
            call_id=start.call_id,
            phone_number=start.phone_number,
            campaign_id=start.campaign_id,
            lead_id=start.lead_id,
            metadata=dict(start.metadata),
            sample_rate=start.sample_rate,
            channels=start.channels,
            codec=start.codec,
        )

    def add_transcript(self, turn: TranscriptTurn) -> None:
        self.transcripts.append(turn)
        self.updated_at = utc_now()

    def add_reply(self, reply: DialogReply) -> None:
        self.replies.append(reply)
        self.updated_at = utc_now()


@dataclass(frozen=True)
class ConversationContext:
    session: ConversationSession

    @property
    def history(self) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []
        for index, turn in enumerate(self.session.transcripts):
            messages.append({"role": "user", "content": turn.text})
            if index < len(self.session.replies):
                messages.append(
                    {"role": "assistant", "content": self.session.replies[index].text}
                )
        return messages
