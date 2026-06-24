import sys
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Mock out deep learning libraries before importing main.py
mock_torch = MagicMock()
mock_torch.cuda.is_available.return_value = False
sys.modules["torch"] = mock_torch

mock_torchaudio = MagicMock()
sys.modules["torchaudio"] = mock_torchaudio

mock_webrtcvad = MagicMock()
mock_webrtcvad.Vad.return_value = MagicMock()
sys.modules["webrtcvad"] = mock_webrtcvad

mock_whisper = MagicMock()
sys.modules["faster_whisper"] = mock_whisper

mock_transformers = MagicMock()
sys.modules["transformers"] = mock_transformers

from fastapi.testclient import TestClient

from backend.main import app
from backend.gateway.models import DeviceEventType
from backend.gateway.simulators.s9_simulator import S9Simulator


client = TestClient(app)


def test_gateway_to_simulator_dial_command_flow():
    from gateway.api import device_registry, session_manager, command_queue
    device_registry._devices.clear()
    session_manager._sessions.clear()
    command_queue._commands.clear()
    command_queue._order.clear()

    simulator = S9Simulator("S9_E2E_01", "192.168.1.70", audio_port=50300)
    register = simulator.register_event()

    register_response = client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": register["device_id"],
            "ip_address": register["payload"]["ip_address"],
            "app_version": register["payload"]["app_version"],
            "audio_port": register["payload"]["audio_port"],
        },
    )
    assert register_response.status_code == 200

    dial_response = client.post(
        "/api/v1/gateway/calls/dial",
        json={"phone_number": "0901999000", "campaign_id": "camp-e2e"},
    )
    assert dial_response.status_code == 200
    call_id = dial_response.json()["call_id"]

    command_response = client.get(
        "/api/v1/gateway/devices/S9_E2E_01/commands/next"
    )
    command = command_response.json()["command"]
    assert command["command"] == "DIAL"
    assert command["call_id"] == call_id

    ack_payload = simulator.ack_command(command)
    ack_response = client.post(
        f"/api/v1/gateway/devices/S9_E2E_01/commands/{command['command_id']}/ack",
        json=ack_payload,
    )
    assert ack_response.status_code == 200
    assert ack_response.json()["status"] == "acked"

    event = simulator.handle_command(command)
    assert event["event"] == DeviceEventType.RINGING.value
    assert event["call_id"] == call_id
