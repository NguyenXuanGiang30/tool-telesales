from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Any

from .command_queue import CommandStatus, DeviceCommand, DeviceCommandQueue
from .models import (
    CallSession,
    CallState,
    CommandName,
    DeviceHealth,
    DeviceRecord,
    DeviceStatus,
    SimSlot,
    utc_now,
)
from .registry import DeviceRegistry
from .session_manager import CallSessionManager


class GatewayStateStore:
    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        self._lock = RLock()
        self._init_db()

    def save(
        self,
        registry: DeviceRegistry,
        sessions: CallSessionManager,
        command_queue: DeviceCommandQueue,
    ) -> None:
        devices = [_device_to_payload(device) for device in registry.list_devices()]
        call_sessions = [
            _session_to_payload(session) for session in sessions.list_sessions()
        ]
        commands = [
            _command_to_payload(index, command)
            for index, command in enumerate(command_queue.list_all())
        ]

        with self._lock, self._connect() as connection:
            connection.execute("DELETE FROM gateway_state")
            self._insert_many(connection, "device", devices)
            self._insert_many(connection, "session", call_sessions)
            self._insert_many(connection, "command", commands)
            connection.commit()

    def load_into(
        self,
        registry: DeviceRegistry,
        sessions: CallSessionManager,
        command_queue: DeviceCommandQueue,
    ) -> None:
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                "SELECT kind, payload FROM gateway_state ORDER BY kind, key"
            ).fetchall()

        device_payloads: list[dict[str, Any]] = []
        session_payloads: list[dict[str, Any]] = []
        command_payloads: list[dict[str, Any]] = []

        for kind, payload_json in rows:
            payload = json.loads(payload_json)
            if kind == "device":
                device_payloads.append(payload)
            elif kind == "session":
                session_payloads.append(payload)
            elif kind == "command":
                command_payloads.append(payload)

        registry.replace_devices([_payload_to_device(item) for item in device_payloads])
        sessions.replace_sessions(
            [_payload_to_session(item) for item in session_payloads]
        )
        command_queue.replace_commands(
            [
                _payload_to_command(item)
                for item in sorted(command_payloads, key=lambda item: item["order_index"])
            ]
        )

    def _init_db(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS gateway_state (
                    kind TEXT NOT NULL,
                    key TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (kind, key)
                )
                """
            )
            connection.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self._path)

    @staticmethod
    def _insert_many(
        connection: sqlite3.Connection,
        kind: str,
        payloads: list[dict[str, Any]],
    ) -> None:
        now = utc_now().isoformat()
        rows = [
            (
                kind,
                _payload_key(kind, payload),
                json.dumps(payload, ensure_ascii=False),
                now,
            )
            for payload in payloads
        ]
        connection.executemany(
            """
            INSERT INTO gateway_state(kind, key, payload, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            rows,
        )


def _payload_key(kind: str, payload: dict[str, Any]) -> str:
    if kind == "device":
        return payload["device_id"]
    if kind == "session":
        return payload["call_id"]
    if kind == "command":
        return payload["command_id"]
    raise ValueError(f"Unsupported state kind: {kind}")


def _device_to_payload(device: DeviceRecord) -> dict[str, Any]:
    return {
        "device_id": device.device_id,
        "ip_address": device.ip_address,
        "status": device.status.value,
        "app_version": device.app_version,
        "last_heartbeat_at": _dt_to_str(device.last_heartbeat_at),
        "active_call_id": device.active_call_id,
        "audio_port": device.audio_port,
        "sim_slots": [asdict(slot) for slot in device.sim_slots],
        "health": asdict(device.health),
    }


def _payload_to_device(payload: dict[str, Any]) -> DeviceRecord:
    return DeviceRecord(
        device_id=payload["device_id"],
        ip_address=payload["ip_address"],
        status=DeviceStatus(payload["status"]),
        app_version=payload.get("app_version"),
        last_heartbeat_at=_parse_dt(payload["last_heartbeat_at"]),
        active_call_id=payload.get("active_call_id"),
        audio_port=payload.get("audio_port"),
        sim_slots=[SimSlot(**slot) for slot in payload.get("sim_slots", [])],
        health=DeviceHealth(**payload.get("health", {})),
    )


def _session_to_payload(session: CallSession) -> dict[str, Any]:
    return {
        "call_id": session.call_id,
        "phone_number": session.phone_number,
        "state": session.state.value,
        "campaign_id": session.campaign_id,
        "lead_id": session.lead_id,
        "device_id": session.device_id,
        "sim_slot": session.sim_slot,
        "audio_in_port": session.audio_in_port,
        "audio_out_port": session.audio_out_port,
        "ai_session_id": session.ai_session_id,
        "failure_reason": session.failure_reason,
        "created_at": _dt_to_str(session.created_at),
        "updated_at": _dt_to_str(session.updated_at),
        "connected_at": _dt_to_str(session.connected_at),
        "ended_at": _dt_to_str(session.ended_at),
        "metadata": dict(session.metadata),
    }


def _payload_to_session(payload: dict[str, Any]) -> CallSession:
    return CallSession(
        call_id=payload["call_id"],
        phone_number=payload["phone_number"],
        state=CallState(payload["state"]),
        campaign_id=payload.get("campaign_id"),
        lead_id=payload.get("lead_id"),
        device_id=payload.get("device_id"),
        sim_slot=payload.get("sim_slot"),
        audio_in_port=payload.get("audio_in_port"),
        audio_out_port=payload.get("audio_out_port"),
        ai_session_id=payload.get("ai_session_id"),
        failure_reason=payload.get("failure_reason"),
        created_at=_parse_dt(payload["created_at"]),
        updated_at=_parse_dt(payload["updated_at"]),
        connected_at=_parse_optional_dt(payload.get("connected_at")),
        ended_at=_parse_optional_dt(payload.get("ended_at")),
        metadata=dict(payload.get("metadata", {})),
    )


def _command_to_payload(order_index: int, command: DeviceCommand) -> dict[str, Any]:
    return {
        "order_index": order_index,
        "command_id": command.command_id,
        "device_id": command.device_id,
        "command": command.command.value,
        "call_id": command.call_id,
        "payload": dict(command.payload),
        "status": command.status.value,
        "attempt_count": command.attempt_count,
        "created_at": _dt_to_str(command.created_at),
        "delivered_at": _dt_to_str(command.delivered_at),
        "acknowledged_at": _dt_to_str(command.acknowledged_at),
        "expires_at": _dt_to_str(command.expires_at),
        "last_error": command.last_error,
    }


def _payload_to_command(payload: dict[str, Any]) -> DeviceCommand:
    return DeviceCommand(
        command_id=payload["command_id"],
        device_id=payload["device_id"],
        command=CommandName(payload["command"]),
        call_id=payload.get("call_id"),
        payload=dict(payload.get("payload", {})),
        status=CommandStatus(payload["status"]),
        attempt_count=payload.get("attempt_count", 0),
        created_at=_parse_dt(payload["created_at"]),
        delivered_at=_parse_optional_dt(payload.get("delivered_at")),
        acknowledged_at=_parse_optional_dt(payload.get("acknowledged_at")),
        expires_at=_parse_optional_dt(payload.get("expires_at")),
        last_error=payload.get("last_error"),
    )


def _dt_to_str(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _parse_optional_dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None
