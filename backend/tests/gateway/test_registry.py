from datetime import timedelta

from backend.gateway.models import DeviceHealth, DeviceStatus, utc_now
from backend.gateway.registry import DeviceRegistry


def test_register_device_creates_idle_record():
    registry = DeviceRegistry()

    device = registry.register_device(
        device_id="S9_01",
        ip_address="192.168.1.10",
        app_version="1.0.0",
        audio_port=50001,
    )

    assert device.device_id == "S9_01"
    assert device.status == DeviceStatus.IDLE
    assert device.audio_port == 50001
    assert registry.get_device("S9_01") == device


def test_heartbeat_updates_timestamp_and_status():
    registry = DeviceRegistry()
    registry.register_device("S9_01", "192.168.1.10")
    before = registry.get_device("S9_01").last_heartbeat_at

    updated = registry.heartbeat("S9_01")

    assert updated.last_heartbeat_at >= before
    assert updated.status == DeviceStatus.IDLE


def test_mark_stale_devices_offline():
    registry = DeviceRegistry(heartbeat_timeout_seconds=10)
    device = registry.register_device("S9_01", "192.168.1.10")
    device.last_heartbeat_at = utc_now() - timedelta(seconds=20)

    stale = registry.mark_stale_devices_offline()

    assert stale == ["S9_01"]
    assert registry.get_device("S9_01").status == DeviceStatus.OFFLINE


def test_health_update_degrades_hot_device():
    registry = DeviceRegistry()
    registry.register_device("S9_01", "192.168.1.10")

    device = registry.update_health(
        "S9_01",
        DeviceHealth(battery_percent=90, temperature_c=49.0, signal_dbm=-70),
    )

    assert device.status == DeviceStatus.DEGRADED
    assert device.can_accept_call is False
