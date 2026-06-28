from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DeviceStatus(str, Enum):
    OFFLINE = "offline"
    ONLINE = "online"
    IDLE = "idle"
    BUSY = "busy"
    DEGRADED = "degraded"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class CallState(str, Enum):
    QUEUED = "queued"
    ALLOCATING_DEVICE = "allocating_device"
    DIALING = "dialing"
    RINGING = "ringing"
    CONNECTED = "connected"
    AI_LISTENING = "ai_listening"
    AI_THINKING = "ai_thinking"
    AI_SPEAKING = "ai_speaking"
    ENDING = "ending"
    COMPLETED = "completed"
    FAILED = "failed"


class CommandName(str, Enum):
    DIAL = "DIAL"
    HANGUP = "HANGUP"
    HOLD = "HOLD"
    RESUME = "RESUME"
    SELECT_SIM = "SELECT_SIM"
    PING = "PING"
    START_AUDIO = "START_AUDIO"
    STOP_AUDIO = "STOP_AUDIO"


class DeviceEventType(str, Enum):
    REGISTERED = "REGISTERED"
    HEARTBEAT = "HEARTBEAT"
    RINGING = "RINGING"
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    BUSY = "BUSY"
    NO_ANSWER = "NO_ANSWER"
    ERROR = "ERROR"
    AUDIO_STARTED = "AUDIO_STARTED"
    AUDIO_STOPPED = "AUDIO_STOPPED"
    HEALTH = "HEALTH"


@dataclass(frozen=True)
class SimSlot:
    slot_id: int
    enabled: bool = True
    carrier: str | None = None
    phone_number: str | None = None
    daily_call_limit: int | None = None
    calls_today: int = 0


@dataclass(frozen=True)
class DeviceHealth:
    battery_percent: int | None = None
    temperature_c: float | None = None
    signal_dbm: int | None = None
    charging: bool | None = None
    network_type: str | None = None
    storage_free_mb: int | None = None

    @property
    def is_healthy(self) -> bool:
        if self.temperature_c is not None and self.temperature_c > 45.0:
            return False
        if self.signal_dbm is not None and self.signal_dbm < -110:
            return False
        if self.battery_percent is not None and self.battery_percent < 10:
            return False
        return True


@dataclass
class DeviceRecord:
    device_id: str
    ip_address: str
    status: DeviceStatus = DeviceStatus.IDLE
    app_version: str | None = None
    last_heartbeat_at: datetime = field(default_factory=utc_now)
    active_call_id: str | None = None
    audio_port: int | None = None
    sim_slots: list[SimSlot] = field(
        default_factory=lambda: [SimSlot(slot_id=1), SimSlot(slot_id=2)]
    )
    health: DeviceHealth = field(default_factory=DeviceHealth)

    @property
    def can_accept_call(self) -> bool:
        return (
            self.status == DeviceStatus.IDLE
            and self.active_call_id is None
            and self.health.is_healthy
            and any(slot.enabled for slot in self.sim_slots)
        )


@dataclass
class CallRequest:
    phone_number: str
    campaign_id: str | None = None
    lead_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CallSession:
    call_id: str
    phone_number: str
    state: CallState
    campaign_id: str | None = None
    lead_id: str | None = None
    device_id: str | None = None
    sim_slot: int | None = None
    audio_in_port: int | None = None
    audio_out_port: int | None = None
    ai_session_id: str | None = None
    failure_reason: str | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
    connected_at: datetime | None = None
    ended_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
