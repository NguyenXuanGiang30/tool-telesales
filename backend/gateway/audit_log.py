from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import uuid4

from .models import utc_now


@dataclass
class AuditEvent:
    event_type: str
    actor: str
    event_id: str = field(default_factory=lambda: str(uuid4()))
    device_id: str | None = None
    command_id: str | None = None
    call_id: str | None = None
    status: str | None = None
    reason: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: utc_now().isoformat())

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class AuditLog:
    def __init__(self, path: str | Path | None = None) -> None:
        self._path = Path(path) if path else None
        self._events: list[AuditEvent] = []
        self._lock = RLock()
        self._load()

    def record(
        self,
        event_type: str,
        actor: str,
        device_id: str | None = None,
        command_id: str | None = None,
        call_id: str | None = None,
        status: str | None = None,
        reason: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            event_type=event_type,
            actor=actor,
            device_id=device_id,
            command_id=command_id,
            call_id=call_id,
            status=status,
            reason=reason,
            metadata=dict(metadata or {}),
        )
        with self._lock:
            self._events.append(event)
            self._append(event)
            return event

    def list_events(self, device_id: str | None = None) -> list[AuditEvent]:
        with self._lock:
            if not device_id:
                return list(self._events)
            return [event for event in self._events if event.device_id == device_id]

    def clear(self) -> None:
        with self._lock:
            self._events.clear()
            if self._path:
                self._path.parent.mkdir(parents=True, exist_ok=True)
                self._path.write_text("", encoding="utf-8")

    def _load(self) -> None:
        if not self._path or not self._path.exists():
            return
        for line in self._path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            self._events.append(AuditEvent(**json.loads(line)))

    def _append(self, event: AuditEvent) -> None:
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event.as_dict(), ensure_ascii=False) + "\n")

