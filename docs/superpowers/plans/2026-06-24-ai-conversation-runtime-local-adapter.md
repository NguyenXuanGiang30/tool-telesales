# AI Conversation Runtime and Local Model Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a testable AI Conversation Runtime with a deterministic built-in agent and a local HTTP model adapter so customers can plug in their own local AI model without touching Boxphone device logic.

**Architecture:** Add a focused `backend/gateway/ai_runtime` package beside the Gateway core. The runtime owns AI session state keyed by `call_id`, delegates transcript handling to provider interfaces, and exposes an `AIAdapter` bridge so existing Gateway code can use it through the current adapter contract.

**Tech Stack:** Python 3.12, dataclasses, enums, protocols, asyncio, standard-library HTTP client/server for adapter tests, pytest, existing FastAPI-compatible backend structure.

---

## Scope Check

This plan implements only the AI runtime/local model slice from `docs/superpowers/specs/2026-06-24-ai-conversation-runtime-local-adapter-design.md`.

This plan implements:

- AI runtime schemas and errors.
- Provider interfaces for STT/dialog/TTS.
- Deterministic built-in conversation agent.
- Conversation runtime and per-call session isolation.
- Local HTTP model adapter for OpenAI-compatible and simple JSON responses.
- Bridge from the runtime into the existing `AIAdapter` contract.
- Tests and verification commands.

This plan does not implement:

- Flutter Android Agent.
- Native/root call audio bridge.
- Real STT model integration.
- Real TTS model integration.
- Dashboard UI.
- WebRTC/SRTP transport.

## File Structure

Create:

- `backend/gateway/ai_runtime/__init__.py`: package exports.
- `backend/gateway/ai_runtime/errors.py`: structured AI runtime/provider exceptions.
- `backend/gateway/ai_runtime/schemas.py`: AI session, turn, response, result, and enum dataclasses.
- `backend/gateway/ai_runtime/providers.py`: provider protocols plus simple no-op STT/TTS helpers.
- `backend/gateway/ai_runtime/builtin_agent.py`: deterministic built-in telesales dialog provider.
- `backend/gateway/ai_runtime/conversation.py`: `ConversationRuntime` and session store.
- `backend/gateway/ai_runtime/local_model_adapter.py`: local HTTP dialog provider.
- `backend/gateway/ai_runtime/adapter.py`: bridge implementing existing `AIAdapter` behavior.
- `backend/tests/gateway/ai_runtime/test_schemas.py`
- `backend/tests/gateway/ai_runtime/test_builtin_agent.py`
- `backend/tests/gateway/ai_runtime/test_conversation.py`
- `backend/tests/gateway/ai_runtime/test_local_model_adapter.py`
- `backend/tests/gateway/ai_runtime/test_adapter_bridge.py`

Modify:

- No existing Gateway core file is required for the first implementation. Existing imports remain stable.

## Task 1: AI Runtime Schemas and Errors

**Files:**

- Create: `backend/gateway/ai_runtime/__init__.py`
- Create: `backend/gateway/ai_runtime/errors.py`
- Create: `backend/gateway/ai_runtime/schemas.py`
- Test: `backend/tests/gateway/ai_runtime/test_schemas.py`

- [ ] **Step 1: Write failing schema tests**

Create `backend/tests/gateway/ai_runtime/test_schemas.py`:

```python
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
```

- [ ] **Step 2: Run schema tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_schemas.py -v
```

Expected: FAIL because `backend.gateway.ai_runtime.schemas` does not exist.

- [ ] **Step 3: Implement errors and schemas**

Create `backend/gateway/ai_runtime/__init__.py`:

```python
"""AI conversation runtime for Boxphone Gateway."""
```

Create `backend/gateway/ai_runtime/errors.py`:

```python
from __future__ import annotations


class AIRuntimeError(Exception):
    """Base error for AI runtime failures."""


class UnknownAISessionError(AIRuntimeError):
    def __init__(self, call_id: str) -> None:
        super().__init__(f"AI session not found: {call_id}")
        self.call_id = call_id


class AISessionAlreadyEndedError(AIRuntimeError):
    def __init__(self, call_id: str) -> None:
        super().__init__(f"AI session already ended: {call_id}")
        self.call_id = call_id


class AIProviderError(AIRuntimeError):
    def __init__(self, provider: str, message: str) -> None:
        super().__init__(f"{provider} provider failed: {message}")
        self.provider = provider
        self.message = message


class AIProviderTimeout(AIProviderError):
    def __init__(self, provider: str, timeout_ms: int) -> None:
        super().__init__(provider, f"timed out after {timeout_ms}ms")
        self.timeout_ms = timeout_ms


class AIProviderSchemaError(AIProviderError):
    def __init__(self, provider: str, message: str) -> None:
        super().__init__(provider, message)
```

Create `backend/gateway/ai_runtime/schemas.py`:

```python
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
```

- [ ] **Step 4: Run schema tests to verify they pass**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_schemas.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit schemas**

Run:

```powershell
git status --short
git add backend\gateway\ai_runtime\__init__.py backend\gateway\ai_runtime\errors.py backend\gateway\ai_runtime\schemas.py backend\tests\gateway\ai_runtime\test_schemas.py
git commit -m "feat: add AI runtime schemas"
```

Expected: commit succeeds.

## Task 2: Provider Interfaces and Built-in Agent

**Files:**

- Create: `backend/gateway/ai_runtime/providers.py`
- Create: `backend/gateway/ai_runtime/builtin_agent.py`
- Test: `backend/tests/gateway/ai_runtime/test_builtin_agent.py`

- [ ] **Step 1: Write failing built-in agent tests**

Create `backend/tests/gateway/ai_runtime/test_builtin_agent.py`:

```python
import asyncio

from backend.gateway.ai_runtime.builtin_agent import BuiltInConversationAgent
from backend.gateway.ai_runtime.schemas import (
    AIDisposition,
    AISessionStart,
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
    assert reply.command == {"type": "transfer", "reason": "human_requested"}
```

- [ ] **Step 2: Run built-in agent tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_builtin_agent.py -v
```

Expected: FAIL because `builtin_agent.py` does not exist.

- [ ] **Step 3: Implement provider contracts and built-in agent**

Create `backend/gateway/ai_runtime/providers.py`:

```python
from __future__ import annotations

from typing import Protocol

from .schemas import ConversationContext, DialogReply, TranscriptTurn


class STTProvider(Protocol):
    async def transcribe(
        self, call_id: str, pcm: bytes, sample_rate: int
    ) -> TranscriptTurn | None:
        raise RuntimeError("STTProvider.transcribe must be supplied by a concrete provider")


class DialogProvider(Protocol):
    async def start_session(self, context: ConversationContext) -> DialogReply:
        raise RuntimeError(
            "DialogProvider.start_session must be supplied by a concrete provider"
        )

    async def generate_reply(
        self, context: ConversationContext, turn: TranscriptTurn
    ) -> DialogReply:
        raise RuntimeError(
            "DialogProvider.generate_reply must be supplied by a concrete provider"
        )


class TTSProvider(Protocol):
    async def synthesize(self, call_id: str, text: str, sample_rate: int) -> list[bytes]:
        raise RuntimeError("TTSProvider.synthesize must be supplied by a concrete provider")


class NoopTTSProvider:
    async def synthesize(self, call_id: str, text: str, sample_rate: int) -> list[bytes]:
        return []


class StaticTranscriptSTTProvider:
    def __init__(self, transcript_text: str | None = None) -> None:
        self.transcript_text = transcript_text

    async def transcribe(
        self, call_id: str, pcm: bytes, sample_rate: int
    ) -> TranscriptTurn | None:
        if not self.transcript_text:
            return None
        return TranscriptTurn(call_id=call_id, text=self.transcript_text)
```

Create `backend/gateway/ai_runtime/builtin_agent.py`:

```python
from __future__ import annotations

from .schemas import AIDisposition, ConversationContext, DialogReply, TranscriptTurn


class BuiltInConversationAgent:
    greeting_text = (
        "Xin chao, em goi tu bo phan tu van. "
        "Em co the trao doi voi anh chi mot chut duoc khong?"
    )

    async def start_session(self, context: ConversationContext) -> DialogReply:
        return DialogReply(text=self.greeting_text)

    async def generate_reply(
        self, context: ConversationContext, turn: TranscriptTurn
    ) -> DialogReply:
        normalized = self._normalize(turn.text)
        if self._contains_any(normalized, ["nhan vien", "nguoi that", "tu van vien"]):
            return DialogReply(
                text="Da, em se chuyen anh chi cho nhan vien tu van.",
                disposition=AIDisposition.HUMAN_REQUESTED,
                tags=["human_requested"],
                next_action="transfer",
                command={"type": "transfer", "reason": "human_requested"},
                complete=True,
            )
        if self._contains_any(normalized, ["goi lai", "luc khac", "mai"]):
            return DialogReply(
                text="Da, em ghi nhan va se sap lich goi lai cho anh chi.",
                disposition=AIDisposition.CALLBACK,
                tags=["callback"],
                next_action="schedule_callback",
                complete=True,
            )
        if self._contains_any(normalized, ["khong", "ban", "khong can", "dung goi"]):
            return DialogReply(
                text="Da, em xin phep khong lam phien anh chi nua. Em cam on.",
                disposition=AIDisposition.NOT_INTERESTED,
                tags=["not_interested"],
                next_action="none",
                complete=True,
            )
        if self._contains_any(normalized, ["co", "duoc", "quan tam", "bao gia", "tu van"]):
            return DialogReply(
                text="Da, em se gui thong tin va bao gia cho anh chi.",
                disposition=AIDisposition.INTERESTED,
                tags=["interested", "send_quote"],
                next_action="send_quote",
                complete=True,
            )
        return DialogReply(
            text="Da, anh chi co the chia se them nhu cau de em tu van dung hon duoc khong?",
            tags=["needs_more_info"],
            next_action="continue_conversation",
            complete=False,
        )

    @staticmethod
    def _normalize(text: str) -> str:
        return " ".join(text.lower().strip().split())

    @staticmethod
    def _contains_any(text: str, keywords: list[str]) -> bool:
        return any(keyword in text for keyword in keywords)
```

- [ ] **Step 4: Run built-in agent tests to verify they pass**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_builtin_agent.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit providers and built-in agent**

Run:

```powershell
git status --short
git add backend\gateway\ai_runtime\providers.py backend\gateway\ai_runtime\builtin_agent.py backend\tests\gateway\ai_runtime\test_builtin_agent.py
git commit -m "feat: add built-in conversation agent"
```

Expected: commit succeeds.

## Task 3: Conversation Runtime

**Files:**

- Create: `backend/gateway/ai_runtime/conversation.py`
- Test: `backend/tests/gateway/ai_runtime/test_conversation.py`

- [ ] **Step 1: Write failing conversation runtime tests**

Create `backend/tests/gateway/ai_runtime/test_conversation.py`:

```python
import asyncio

from backend.gateway.ai_runtime.builtin_agent import BuiltInConversationAgent
from backend.gateway.ai_runtime.conversation import ConversationRuntime
from backend.gateway.ai_runtime.errors import UnknownAISessionError
from backend.gateway.ai_runtime.schemas import (
    AIDisposition,
    AISessionStart,
    AISessionState,
    ConversationContext,
    DialogReply,
    TranscriptTurn,
)


def run(coro):
    return asyncio.run(coro)


def test_runtime_starts_session_with_greeting_response():
    runtime = ConversationRuntime(dialog_provider=BuiltInConversationAgent())

    response = run(
        runtime.start_session(
            AISessionStart(call_id="call-1", phone_number="0987654321")
        )
    )

    assert response.call_id == "call-1"
    assert "Xin chao" in response.text
    assert runtime.get_session("call-1").state == AISessionState.LISTENING


def test_runtime_keeps_two_sessions_isolated():
    runtime = ConversationRuntime(dialog_provider=BuiltInConversationAgent())
    run(runtime.start_session(AISessionStart(call_id="call-1", phone_number="0901")))
    run(runtime.start_session(AISessionStart(call_id="call-2", phone_number="0902")))

    response_1 = run(runtime.handle_transcript("call-1", "toi quan tam bao gia"))
    response_2 = run(runtime.handle_transcript("call-2", "luc khac goi lai"))

    assert response_1.call_id == "call-1"
    assert response_2.call_id == "call-2"
    assert runtime.get_session("call-1").result.disposition == AIDisposition.INTERESTED
    assert runtime.get_session("call-2").result.disposition == AIDisposition.CALLBACK


def test_runtime_rejects_unknown_call_id():
    runtime = ConversationRuntime(dialog_provider=BuiltInConversationAgent())

    try:
        run(runtime.handle_transcript("missing-call", "xin chao"))
    except UnknownAISessionError as exc:
        assert exc.call_id == "missing-call"
    else:
        raise AssertionError("Expected UnknownAISessionError")


def test_runtime_ignores_late_provider_response_after_session_end():
    class SlowProvider:
        def __init__(self) -> None:
            self.started = asyncio.Event()
            self.release = asyncio.Event()

        async def start_session(self, context: ConversationContext) -> DialogReply:
            return DialogReply(text="hello")

        async def generate_reply(
            self, context: ConversationContext, turn: TranscriptTurn
        ) -> DialogReply:
            self.started.set()
            await self.release.wait()
            return DialogReply(
                text="late response",
                disposition=AIDisposition.INTERESTED,
                complete=True,
            )

    async def scenario():
        provider = SlowProvider()
        runtime = ConversationRuntime(dialog_provider=provider)
        await runtime.start_session(AISessionStart(call_id="call-1", phone_number="0901"))
        pending = asyncio.create_task(runtime.handle_transcript("call-1", "toi quan tam"))
        await provider.started.wait()
        result = await runtime.end_session("call-1", "customer_hangup")
        provider.release.set()
        late_response = await pending
        return runtime, result, late_response

    runtime, result, late_response = run(scenario())

    assert result.disposition == AIDisposition.COMPLETED
    assert late_response.metadata["ignored"] is True
    assert runtime.get_session("call-1").state == AISessionState.COMPLETED
    assert runtime.get_session("call-1").result.disposition == AIDisposition.COMPLETED
```

- [ ] **Step 2: Run conversation runtime tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_conversation.py -v
```

Expected: FAIL because `conversation.py` does not exist.

- [ ] **Step 3: Implement conversation runtime**

Create `backend/gateway/ai_runtime/conversation.py`:

```python
from __future__ import annotations

from threading import RLock

from .errors import AISessionAlreadyEndedError, UnknownAISessionError
from .providers import DialogProvider, NoopTTSProvider, TTSProvider
from .schemas import (
    AIDisposition,
    AIResult,
    AISessionStart,
    AISessionState,
    AssistantResponse,
    ConversationContext,
    ConversationSession,
    DialogReply,
    TranscriptTurn,
)


ENDED_STATES = {AISessionState.COMPLETED, AISessionState.FAILED}


class ConversationRuntime:
    def __init__(
        self,
        dialog_provider: DialogProvider,
        tts_provider: TTSProvider | None = None,
    ) -> None:
        self._dialog_provider = dialog_provider
        self._tts_provider = tts_provider or NoopTTSProvider()
        self._sessions: dict[str, ConversationSession] = {}
        self._lock = RLock()

    def get_session(self, call_id: str) -> ConversationSession:
        with self._lock:
            try:
                return self._sessions[call_id]
            except KeyError as exc:
                raise UnknownAISessionError(call_id) from exc

    def list_sessions(self) -> list[ConversationSession]:
        with self._lock:
            return list(self._sessions.values())

    async def start_session(self, start: AISessionStart) -> AssistantResponse:
        with self._lock:
            existing = self._sessions.get(start.call_id)
            if existing and existing.state not in ENDED_STATES:
                return AssistantResponse(
                    call_id=start.call_id,
                    text="",
                    metadata={"duplicate_start": True},
                )
            session = ConversationSession.from_start(start)
            self._sessions[start.call_id] = session

        reply = await self._dialog_provider.start_session(ConversationContext(session))
        audio_frames = await self._tts_provider.synthesize(
            start.call_id, reply.text, start.sample_rate
        )

        with self._lock:
            session.add_reply(reply)
            session.state = AISessionState.LISTENING

        return AssistantResponse(
            call_id=start.call_id,
            text=reply.text,
            audio_frames=audio_frames,
            command=reply.command,
        )

    async def handle_transcript(self, call_id: str, text: str) -> AssistantResponse:
        with self._lock:
            session = self.get_session(call_id)
            if session.state in ENDED_STATES:
                raise AISessionAlreadyEndedError(call_id)
            turn = TranscriptTurn(call_id=call_id, text=text)
            session.add_transcript(turn)
            session.state = AISessionState.THINKING
            context = ConversationContext(session=session)

        reply = await self._dialog_provider.generate_reply(context, turn)

        with self._lock:
            session = self.get_session(call_id)
            if session.state in ENDED_STATES:
                return AssistantResponse(
                    call_id=call_id,
                    text="",
                    metadata={"ignored": True, "reason": "session_already_ended"},
                )
            session.add_reply(reply)
            session.state = AISessionState.SPEAKING

        audio_frames = await self._tts_provider.synthesize(
            call_id, reply.text, session.sample_rate
        )

        with self._lock:
            session = self.get_session(call_id)
            if session.state in ENDED_STATES:
                return AssistantResponse(
                    call_id=call_id,
                    text="",
                    metadata={"ignored": True, "reason": "session_already_ended"},
                )
            if reply.complete:
                session.result = self._result_from_reply(call_id, reply)
                session.state = AISessionState.COMPLETED
            else:
                session.state = AISessionState.LISTENING

        return AssistantResponse(
            call_id=call_id,
            text=reply.text,
            audio_frames=audio_frames,
            command=reply.command,
        )

    async def end_session(self, call_id: str, reason: str) -> AIResult:
        with self._lock:
            session = self.get_session(call_id)
            if session.result is None:
                session.result = AIResult(
                    call_id=call_id,
                    disposition=AIDisposition.COMPLETED,
                    summary=f"Session ended with reason: {reason}",
                    tags=[],
                    next_action="none",
                )
            session.state = AISessionState.COMPLETED
            return session.result

    @staticmethod
    def _result_from_reply(call_id: str, reply: DialogReply) -> AIResult:
        disposition = reply.disposition or AIDisposition.COMPLETED
        return AIResult(
            call_id=call_id,
            disposition=disposition,
            summary=reply.text,
            tags=list(reply.tags),
            next_action=reply.next_action,
        )
```

- [ ] **Step 4: Run conversation runtime tests to verify they pass**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_conversation.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit conversation runtime**

Run:

```powershell
git status --short
git add backend\gateway\ai_runtime\conversation.py backend\tests\gateway\ai_runtime\test_conversation.py
git commit -m "feat: add AI conversation runtime"
```

Expected: commit succeeds.

## Task 4: Local Model HTTP Adapter

**Files:**

- Create: `backend/gateway/ai_runtime/local_model_adapter.py`
- Test: `backend/tests/gateway/ai_runtime/test_local_model_adapter.py`

- [ ] **Step 1: Write failing local model adapter tests**

Create `backend/tests/gateway/ai_runtime/test_local_model_adapter.py`:

```python
import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from backend.gateway.ai_runtime.errors import AIProviderSchemaError
from backend.gateway.ai_runtime.local_model_adapter import (
    LocalModelAdapterConfig,
    LocalModelHTTPAdapter,
)
from backend.gateway.ai_runtime.schemas import (
    AIDisposition,
    AISessionStart,
    ConversationContext,
    ConversationSession,
    TranscriptTurn,
)


def run(coro):
    return asyncio.run(coro)


class JsonHandler(BaseHTTPRequestHandler):
    response_body = {}
    status_code = 200
    requests = []

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        JsonHandler.requests.append(
            {
                "path": self.path,
                "authorization": self.headers.get("Authorization"),
                "body": json.loads(body.decode("utf-8")),
            }
        )
        self.send_response(JsonHandler.status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(JsonHandler.response_body).encode("utf-8"))

    def log_message(self, format, *args):
        return


class LocalServer:
    def __enter__(self):
        JsonHandler.requests = []
        self.server = HTTPServer(("127.0.0.1", 0), JsonHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"
        return self

    def __exit__(self, exc_type, exc, tb):
        self.server.shutdown()
        self.thread.join(timeout=2)


def make_context() -> ConversationContext:
    session = ConversationSession.from_start(
        AISessionStart(
            call_id="call-1",
            phone_number="0987654321",
            metadata={"name": "Anh A"},
        )
    )
    return ConversationContext(session=session)


def test_local_adapter_parses_simple_json_response():
    JsonHandler.status_code = 200
    JsonHandler.response_body = {
        "text": "Da, em se gui bao gia.",
        "disposition": "interested",
        "tags": ["interested"],
        "next_action": "send_quote",
    }
    with LocalServer() as server:
        adapter = LocalModelHTTPAdapter(
            LocalModelAdapterConfig(base_url=server.base_url, mode="simple_json")
        )
        reply = run(
            adapter.generate_reply(
                make_context(),
                TranscriptTurn(call_id="call-1", text="toi quan tam"),
            )
        )

    assert reply.text == "Da, em se gui bao gia."
    assert reply.disposition == AIDisposition.INTERESTED
    assert reply.tags == ["interested"]
    assert reply.next_action == "send_quote"
    assert JsonHandler.requests[0]["path"] == "/generate"
    assert JsonHandler.requests[0]["body"]["customer_text"] == "toi quan tam"


def test_local_adapter_parses_openai_chat_response():
    JsonHandler.status_code = 200
    JsonHandler.response_body = {
        "choices": [{"message": {"content": "Em da ghi nhan nhu cau."}}]
    }
    with LocalServer() as server:
        adapter = LocalModelHTTPAdapter(
            LocalModelAdapterConfig(
                base_url=server.base_url,
                mode="openai_chat",
                model="local-model",
                api_key="secret",
            )
        )
        reply = run(
            adapter.generate_reply(
                make_context(),
                TranscriptTurn(call_id="call-1", text="toi can tu van"),
            )
        )

    assert reply.text == "Em da ghi nhan nhu cau."
    assert reply.disposition is None
    assert JsonHandler.requests[0]["path"] == "/v1/chat/completions"
    assert JsonHandler.requests[0]["authorization"] == "Bearer secret"


def test_local_adapter_retries_http_5xx_then_succeeds():
    attempts = {"count": 0}

    class RetryHandler(JsonHandler):
        def do_POST(self):
            attempts["count"] += 1
            if attempts["count"] == 1:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"temporary failure")
                return
            JsonHandler.do_POST(self)

    JsonHandler.status_code = 200
    JsonHandler.response_body = {"text": "Da, em nghe anh chi.", "disposition": "completed"}
    server = HTTPServer(("127.0.0.1", 0), RetryHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        adapter = LocalModelHTTPAdapter(
            LocalModelAdapterConfig(
                base_url=f"http://127.0.0.1:{server.server_port}",
                mode="simple_json",
                max_retries=1,
            )
        )
        reply = run(
            adapter.generate_reply(
                make_context(),
                TranscriptTurn(call_id="call-1", text="xin chao"),
            )
        )
    finally:
        server.shutdown()
        thread.join(timeout=2)

    assert attempts["count"] == 2
    assert reply.text == "Da, em nghe anh chi."


def test_local_adapter_rejects_invalid_simple_json_schema():
    JsonHandler.status_code = 200
    JsonHandler.response_body = {"message": "missing text"}
    with LocalServer() as server:
        adapter = LocalModelHTTPAdapter(
            LocalModelAdapterConfig(base_url=server.base_url, mode="simple_json")
        )
        try:
            run(
                adapter.generate_reply(
                    make_context(),
                    TranscriptTurn(call_id="call-1", text="xin chao"),
                )
            )
        except AIProviderSchemaError as exc:
            assert exc.provider == "local_model"
            assert "text" in exc.message
        else:
            raise AssertionError("Expected AIProviderSchemaError")
```

- [ ] **Step 2: Run local model adapter tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_local_model_adapter.py -v
```

Expected: FAIL because `local_model_adapter.py` does not exist.

- [ ] **Step 3: Implement local model HTTP adapter**

Create `backend/gateway/ai_runtime/local_model_adapter.py`:

```python
from __future__ import annotations

import asyncio
import json
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from .errors import AIProviderError, AIProviderSchemaError, AIProviderTimeout
from .schemas import AIDisposition, ConversationContext, DialogReply, TranscriptTurn


@dataclass(frozen=True)
class LocalModelAdapterConfig:
    base_url: str
    mode: str = "simple_json"
    model: str = "local-model"
    api_key: str | None = None
    timeout_ms: int = 1200
    max_retries: int = 0


class LocalModelHTTPAdapter:
    provider_name = "local_model"

    def __init__(self, config: LocalModelAdapterConfig) -> None:
        self._config = config

    async def start_session(self, context: ConversationContext) -> DialogReply:
        return DialogReply(text="")

    async def generate_reply(
        self, context: ConversationContext, turn: TranscriptTurn
    ) -> DialogReply:
        request = self._build_request(context, turn)
        path = "/v1/chat/completions" if self._config.mode == "openai_chat" else "/generate"
        payload = await self._post_with_retries(path, request)
        if self._config.mode == "openai_chat":
            return self._parse_openai_chat(payload)
        if self._config.mode == "simple_json":
            return self._parse_simple_json(payload)
        raise AIProviderSchemaError(self.provider_name, f"unsupported mode: {self._config.mode}")

    def _build_request(
        self, context: ConversationContext, turn: TranscriptTurn
    ) -> dict[str, Any]:
        if self._config.mode == "openai_chat":
            messages = [
                {
                    "role": "system",
                    "content": "You are a concise Vietnamese telesales assistant.",
                }
            ]
            messages.extend(context.history)
            messages.append({"role": "user", "content": f"Khach vua noi: {turn.text}"})
            return {"model": self._config.model, "messages": messages, "temperature": 0.2}
        return {
            "call_id": context.session.call_id,
            "lead": {
                "phone_number": context.session.phone_number,
                "campaign_id": context.session.campaign_id,
                "lead_id": context.session.lead_id,
                "metadata": dict(context.session.metadata),
            },
            "history": context.history,
            "customer_text": turn.text,
        }

    async def _post_with_retries(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        attempts = self._config.max_retries + 1
        last_error: AIProviderError | None = None
        for _attempt in range(attempts):
            try:
                return await asyncio.to_thread(self._post_json, path, body)
            except AIProviderError as exc:
                last_error = exc
                if not self._is_retryable(exc):
                    raise
        if last_error:
            raise last_error
        raise AIProviderError(self.provider_name, "request failed without an exception")

    def _post_json(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = self._config.base_url.rstrip("/") + path
        headers = {"Content-Type": "application/json"}
        if self._config.api_key:
            headers["Authorization"] = f"Bearer {self._config.api_key}"
        request = urllib.request.Request(
            url=url,
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        timeout_seconds = self._config.timeout_ms / 1000
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except socket.timeout as exc:
            raise AIProviderTimeout(self.provider_name, self._config.timeout_ms) from exc
        except TimeoutError as exc:
            raise AIProviderTimeout(self.provider_name, self._config.timeout_ms) from exc
        except urllib.error.HTTPError as exc:
            if exc.code >= 500:
                raise AIProviderError(self.provider_name, f"http_{exc.code}") from exc
            raise AIProviderSchemaError(self.provider_name, f"http_{exc.code}") from exc
        except urllib.error.URLError as exc:
            raise AIProviderError(self.provider_name, str(exc.reason)) from exc
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AIProviderSchemaError(self.provider_name, "response is not valid JSON") from exc
        if not isinstance(payload, dict):
            raise AIProviderSchemaError(self.provider_name, "response JSON must be an object")
        return payload

    def _parse_openai_chat(self, payload: dict[str, Any]) -> DialogReply:
        try:
            text = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderSchemaError(
                self.provider_name, "OpenAI response must include choices[0].message.content"
            ) from exc
        if not isinstance(text, str) or not text.strip():
            raise AIProviderSchemaError(self.provider_name, "OpenAI response text is empty")
        return DialogReply(text=text.strip())

    def _parse_simple_json(self, payload: dict[str, Any]) -> DialogReply:
        text = payload.get("text")
        if not isinstance(text, str) or not text.strip():
            raise AIProviderSchemaError(self.provider_name, "simple response requires text")
        disposition = self._parse_disposition(payload.get("disposition"))
        tags = payload.get("tags") or []
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            raise AIProviderSchemaError(self.provider_name, "tags must be a list of strings")
        next_action = payload.get("next_action") or "none"
        if not isinstance(next_action, str):
            raise AIProviderSchemaError(self.provider_name, "next_action must be a string")
        return DialogReply(
            text=text.strip(),
            disposition=disposition,
            tags=tags,
            next_action=next_action,
            complete=disposition is not None,
        )

    @staticmethod
    def _parse_disposition(value: object) -> AIDisposition | None:
        if value in (None, ""):
            return None
        if not isinstance(value, str):
            raise AIProviderSchemaError("local_model", "disposition must be a string")
        try:
            return AIDisposition(value)
        except ValueError as exc:
            raise AIProviderSchemaError("local_model", f"unsupported disposition: {value}") from exc

    @staticmethod
    def _is_retryable(error: AIProviderError) -> bool:
        return isinstance(error, AIProviderError) and not isinstance(
            error, AIProviderSchemaError
        )
```

- [ ] **Step 4: Run local model adapter tests to verify they pass**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_local_model_adapter.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit local model adapter**

Run:

```powershell
git status --short
git add backend\gateway\ai_runtime\local_model_adapter.py backend\tests\gateway\ai_runtime\test_local_model_adapter.py
git commit -m "feat: add local model HTTP adapter"
```

Expected: commit succeeds.

## Task 5: Runtime Adapter Bridge

**Files:**

- Create: `backend/gateway/ai_runtime/adapter.py`
- Modify: `backend/gateway/ai_runtime/__init__.py`
- Test: `backend/tests/gateway/ai_runtime/test_adapter_bridge.py`

- [ ] **Step 1: Write failing adapter bridge tests**

Create `backend/tests/gateway/ai_runtime/test_adapter_bridge.py`:

```python
import asyncio

from backend.gateway.ai_adapter import AISessionEvent
from backend.gateway.ai_runtime.adapter import RuntimeAIAdapter
from backend.gateway.ai_runtime.builtin_agent import BuiltInConversationAgent
from backend.gateway.ai_runtime.conversation import ConversationRuntime


def run(coro):
    return asyncio.run(coro)


def make_adapter() -> RuntimeAIAdapter:
    runtime = ConversationRuntime(dialog_provider=BuiltInConversationAgent())
    return RuntimeAIAdapter(runtime)


def test_runtime_adapter_starts_session_through_existing_contract():
    adapter = make_adapter()

    response = run(
        adapter.start_session(
            AISessionEvent(
                call_id="call-1",
                phone_number="0987654321",
                sample_rate=16000,
                channels=1,
                campaign_id="camp-1",
                lead_id="lead-1",
            )
        )
    )

    assert response["type"] == "session.accepted"
    assert response["call_id"] == "call-1"
    assert "Xin chao" in response["text"]
    assert response["audio"]["codec"] == "pcm16"


def test_runtime_adapter_accepts_text_frames_for_deterministic_tests():
    adapter = make_adapter()
    run(
        adapter.start_session(
            AISessionEvent(
                call_id="call-1",
                phone_number="0987654321",
                sample_rate=16000,
                channels=1,
            )
        )
    )

    frames = run(adapter.receive_audio("call-1", b"TEXT:toi quan tam bao gia"))

    assert frames == []
    session = adapter.runtime.get_session("call-1")
    assert session.result.disposition.value == "interested"


def test_runtime_adapter_ends_session_with_result_dict():
    adapter = make_adapter()
    run(
        adapter.start_session(
            AISessionEvent(
                call_id="call-1",
                phone_number="0987654321",
                sample_rate=16000,
                channels=1,
            )
        )
    )

    result = run(adapter.end_session("call-1", "test_complete"))

    assert result["type"] == "result"
    assert result["call_id"] == "call-1"
    assert result["disposition"] == "completed"
```

- [ ] **Step 2: Run adapter bridge tests to verify they fail**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_adapter_bridge.py -v
```

Expected: FAIL because `adapter.py` does not exist.

- [ ] **Step 3: Implement RuntimeAIAdapter and package exports**

Create `backend/gateway/ai_runtime/adapter.py`:

```python
from __future__ import annotations

from backend.gateway.ai_adapter import AISessionEvent

from .conversation import ConversationRuntime
from .schemas import AISessionStart


class RuntimeAIAdapter:
    def __init__(self, runtime: ConversationRuntime) -> None:
        self.runtime = runtime

    async def start_session(self, event: AISessionEvent) -> dict:
        response = await self.runtime.start_session(
            AISessionStart(
                call_id=event.call_id,
                phone_number=event.phone_number,
                campaign_id=event.campaign_id,
                lead_id=event.lead_id,
                sample_rate=event.sample_rate,
                channels=event.channels,
            )
        )
        return {
            "type": "session.accepted",
            "call_id": event.call_id,
            "text": response.text,
            "audio": {
                "sample_rate": event.sample_rate,
                "channels": event.channels,
                "codec": "pcm16",
                "frames": len(response.audio_frames),
            },
        }

    async def receive_audio(self, call_id: str, pcm_frame: bytes) -> list[bytes]:
        if pcm_frame.startswith(b"TEXT:"):
            text = pcm_frame.removeprefix(b"TEXT:").decode("utf-8")
            response = await self.runtime.handle_transcript(call_id, text)
            return response.audio_frames
        return []

    async def end_session(self, call_id: str, reason: str) -> dict:
        result = await self.runtime.end_session(call_id, reason)
        return result.as_dict()
```

Replace `backend/gateway/ai_runtime/__init__.py` with:

```python
"""AI conversation runtime for Boxphone Gateway."""

from .adapter import RuntimeAIAdapter
from .builtin_agent import BuiltInConversationAgent
from .conversation import ConversationRuntime
from .local_model_adapter import LocalModelAdapterConfig, LocalModelHTTPAdapter
from .providers import NoopTTSProvider, StaticTranscriptSTTProvider
from .schemas import (
    AIDisposition,
    AIResult,
    AISessionStart,
    AISessionState,
    AssistantResponse,
    AudioInputFrame,
    ConversationContext,
    ConversationSession,
    DialogReply,
    TranscriptTurn,
)

__all__ = [
    "AIDisposition",
    "AIResult",
    "AISessionStart",
    "AISessionState",
    "AssistantResponse",
    "AudioInputFrame",
    "BuiltInConversationAgent",
    "ConversationContext",
    "ConversationRuntime",
    "ConversationSession",
    "DialogReply",
    "LocalModelAdapterConfig",
    "LocalModelHTTPAdapter",
    "NoopTTSProvider",
    "RuntimeAIAdapter",
    "StaticTranscriptSTTProvider",
    "TranscriptTurn",
]
```

- [ ] **Step 4: Run adapter bridge tests to verify they pass**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime\test_adapter_bridge.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit runtime adapter bridge**

Run:

```powershell
git status --short
git add backend\gateway\ai_runtime\adapter.py backend\gateway\ai_runtime\__init__.py backend\tests\gateway\ai_runtime\test_adapter_bridge.py
git commit -m "feat: bridge AI runtime to gateway adapter"
```

Expected: commit succeeds.

## Task 6: Full AI Runtime Verification

**Files:**

- No production file changes expected.

- [ ] **Step 1: Run AI runtime tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime -v
```

Expected: all AI runtime tests PASS.

- [ ] **Step 2: Run full gateway tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
```

Expected: all gateway tests PASS.

- [ ] **Step 3: Run TypeScript lint**

Run:

```powershell
npm.cmd run lint
```

Expected: TypeScript check completes with exit code 0.

- [ ] **Step 4: Check working tree**

Run:

```powershell
git status --short --branch
```

Expected: clean working tree on `feature/boxphone-gateway-core`.

- [ ] **Step 5: Write final implementation notes**

Include these exact result categories in the final implementation response:

```text
AI runtime tests: command and final pytest summary line.
Gateway tests: command and final pytest summary line.
TypeScript lint: command and exit status.
Branch status: output of git status --short --branch.
```

## Self-Review

Spec coverage:

- AI lifecycle is covered by Task 3.
- Provider interfaces are covered by Task 2.
- Built-in deterministic agent is covered by Task 2.
- Local HTTP model adapter is covered by Task 4.
- Adapter bridge for existing Gateway AI contract is covered by Task 5.
- Multi-session isolation and late response handling are covered by Task 3 tests.
- Verification is covered by Task 6.

Deferred by design:

- Real STT and real TTS providers remain separate future slices.
- Flutter Android Agent and audio bridge remain separate future slices.
- Dashboard UI remains a separate future slice.

Completion scan:

- The plan contains no deferred-marker text.
- Each code-producing task includes exact files, exact commands, and complete code blocks.

Type consistency:

- `AISessionStart`, `TranscriptTurn`, `DialogReply`, `AssistantResponse`, `AIResult`, `ConversationSession`, and `ConversationContext` are defined in Task 1 and reused in later tasks.
- `DialogProvider`, `NoopTTSProvider`, and `BuiltInConversationAgent` signatures match `ConversationRuntime` usage.
- `RuntimeAIAdapter` maps the existing `AISessionEvent` contract into `AISessionStart`.
