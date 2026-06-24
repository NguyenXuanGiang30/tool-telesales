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

        context = ConversationContext(session)
        reply = await self._dialog_provider.start_session(context)
        audio_frames = await self._tts_provider.synthesize(reply.text, context)

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

        audio_frames = await self._tts_provider.synthesize(reply.text, context)

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
