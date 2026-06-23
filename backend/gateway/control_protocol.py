from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from .models import CommandName, DeviceEventType


@dataclass(frozen=True)
class DeviceEvent:
    event: DeviceEventType
    device_id: str
    call_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)


def build_command(
    command: CommandName,
    call_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "type": "command",
        "command": command.value,
        "command_id": str(uuid4()),
        "call_id": call_id,
        "payload": payload or {},
    }


def parse_device_event(raw: dict[str, Any]) -> DeviceEvent:
    if raw.get("type") != "event":
        raise ValueError("device message type must be event")
    device_id = raw.get("device_id")
    if not device_id:
        raise ValueError("device_id is required")
    event_name = raw.get("event")
    if not event_name:
        raise ValueError("event is required")
    try:
        event = DeviceEventType(str(event_name))
    except ValueError as exc:
        raise ValueError(f"unsupported event: {event_name}") from exc
    payload = raw.get("payload") or {}
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    call_id = raw.get("call_id")
    return DeviceEvent(event=event, device_id=str(device_id), call_id=call_id, payload=payload)
