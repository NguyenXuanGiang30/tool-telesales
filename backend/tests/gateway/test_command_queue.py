from datetime import timedelta

from backend.gateway.command_queue import CommandStatus, DeviceCommandQueue
from backend.gateway.models import CommandName, utc_now


def test_enqueue_and_next_command_marks_delivered():
    queue = DeviceCommandQueue(default_ttl_seconds=30)

    queued = queue.enqueue(
        device_id="S9_01",
        command=CommandName.DIAL,
        call_id="call-1",
        payload={"phone_number": "0901000001"},
    )
    delivered = queue.next_for_device("S9_01")

    assert delivered is not None
    assert delivered.command_id == queued.command_id
    assert delivered.status == CommandStatus.DELIVERED
    assert delivered.attempt_count == 1
    assert delivered.delivered_at is not None
    assert delivered.payload == {"phone_number": "0901000001"}


def test_ack_command_marks_terminal_success():
    queue = DeviceCommandQueue()
    queued = queue.enqueue("S9_01", CommandName.PING)
    queue.next_for_device("S9_01")

    acked = queue.ack("S9_01", queued.command_id)

    assert acked.status == CommandStatus.ACKED
    assert acked.acknowledged_at is not None
    assert queue.next_for_device("S9_01") is None


def test_nack_command_records_error_and_is_terminal():
    queue = DeviceCommandQueue()
    queued = queue.enqueue("S9_01", CommandName.DIAL, call_id="call-1")
    queue.next_for_device("S9_01")

    nacked = queue.nack("S9_01", queued.command_id, "telephony_failed")

    assert nacked.status == CommandStatus.NACKED
    assert nacked.last_error == "telephony_failed"
    assert nacked.acknowledged_at is not None
    assert queue.next_for_device("S9_01") is None


def test_next_command_expires_overdue_commands_before_delivery():
    now = utc_now()
    queue = DeviceCommandQueue(default_ttl_seconds=5)
    queued = queue.enqueue("S9_01", CommandName.PING, now=now)

    result = queue.next_for_device("S9_01", now=now + timedelta(seconds=6))

    assert result is None
    assert queue.get(queued.command_id).status == CommandStatus.EXPIRED


def test_history_is_scoped_by_device():
    queue = DeviceCommandQueue()
    queue.enqueue("S9_01", CommandName.PING)
    queue.enqueue("S9_02", CommandName.PING)

    history = queue.list_for_device("S9_01")

    assert len(history) == 1
    assert history[0].device_id == "S9_01"
