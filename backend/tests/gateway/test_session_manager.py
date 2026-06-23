from backend.gateway.models import CallRequest, CallState
from backend.gateway.session_manager import CallSessionManager


def test_create_queued_session_assigns_call_id():
    manager = CallSessionManager()

    session = manager.create_queued_session(
        CallRequest(phone_number="0987654321", campaign_id="camp-1", lead_id="lead-1")
    )

    assert session.call_id
    assert session.phone_number == "0987654321"
    assert session.campaign_id == "camp-1"
    assert session.lead_id == "lead-1"
    assert session.state == CallState.QUEUED


def test_attach_device_moves_session_to_dialing():
    manager = CallSessionManager()
    session = manager.create_queued_session(CallRequest(phone_number="0987654321"))

    updated = manager.attach_device(
        call_id=session.call_id,
        device_id="S9_01",
        sim_slot=1,
        audio_in_port=50001,
        audio_out_port=50001,
    )

    assert updated.state == CallState.DIALING
    assert updated.device_id == "S9_01"
    assert updated.sim_slot == 1
    assert updated.audio_in_port == 50001


def test_mark_failed_sets_reason_and_end_time():
    manager = CallSessionManager()
    session = manager.create_queued_session(CallRequest(phone_number="0987654321"))

    failed = manager.mark_failed(session.call_id, "no_device_available")

    assert failed.state == CallState.FAILED
    assert failed.failure_reason == "no_device_available"
    assert failed.ended_at is not None
