from backend.gateway.control_protocol import (
    build_command,
    parse_device_event,
)
from backend.gateway.models import CommandName, DeviceEventType


def test_build_dial_command_contains_command_id_and_payload():
    command = build_command(
        command=CommandName.DIAL,
        call_id="call-123",
        payload={"phone_number": "0987654321", "sim_slot": 1},
    )

    assert command["type"] == "command"
    assert command["command"] == "DIAL"
    assert command["call_id"] == "call-123"
    assert command["command_id"]
    assert command["payload"]["sim_slot"] == 1


def test_parse_device_event_validates_required_fields():
    event = parse_device_event(
        {
            "type": "event",
            "event": "CONNECTED",
            "device_id": "S9_01",
            "call_id": "call-123",
            "payload": {"network": "lte"},
        }
    )

    assert event.event == DeviceEventType.CONNECTED
    assert event.device_id == "S9_01"
    assert event.call_id == "call-123"


def test_parse_device_event_rejects_missing_device_id():
    try:
        parse_device_event({"type": "event", "event": "HEARTBEAT"})
    except ValueError as exc:
        assert "device_id" in str(exc)
    else:
        raise AssertionError("Expected ValueError for missing device_id")
