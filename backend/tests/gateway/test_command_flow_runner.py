import pytest

from backend.gateway.simulators.command_flow_runner import run_command_flow_smoke


def test_command_flow_smoke_acknowledges_one_call_per_device():
    summary = run_command_flow_smoke(device_count=3, iterations=1)

    assert summary == {
        "devices": 3,
        "iterations": 1,
        "calls": 3,
        "commands_delivered": 3,
        "commands_acked": 3,
        "commands_nacked": 0,
        "failures": [],
    }


def test_command_flow_smoke_supports_multiple_iterations_without_session_mixing():
    summary = run_command_flow_smoke(device_count=7, iterations=2)

    assert summary["devices"] == 7
    assert summary["iterations"] == 2
    assert summary["calls"] == 14
    assert summary["commands_delivered"] == 14
    assert summary["commands_acked"] == 14
    assert summary["commands_nacked"] == 0
    assert summary["failures"] == []


def test_command_flow_smoke_rejects_invalid_device_count():
    with pytest.raises(ValueError, match="device_count must be at least 1"):
        run_command_flow_smoke(device_count=0)


def test_command_flow_smoke_rejects_invalid_iterations():
    with pytest.raises(ValueError, match="iterations must be at least 1"):
        run_command_flow_smoke(iterations=0)

