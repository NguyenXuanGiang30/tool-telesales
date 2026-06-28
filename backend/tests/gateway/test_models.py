from backend.gateway.models import (
    CallState,
    DeviceHealth,
    DeviceRecord,
    DeviceStatus,
    SimSlot,
)


def test_device_record_defaults_to_idle_without_active_call():
    device = DeviceRecord(device_id="S9_01", ip_address="192.168.1.10")

    assert device.device_id == "S9_01"
    assert device.status == DeviceStatus.IDLE
    assert device.active_call_id is None
    assert device.sim_slots == [
        SimSlot(slot_id=1, enabled=True),
        SimSlot(slot_id=2, enabled=True),
    ]


def test_device_health_marks_hot_device_as_unhealthy():
    health = DeviceHealth(
        battery_percent=80,
        temperature_c=48.5,
        signal_dbm=-74,
        charging=True,
    )

    assert health.is_healthy is False


def test_call_state_order_contains_connected_lifecycle():
    lifecycle = [
        CallState.QUEUED,
        CallState.ALLOCATING_DEVICE,
        CallState.DIALING,
        CallState.RINGING,
        CallState.CONNECTED,
        CallState.ENDING,
        CallState.COMPLETED,
    ]

    assert [state.value for state in lifecycle] == [
        "queued",
        "allocating_device",
        "dialing",
        "ringing",
        "connected",
        "ending",
        "completed",
    ]
