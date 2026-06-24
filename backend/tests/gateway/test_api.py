import sys
from unittest.mock import MagicMock

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
