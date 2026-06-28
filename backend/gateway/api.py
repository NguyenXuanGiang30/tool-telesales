from __future__ import annotations

from dataclasses import asdict
import os
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .audit_log import AuditLog
from .command_queue import DeviceCommandQueue
from .models import CallRequest, DeviceHealth
from .registry import DeviceRegistry
from .router import CallRouter
from .session_manager import CallSessionManager
from .audio_metrics import AudioMetricsRegistry
from .security import DevicePairingStore
from .state_store import GatewayStateStore


gateway_api_router = APIRouter(prefix="/gateway", tags=["gateway"])

device_registry = DeviceRegistry()
session_manager = CallSessionManager()
command_queue = DeviceCommandQueue()
audio_metrics = AudioMetricsRegistry()

_state_dir = os.environ.get("GATEWAY_STATE_DIR")
_state_path = Path(_state_dir) if _state_dir else None
_require_device_token = os.environ.get("GATEWAY_REQUIRE_DEVICE_TOKEN", "").lower() in {
    "1",
    "true",
    "yes",
}
device_pairing = DevicePairingStore(
    path=_state_path / "device_pairings.json" if _state_path else None,
    require_token=_require_device_token,
)
audit_log = AuditLog(path=_state_path / "gateway_audit.jsonl" if _state_path else None)
state_store = (
    GatewayStateStore(_state_path / "gateway_state.sqlite") if _state_path else None
)
if state_store:
    state_store.load_into(device_registry, session_manager, command_queue)
call_router = CallRouter(
    registry=device_registry,
    sessions=session_manager,
    command_queue=command_queue,
)


class RegisterDevicePayload(BaseModel):
    device_id: str
    ip_address: str
    app_version: str | None = None
    audio_port: int | None = None
    device_token: str | None = None


class HealthPayload(BaseModel):
    battery_percent: int | None = None
    temperature_c: float | None = None
    signal_dbm: int | None = None
    charging: bool | None = None
    network_type: str | None = None
    storage_free_mb: int | None = None


class DialPayload(BaseModel):
    phone_number: str
    campaign_id: str | None = None
    lead_id: str | None = None
    metadata: dict = Field(default_factory=dict)


class CommandAckPayload(BaseModel):
    status: str
    error: str | None = None


class PairDevicePayload(BaseModel):
    token: str = Field(min_length=1)


def _ensure_device_exists(device_id: str) -> None:
    try:
        device_registry.get_device(device_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc


def _ensure_device_authorized(device_id: str, token: str | None) -> None:
    if device_pairing.verify(device_id, token):
        return
    audit_log.record(
        event_type="device_auth_failed",
        actor="device",
        device_id=device_id,
        status="rejected",
        reason="invalid_device_token",
    )
    raise HTTPException(status_code=401, detail="Invalid device token")


def _persist_gateway_state() -> None:
    if not state_store:
        return
    state_store.save(device_registry, session_manager, command_queue)


@gateway_api_router.get("/devices")
def list_gateway_devices():
    return [asdict(device) for device in device_registry.list_devices()]


@gateway_api_router.post("/devices/{device_id}/pairing")
def pair_gateway_device(device_id: str, payload: PairDevicePayload):
    pairing = device_pairing.pair(device_id=device_id, token=payload.token)
    audit_log.record(
        event_type="device_paired",
        actor="admin",
        device_id=device_id,
        status="paired",
    )
    return pairing.public_dict()


@gateway_api_router.post("/devices/register")
def register_gateway_device(
    payload: RegisterDevicePayload,
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
):
    _ensure_device_authorized(payload.device_id, payload.device_token or x_device_token)
    device = device_registry.register_device(
        device_id=payload.device_id,
        ip_address=payload.ip_address,
        app_version=payload.app_version,
        audio_port=payload.audio_port,
    )
    audit_log.record(
        event_type="device_registered",
        actor="device",
        device_id=payload.device_id,
        status="accepted",
        metadata={
            "ip_address": payload.ip_address,
            "app_version": payload.app_version,
            "audio_port": payload.audio_port,
        },
    )
    _persist_gateway_state()
    return asdict(device)


@gateway_api_router.post("/devices/{device_id}/heartbeat")
def heartbeat_gateway_device(
    device_id: str,
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
):
    _ensure_device_authorized(device_id, x_device_token)
    try:
        device = device_registry.heartbeat(device_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc
    _persist_gateway_state()
    return asdict(device)


@gateway_api_router.post("/devices/{device_id}/health")
def update_gateway_device_health(
    device_id: str,
    payload: HealthPayload,
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
):
    _ensure_device_authorized(device_id, x_device_token)
    try:
        device = device_registry.update_health(
            device_id,
            DeviceHealth(
                battery_percent=payload.battery_percent,
                temperature_c=payload.temperature_c,
                signal_dbm=payload.signal_dbm,
                charging=payload.charging,
                network_type=payload.network_type,
                storage_free_mb=payload.storage_free_mb,
            ),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc
    _persist_gateway_state()
    return asdict(device)


@gateway_api_router.get("/devices/{device_id}/commands/next")
def next_gateway_device_command(
    device_id: str,
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
):
    _ensure_device_exists(device_id)
    _ensure_device_authorized(device_id, x_device_token)
    command = command_queue.next_for_device(device_id)
    if command:
        audit_log.record(
            event_type="command_delivered",
            actor="device",
            device_id=device_id,
            command_id=command.command_id,
            call_id=command.call_id,
            status=command.status.value,
            metadata={"command": command.command.value},
        )
        _persist_gateway_state()
    return {"command": command.as_dict() if command else None}


@gateway_api_router.get("/devices/{device_id}/commands")
def list_gateway_device_commands(
    device_id: str,
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
):
    _ensure_device_exists(device_id)
    _ensure_device_authorized(device_id, x_device_token)
    return [command.as_dict() for command in command_queue.list_for_device(device_id)]


@gateway_api_router.post("/devices/{device_id}/commands/{command_id}/ack")
def ack_gateway_device_command(
    device_id: str,
    command_id: str,
    payload: CommandAckPayload,
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
):
    _ensure_device_exists(device_id)
    _ensure_device_authorized(device_id, x_device_token)
    try:
        if payload.status == "acked":
            command = command_queue.ack(device_id, command_id)
        elif payload.status == "nacked":
            command = command_queue.nack(
                device_id,
                command_id,
                payload.error or "device_nacked_command",
            )
        else:
            raise HTTPException(
                status_code=400, detail="status must be 'acked' or 'nacked'"
            )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Command not found") from exc
    audit_log.record(
        event_type="command_acked" if payload.status == "acked" else "command_nacked",
        actor="device",
        device_id=device_id,
        command_id=command.command_id,
        call_id=command.call_id,
        status=command.status.value,
        reason=command.last_error,
        metadata={"command": command.command.value},
    )
    _persist_gateway_state()
    return command.as_dict()


@gateway_api_router.post("/calls/dial")
def dial_gateway_call(payload: DialPayload):
    session = call_router.enqueue_and_allocate(
        CallRequest(
            phone_number=payload.phone_number,
            campaign_id=payload.campaign_id,
            lead_id=payload.lead_id,
            metadata=payload.metadata,
        )
    )
    _persist_gateway_state()
    return asdict(session)


@gateway_api_router.post("/calls/{call_id}/complete")
def complete_gateway_call(call_id: str):
    try:
        next_session = call_router.complete_call(call_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Call not found") from exc
    _persist_gateway_state()
    return {
        "completed_call_id": call_id,
        "next_session": asdict(next_session) if next_session else None,
    }


@gateway_api_router.get("/sessions")
def list_gateway_sessions():
    return [asdict(session) for session in session_manager.list_sessions()]


@gateway_api_router.get("/audio/metrics")
def list_audio_metrics():
    return [m.as_dict() for m in audio_metrics.list_all()]


@gateway_api_router.get("/audit/events")
def list_gateway_audit_events(device_id: str | None = None):
    return [event.as_dict() for event in audit_log.list_events(device_id=device_id)]
