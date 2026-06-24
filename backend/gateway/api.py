from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .command_queue import DeviceCommandQueue
from .models import CallRequest, DeviceHealth
from .registry import DeviceRegistry
from .router import CallRouter
from .session_manager import CallSessionManager


gateway_api_router = APIRouter(prefix="/gateway", tags=["gateway"])

device_registry = DeviceRegistry()
session_manager = CallSessionManager()
command_queue = DeviceCommandQueue()
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


def _ensure_device_exists(device_id: str) -> None:
    try:
        device_registry.get_device(device_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc


@gateway_api_router.get("/devices")
def list_gateway_devices():
    return [asdict(device) for device in device_registry.list_devices()]


@gateway_api_router.post("/devices/register")
def register_gateway_device(payload: RegisterDevicePayload):
    device = device_registry.register_device(
        device_id=payload.device_id,
        ip_address=payload.ip_address,
        app_version=payload.app_version,
        audio_port=payload.audio_port,
    )
    return asdict(device)


@gateway_api_router.post("/devices/{device_id}/heartbeat")
def heartbeat_gateway_device(device_id: str):
    try:
        device = device_registry.heartbeat(device_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc
    return asdict(device)


@gateway_api_router.post("/devices/{device_id}/health")
def update_gateway_device_health(device_id: str, payload: HealthPayload):
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
    return asdict(device)


@gateway_api_router.get("/devices/{device_id}/commands/next")
def next_gateway_device_command(device_id: str):
    _ensure_device_exists(device_id)
    command = command_queue.next_for_device(device_id)
    return {"command": command.as_dict() if command else None}


@gateway_api_router.get("/devices/{device_id}/commands")
def list_gateway_device_commands(device_id: str):
    _ensure_device_exists(device_id)
    return [command.as_dict() for command in command_queue.list_for_device(device_id)]


@gateway_api_router.post("/devices/{device_id}/commands/{command_id}/ack")
def ack_gateway_device_command(
    device_id: str, command_id: str, payload: CommandAckPayload
):
    _ensure_device_exists(device_id)
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
    return asdict(session)


@gateway_api_router.post("/calls/{call_id}/complete")
def complete_gateway_call(call_id: str):
    try:
        next_session = call_router.complete_call(call_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Call not found") from exc
    return {
        "completed_call_id": call_id,
        "next_session": asdict(next_session) if next_session else None,
    }


@gateway_api_router.get("/sessions")
def list_gateway_sessions():
    return [asdict(session) for session in session_manager.list_sessions()]
