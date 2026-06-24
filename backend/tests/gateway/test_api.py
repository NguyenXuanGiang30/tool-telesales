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

from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_register_device_api():
    response = client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": "S9_01",
            "ip_address": "192.168.1.10",
            "audio_port": 50001
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["device_id"] == "S9_01"
    assert data["status"] == "idle"

def test_dial_call_api():
    # Register first
    client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": "S9_01",
            "ip_address": "192.168.1.10",
            "audio_port": 50001
        }
    )
    
    response = client.post(
        "/api/v1/gateway/calls/dial",
        json={
            "phone_number": "0987654321",
            "campaign_id": "camp-1"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["phone_number"] == "0987654321"
    assert data["state"] == "dialing"
    assert data["device_id"] == "S9_01"


def test_dial_allocated_call_exposes_next_device_command():
    client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": "S9_COMMAND_01",
            "ip_address": "192.168.1.50",
            "audio_port": 50100,
        },
    )

    dial_response = client.post(
        "/api/v1/gateway/calls/dial",
        json={"phone_number": "0901000001"},
    )
    call_id = dial_response.json()["call_id"]

    command_response = client.get(
        "/api/v1/gateway/devices/S9_COMMAND_01/commands/next"
    )

    assert command_response.status_code == 200
    body = command_response.json()
    assert body["command"]["command"] == "DIAL"
    assert body["command"]["device_id"] == "S9_COMMAND_01"
    assert body["command"]["call_id"] == call_id
    assert body["command"]["payload"]["phone_number"] == "0901000001"
    assert body["command"]["status"] == "delivered"


def test_device_can_ack_and_nack_commands():
    client.post(
        "/api/v1/gateway/devices/register",
        json={"device_id": "S9_COMMAND_02", "ip_address": "192.168.1.51"},
    )
    client.post("/api/v1/gateway/calls/dial", json={"phone_number": "0901000002"})
    command = client.get(
        "/api/v1/gateway/devices/S9_COMMAND_02/commands/next"
    ).json()["command"]

    ack_response = client.post(
        f"/api/v1/gateway/devices/S9_COMMAND_02/commands/{command['command_id']}/ack",
        json={"status": "acked"},
    )

    assert ack_response.status_code == 200
    assert ack_response.json()["status"] == "acked"

    client.post(
        "/api/v1/gateway/devices/register",
        json={"device_id": "S9_COMMAND_03", "ip_address": "192.168.1.52"},
    )
    client.post("/api/v1/gateway/calls/dial", json={"phone_number": "0901000003"})
    command = client.get(
        "/api/v1/gateway/devices/S9_COMMAND_03/commands/next"
    ).json()["command"]

    nack_response = client.post(
        f"/api/v1/gateway/devices/S9_COMMAND_03/commands/{command['command_id']}/ack",
        json={"status": "nacked", "error": "telephony_failed"},
    )

    assert nack_response.status_code == 200
    assert nack_response.json()["status"] == "nacked"
    assert nack_response.json()["last_error"] == "telephony_failed"


def test_next_command_returns_null_when_queue_empty():
    client.post(
        "/api/v1/gateway/devices/register",
        json={"device_id": "S9_COMMAND_EMPTY", "ip_address": "192.168.1.53"},
    )

    response = client.get(
        "/api/v1/gateway/devices/S9_COMMAND_EMPTY/commands/next"
    )

    assert response.status_code == 200
    assert response.json() == {"command": None}
