from __future__ import annotations

from threading import RLock
from uuid import uuid4

from .models import CallRequest, CallSession, CallState, utc_now


class CallSessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, CallSession] = {}
        self._lock = RLock()

    def create_queued_session(self, request: CallRequest) -> CallSession:
        with self._lock:
            call_id = str(uuid4())
            session = CallSession(
                call_id=call_id,
                phone_number=request.phone_number,
                campaign_id=request.campaign_id,
                lead_id=request.lead_id,
                metadata=dict(request.metadata),
                state=CallState.QUEUED,
            )
            self._sessions[call_id] = session
            return session

    def get(self, call_id: str) -> CallSession:
        with self._lock:
            return self._sessions[call_id]

    def list_sessions(self) -> list[CallSession]:
        with self._lock:
            return list(self._sessions.values())

    def set_state(self, call_id: str, state: CallState) -> CallSession:
        with self._lock:
            session = self._sessions[call_id]
            session.state = state
            session.updated_at = utc_now()
            if state == CallState.CONNECTED and session.connected_at is None:
                session.connected_at = utc_now()
            if state in {CallState.COMPLETED, CallState.FAILED} and session.ended_at is None:
                session.ended_at = utc_now()
            return session

    def attach_device(
        self,
        call_id: str,
        device_id: str,
        sim_slot: int,
        audio_in_port: int | None,
        audio_out_port: int | None,
    ) -> CallSession:
        with self._lock:
            session = self._sessions[call_id]
            session.device_id = device_id
            session.sim_slot = sim_slot
            session.audio_in_port = audio_in_port
            session.audio_out_port = audio_out_port
            session.ai_session_id = call_id
            session.state = CallState.DIALING
            session.updated_at = utc_now()
            return session

    def mark_failed(self, call_id: str, reason: str) -> CallSession:
        with self._lock:
            session = self._sessions[call_id]
            session.state = CallState.FAILED
            session.failure_reason = reason
            session.updated_at = utc_now()
            session.ended_at = utc_now()
            return session

    def mark_completed(self, call_id: str) -> CallSession:
        with self._lock:
            session = self._sessions[call_id]
            session.state = CallState.COMPLETED
            session.updated_at = utc_now()
            session.ended_at = utc_now()
            return session
