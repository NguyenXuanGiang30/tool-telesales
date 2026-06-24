from backend.gateway.models import CommandName, DeviceEventType
from backend.gateway.simulators.s9_simulator import S9Simulator


def test_s9_simulator_acknowledges_command_payload():
    simulator = S9Simulator("S9_SIM_01", "192.168.1.60", audio_port=50200)
    command = {
        "command_id": "cmd-1",
        "command": CommandName.PING.value,
        "call_id": None,
        "payload": {},
    }

    ack = simulator.ack_command(command)

    assert ack == {
        "command_id": "cmd-1",
        "status": "acked",
        "error": None,
    }


def test_s9_simulator_handles_dial_command_as_ringing_event():
    simulator = S9Simulator("S9_SIM_01", "192.168.1.60", audio_port=50200)
    command = {
        "command_id": "cmd-2",
        "command": CommandName.DIAL.value,
        "call_id": "call-1",
        "payload": {"phone_number": "0901000001"},
    }

    event = simulator.handle_command(command)

    assert simulator.active_call_id == "call-1"
    assert event["type"] == "event"
    assert event["event"] == DeviceEventType.RINGING.value
    assert event["device_id"] == "S9_SIM_01"
    assert event["call_id"] == "call-1"
    assert event["payload"]["phone_number"] == "0901000001"


def test_s9_simulator_nacks_unsupported_command():
    simulator = S9Simulator("S9_SIM_01", "192.168.1.60", audio_port=50200)
    command = {
        "command_id": "cmd-3",
        "command": "UNSUPPORTED",
        "call_id": None,
        "payload": {},
    }

    ack = simulator.ack_command(command)

    assert ack == {
        "command_id": "cmd-3",
        "status": "nacked",
        "error": "unsupported_command:UNSUPPORTED",
    }
