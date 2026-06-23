from __future__ import annotations

from datetime import timedelta
from threading import RLock

from .models import DeviceHealth, DeviceRecord, DeviceStatus, utc_now


class DeviceRegistry:
    def __init__(self, heartbeat_timeout_seconds: int = 10) -> None:
        self._devices: dict[str, DeviceRecord] = {}
        self._heartbeat_timeout_seconds = heartbeat_timeout_seconds
        self._lock = RLock()

    def register_device(
        self,
        device_id: str,
        ip_address: str,
        app_version: str | None = None,
        audio_port: int | None = None,
    ) -> DeviceRecord:
        with self._lock:
            existing = self._devices.get(device_id)
            if existing:
                existing.ip_address = ip_address
                existing.app_version = app_version or existing.app_version
                existing.audio_port = audio_port or existing.audio_port
                existing.last_heartbeat_at = utc_now()
                if existing.status == DeviceStatus.OFFLINE:
                    existing.status = DeviceStatus.IDLE
                return existing

            device = DeviceRecord(
                device_id=device_id,
                ip_address=ip_address,
                app_version=app_version,
                audio_port=audio_port,
                status=DeviceStatus.IDLE,
            )
            self._devices[device_id] = device
            return device

    def get_device(self, device_id: str) -> DeviceRecord:
        with self._lock:
            return self._devices[device_id]

    def list_devices(self) -> list[DeviceRecord]:
        with self._lock:
            return list(self._devices.values())

    def heartbeat(self, device_id: str) -> DeviceRecord:
        with self._lock:
            device = self._devices[device_id]
            device.last_heartbeat_at = utc_now()
            if device.status == DeviceStatus.OFFLINE:
                device.status = DeviceStatus.IDLE
            return device

    def update_health(self, device_id: str, health: DeviceHealth) -> DeviceRecord:
        with self._lock:
            device = self._devices[device_id]
            device.health = health
            if not health.is_healthy and device.status == DeviceStatus.IDLE:
                device.status = DeviceStatus.DEGRADED
            if health.is_healthy and device.status == DeviceStatus.DEGRADED:
                device.status = DeviceStatus.IDLE
            return device

    def mark_busy(self, device_id: str, call_id: str) -> DeviceRecord:
        with self._lock:
            device = self._devices[device_id]
            device.status = DeviceStatus.BUSY
            device.active_call_id = call_id
            return device

    def release(self, device_id: str) -> DeviceRecord:
        with self._lock:
            device = self._devices[device_id]
            device.active_call_id = None
            if device.health.is_healthy:
                device.status = DeviceStatus.IDLE
            else:
                device.status = DeviceStatus.DEGRADED
            return device

    def find_available_device(self) -> DeviceRecord | None:
        with self._lock:
            for device in self._devices.values():
                if device.can_accept_call:
                    return device
            return None

    def mark_stale_devices_offline(self) -> list[str]:
        with self._lock:
            cutoff = utc_now() - timedelta(seconds=self._heartbeat_timeout_seconds)
            stale: list[str] = []
            for device in self._devices.values():
                if device.last_heartbeat_at < cutoff and device.status != DeviceStatus.OFFLINE:
                    device.status = DeviceStatus.OFFLINE
                    device.active_call_id = None
                    stale.append(device.device_id)
            return stale
