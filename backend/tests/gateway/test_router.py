from backend.gateway.models import CallRequest, CallState, DeviceStatus
from backend.gateway.registry import DeviceRegistry
from backend.gateway.router import CallRouter
from backend.gateway.session_manager import CallSessionManager


def make_router():
    registry = DeviceRegistry()
    sessions = CallSessionManager()
    return CallRouter(registry=registry, sessions=sessions), registry, sessions


def test_route_call_allocates_idle_device():
    router, registry, _sessions = make_router()
    registry.register_device("S9_01", "192.168.1.10", audio_port=50001)

    session = router.enqueue_and_allocate(CallRequest(phone_number="0987654321"))

    assert session.state == CallState.DIALING
    assert session.device_id == "S9_01"
    assert session.sim_slot == 1
    assert registry.get_device("S9_01").status == DeviceStatus.BUSY
    assert registry.get_device("S9_01").active_call_id == session.call_id


def test_route_call_queues_when_no_device_available():
    router, _registry, _sessions = make_router()

    session = router.enqueue_and_allocate(CallRequest(phone_number="0987654321"))

    assert session.state == CallState.QUEUED
    assert session.device_id is None
    assert router.queue_size == 1


def test_complete_call_releases_device_and_allocates_next_queued_call():
    router, registry, _sessions = make_router()
    registry.register_device("S9_01", "192.168.1.10", audio_port=50001)
    active = router.enqueue_and_allocate(CallRequest(phone_number="0900000001"))
    queued = router.enqueue_and_allocate(CallRequest(phone_number="0900000002"))

    next_session = router.complete_call(active.call_id)

    assert next_session is not None
    assert next_session.call_id == queued.call_id
    assert next_session.state == CallState.DIALING
    assert registry.get_device("S9_01").active_call_id == queued.call_id
