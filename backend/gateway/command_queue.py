from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from threading import RLock
from typing import Any
from uuid import uuid4

from .models import CommandName, utc_now


class CommandStatus(str, Enum):
    QUEUED = "queued"
    DELIVERED = "delivered"
    ACKED = "acked"
    NACKED = "nacked"
    EXPIRED = "expired"
    FAILED = "failed"


TERMINAL_STATUSES = {
    CommandStatus.ACKED,
    CommandStatus.NACKED,
    CommandStatus.EXPIRED,
    CommandStatus.FAILED,
}


@dataclass
class DeviceCommand:
    command_id: str
    device_id: str
    command: CommandName
    call_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    status: CommandStatus = CommandStatus.QUEUED
    attempt_count: int = 0
    created_at: datetime = field(default_factory=utc_now)
    delivered_at: datetime | None = None
    acknowledged_at: datetime | None = None
    expires_at: datetime | None = None
    last_error: str | None = None

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    def as_dict(self) -> dict[str, Any]:
        return {
            "command_id": self.command_id,
            "device_id": self.device_id,
            "command": self.command.value,
            "call_id": self.call_id,
            "payload": dict(self.payload),
            "status": self.status.value,
            "attempt_count": self.attempt_count,
            "created_at": self.created_at.isoformat(),
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "acknowledged_at": (
                self.acknowledged_at.isoformat() if self.acknowledged_at else None
            ),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_error": self.last_error,
        }


class DeviceCommandQueue:
    def __init__(self, default_ttl_seconds: int = 30) -> None:
        self._commands: dict[str, DeviceCommand] = {}
        self._order: list[str] = []
        self._default_ttl_seconds = default_ttl_seconds
        self._lock = RLock()

    def enqueue(
        self,
        device_id: str,
        command: CommandName,
        call_id: str | None = None,
        payload: dict[str, Any] | None = None,
        ttl_seconds: int | None = None,
        now: datetime | None = None,
    ) -> DeviceCommand:
        created_at = now or utc_now()
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl_seconds
        queued = DeviceCommand(
            command_id=str(uuid4()),
            device_id=device_id,
            command=command,
            call_id=call_id,
            payload=dict(payload or {}),
            created_at=created_at,
            expires_at=created_at + timedelta(seconds=ttl),
        )
        with self._lock:
            self._commands[queued.command_id] = queued
            self._order.append(queued.command_id)
            return queued

    def get(self, command_id: str) -> DeviceCommand:
        with self._lock:
            return self._commands[command_id]

    def list_for_device(self, device_id: str) -> list[DeviceCommand]:
        with self._lock:
            return [
                self._commands[command_id]
                for command_id in self._order
                if self._commands[command_id].device_id == device_id
            ]

    def next_for_device(
        self, device_id: str, now: datetime | None = None
    ) -> DeviceCommand | None:
        current_time = now or utc_now()
        with self._lock:
            self._expire_overdue_locked(current_time)
            for command_id in self._order:
                command = self._commands[command_id]
                if command.device_id != device_id or command.is_terminal:
                    continue
                command.status = CommandStatus.DELIVERED
                command.delivered_at = current_time
                command.attempt_count += 1
                return command
            return None

    def ack(
        self, device_id: str, command_id: str, now: datetime | None = None
    ) -> DeviceCommand:
        with self._lock:
            command = self._get_for_device_locked(device_id, command_id)
            command.status = CommandStatus.ACKED
            command.acknowledged_at = now or utc_now()
            command.last_error = None
            return command

    def nack(
        self,
        device_id: str,
        command_id: str,
        reason: str,
        now: datetime | None = None,
    ) -> DeviceCommand:
        with self._lock:
            command = self._get_for_device_locked(device_id, command_id)
            command.status = CommandStatus.NACKED
            command.acknowledged_at = now or utc_now()
            command.last_error = reason
            return command

    def expire_overdue(self, now: datetime | None = None) -> list[DeviceCommand]:
        with self._lock:
            return self._expire_overdue_locked(now or utc_now())

    def _expire_overdue_locked(self, now: datetime) -> list[DeviceCommand]:
        expired: list[DeviceCommand] = []
        for command in self._commands.values():
            if command.is_terminal or command.expires_at is None:
                continue
            if command.expires_at <= now:
                command.status = CommandStatus.EXPIRED
                command.last_error = "command_expired"
                expired.append(command)
        return expired

    def _get_for_device_locked(self, device_id: str, command_id: str) -> DeviceCommand:
        command = self._commands[command_id]
        if command.device_id != device_id:
            raise KeyError(command_id)
        return command
