import sys
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

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

from backend.gateway.audit_log import AuditLog
from backend.gateway.security import DevicePairingStore
from backend.main import app


client = TestClient(app)


def reset_gateway_state():
    from gateway.api import audit_log, command_queue, device_pairing, device_registry, session_manager

    device_registry._devices.clear()
    session_manager._sessions.clear()
    command_queue._commands.clear()
    command_queue._order.clear()
    device_pairing.clear()
    audit_log.clear()


def test_paired_device_requires_matching_token_for_device_endpoints():
    reset_gateway_state()

    pair_response = client.post(
        "/api/v1/gateway/devices/S9_SEC_01/pairing",
        json={"token": "sec-token-1"},
    )

    assert pair_response.status_code == 200
    assert pair_response.json()["device_id"] == "S9_SEC_01"
    assert "sec-token-1" not in str(pair_response.json())

    missing_token = client.post(
        "/api/v1/gateway/devices/register",
        json={"device_id": "S9_SEC_01", "ip_address": "192.168.1.80"},
    )
    assert missing_token.status_code == 401

    wrong_token = client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": "S9_SEC_01",
            "ip_address": "192.168.1.80",
            "device_token": "wrong-token",
        },
    )
    assert wrong_token.status_code == 401

    registered = client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": "S9_SEC_01",
            "ip_address": "192.168.1.80",
            "device_token": "sec-token-1",
        },
    )
    assert registered.status_code == 200

    heartbeat_without_header = client.post(
        "/api/v1/gateway/devices/S9_SEC_01/heartbeat"
    )
    assert heartbeat_without_header.status_code == 401

    heartbeat_with_header = client.post(
        "/api/v1/gateway/devices/S9_SEC_01/heartbeat",
        headers={"X-Device-Token": "sec-token-1"},
    )
    assert heartbeat_with_header.status_code == 200


def test_command_poll_and_ack_require_token_and_emit_audit_events():
    reset_gateway_state()

    client.post(
        "/api/v1/gateway/devices/S9_SEC_02/pairing",
        json={"token": "sec-token-2"},
    )
    client.post(
        "/api/v1/gateway/devices/register",
        json={
            "device_id": "S9_SEC_02",
            "ip_address": "192.168.1.81",
            "device_token": "sec-token-2",
        },
    )
    client.post("/api/v1/gateway/calls/dial", json={"phone_number": "0902000002"})

    forbidden_poll = client.get("/api/v1/gateway/devices/S9_SEC_02/commands/next")
    assert forbidden_poll.status_code == 401

    command_response = client.get(
        "/api/v1/gateway/devices/S9_SEC_02/commands/next",
        headers={"X-Device-Token": "sec-token-2"},
    )
    assert command_response.status_code == 200
    command = command_response.json()["command"]

    ack_response = client.post(
        f"/api/v1/gateway/devices/S9_SEC_02/commands/{command['command_id']}/ack",
        json={"status": "acked"},
        headers={"X-Device-Token": "sec-token-2"},
    )
    assert ack_response.status_code == 200

    audit_response = client.get("/api/v1/gateway/audit/events")
    events = audit_response.json()
    event_types = [event["event_type"] for event in events]

    assert "device_paired" in event_types
    assert "device_registered" in event_types
    assert "command_delivered" in event_types
    assert "command_acked" in event_types


def test_pairing_store_persists_hashes_without_raw_tokens(tmp_path):
    store_path = tmp_path / "pairings.json"
    store = DevicePairingStore(path=store_path, require_token=True)

    store.pair("S9_PERSIST_01", "persist-token")
    reloaded = DevicePairingStore(path=store_path, require_token=True)

    assert reloaded.verify("S9_PERSIST_01", "persist-token") is True
    assert reloaded.verify("S9_PERSIST_01", "wrong-token") is False
    assert "persist-token" not in store_path.read_text(encoding="utf-8")


def test_audit_log_persists_jsonl_events(tmp_path):
    log_path = tmp_path / "gateway-audit.jsonl"
    audit = AuditLog(path=log_path)

    audit.record(
        event_type="device_registered",
        actor="device",
        device_id="S9_AUDIT_01",
        metadata={"ip_address": "192.168.1.90"},
    )
    reloaded = AuditLog(path=log_path)

    events = reloaded.list_events()
    assert len(events) == 1
    assert events[0].event_type == "device_registered"
    assert events[0].device_id == "S9_AUDIT_01"
    assert events[0].metadata == {"ip_address": "192.168.1.90"}

