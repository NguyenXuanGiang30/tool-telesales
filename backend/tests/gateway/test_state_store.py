from backend.gateway.command_queue import DeviceCommandQueue
from backend.gateway.models import CallRequest, CommandName, DeviceHealth
from backend.gateway.registry import DeviceRegistry
from backend.gateway.router import CallRouter
from backend.gateway.session_manager import CallSessionManager
from backend.gateway.state_store import GatewayStateStore


def test_gateway_state_store_round_trips_devices_sessions_and_commands(tmp_path):
    db_path = tmp_path / "gateway_state.sqlite"
    registry = DeviceRegistry()
    sessions = CallSessionManager()
    command_queue = DeviceCommandQueue()
    router = CallRouter(
        registry=registry,
        sessions=sessions,
        command_queue=command_queue,
    )

    registry.register_device(
        device_id="S9_DB_01",
        ip_address="192.168.10.10",
        app_version="agent-1.0.0",
        audio_port=28100,
    )
    registry.update_health(
        "S9_DB_01",
        DeviceHealth(
            battery_percent=87,
            temperature_c=36.5,
            signal_dbm=-72,
            charging=True,
            network_type="LTE",
            storage_free_mb=4096,
        ),
    )
    session = router.enqueue_and_allocate(
        CallRequest(
            phone_number="0903000001",
            campaign_id="campaign-db",
            lead_id="lead-db-1",
            metadata={"source": "state-store-test"},
        )
    )
    delivered = command_queue.next_for_device("S9_DB_01")
    assert delivered is not None
    command_queue.ack("S9_DB_01", delivered.command_id)

    store = GatewayStateStore(db_path)
    store.save(registry, sessions, command_queue)

    restored_registry = DeviceRegistry()
    restored_sessions = CallSessionManager()
    restored_queue = DeviceCommandQueue()
    store.load_into(restored_registry, restored_sessions, restored_queue)

    restored_device = restored_registry.get_device("S9_DB_01")
    assert restored_device.ip_address == "192.168.10.10"
    assert restored_device.status.value == "busy"
    assert restored_device.active_call_id == session.call_id
    assert restored_device.health.battery_percent == 87
    assert restored_device.health.charging is True

    restored_session = restored_sessions.get(session.call_id)
    assert restored_session.phone_number == "0903000001"
    assert restored_session.device_id == "S9_DB_01"
    assert restored_session.metadata == {"source": "state-store-test"}

    restored_commands = restored_queue.list_for_device("S9_DB_01")
    assert len(restored_commands) == 1
    assert restored_commands[0].command == CommandName.DIAL
    assert restored_commands[0].status.value == "acked"
    assert restored_commands[0].attempt_count == 1

