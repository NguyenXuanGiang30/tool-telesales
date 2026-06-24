from __future__ import annotations

from collections import deque
from threading import RLock

from .models import CallRequest, CallSession, CallState
from .registry import DeviceRegistry
from .session_manager import CallSessionManager


class CallRouter:
    def __init__(self, registry: DeviceRegistry, sessions: CallSessionManager) -> None:
        self._registry = registry
        self._sessions = sessions
        self._queue: deque[str] = deque()
        self._lock = RLock()

    @property
    def queue_size(self) -> int:
        with self._lock:
            return len(self._queue)

    def enqueue_and_allocate(self, request: CallRequest) -> CallSession:
        with self._lock:
            session = self._sessions.create_queued_session(request)
            allocated = self._try_allocate(session.call_id)
            if allocated:
                return allocated
            self._queue.append(session.call_id)
            return session

    def complete_call(self, call_id: str) -> CallSession | None:
        with self._lock:
            session = self._sessions.get(call_id)
            self._remove_from_queue(call_id)
            if session.device_id:
                self._registry.release(session.device_id)
            self._sessions.mark_completed(call_id)
            return self._allocate_next_queued()

    def fail_call(self, call_id: str, reason: str) -> CallSession | None:
        with self._lock:
            session = self._sessions.get(call_id)
            self._remove_from_queue(call_id)
            if session.device_id:
                self._registry.release(session.device_id)
            self._sessions.mark_failed(call_id, reason)
            return self._allocate_next_queued()

    def _allocate_next_queued(self) -> CallSession | None:
        while self._queue:
            call_id = self._queue.popleft()
            if self._sessions.get(call_id).state != CallState.QUEUED:
                continue
            allocated = self._try_allocate(call_id)
            if allocated:
                return allocated
        return None

    def _remove_from_queue(self, call_id: str) -> None:
        try:
            self._queue.remove(call_id)
        except ValueError:
            return

    def _try_allocate(self, call_id: str) -> CallSession | None:
        device = self._registry.find_available_device()
        if not device:
            return None
        sim_slot = self._select_sim_slot(device)
        self._registry.mark_busy(device.device_id, call_id)
        return self._sessions.attach_device(
            call_id=call_id,
            device_id=device.device_id,
            sim_slot=sim_slot,
            audio_in_port=device.audio_port,
            audio_out_port=device.audio_port,
        )

    @staticmethod
    def _select_sim_slot(device) -> int:
        for slot in device.sim_slots:
            if slot.enabled:
                return slot.slot_id
        raise RuntimeError(f"Device {device.device_id} has no enabled SIM slot")
