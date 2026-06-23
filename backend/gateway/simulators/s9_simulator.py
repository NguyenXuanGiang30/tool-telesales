from __future__ import annotations

from dataclasses import dataclass, field

from backend.gateway.models import DeviceEventType, DeviceHealth


@dataclass
class S9Simulator:
    device_id: str
    ip_address: str
    audio_port: int
    app_version: str = "sim-1.0.0"
    connected: bool = False
    active_call_id: str | None = None
    events: list[dict] = field(default_factory=list)

    def register_event(self) -> dict:
        self.connected = True
        event = {
            "type": "event",
            "event": DeviceEventType.REGISTERED.value,
            "device_id": self.device_id,
            "payload": {
                "ip_address": self.ip_address,
                "app_version": self.app_version,
                "audio_port": self.audio_port,
            },
        }
        self.events.append(event)
        return event

    def heartbeat_event(self) -> dict:
        event = {
            "type": "event",
            "event": DeviceEventType.HEARTBEAT.value,
            "device_id": self.device_id,
            "payload": {},
        }
        self.events.append(event)
        return event

    def health_event(self, health: DeviceHealth) -> dict:
        event = {
            "type": "event",
            "event": DeviceEventType.HEALTH.value,
            "device_id": self.device_id,
            "payload": {
                "battery_percent": health.battery_percent,
                "temperature_c": health.temperature_c,
                "signal_dbm": health.signal_dbm,
                "charging": health.charging,
                "network_type": health.network_type,
                "storage_free_mb": health.storage_free_mb,
            },
        }
        self.events.append(event)
        return event

    def connected_event(self, call_id: str) -> dict:
        self.active_call_id = call_id
        event = {
            "type": "event",
            "event": DeviceEventType.CONNECTED.value,
            "device_id": self.device_id,
            "call_id": call_id,
            "payload": {},
        }
        self.events.append(event)
        return event

    def disconnected_event(self, call_id: str, reason: str = "normal") -> dict:
        self.active_call_id = None
        event = {
            "type": "event",
            "event": DeviceEventType.DISCONNECTED.value,
            "device_id": self.device_id,
            "call_id": call_id,
            "payload": {"reason": reason},
        }
        self.events.append(event)
        return event
