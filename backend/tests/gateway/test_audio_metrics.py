import time
from datetime import datetime, timezone
from backend.gateway.audio_metrics import AudioMetricsRegistry, AudioSessionMetrics


def test_records_input_output_bytes_and_packets():
    metrics = AudioMetricsRegistry()

    metrics.record_input(call_id="call-001", device_id="s9-001", sequence_number=1, byte_count=160)
    metrics.record_input(call_id="call-001", device_id="s9-001", sequence_number=2, byte_count=160)
    metrics.record_output(call_id="call-001", device_id="s9-001", byte_count=320)

    snapshot = metrics.get("call-001", "s9-001")
    assert snapshot.packets_in == 2
    assert snapshot.bytes_in == 320
    assert snapshot.packets_out == 1
    assert snapshot.bytes_out == 320
    assert snapshot.dropped_input_sequences == 0
    assert isinstance(snapshot.last_packet_at, datetime)


def test_counts_sequence_gaps_and_records_errors():
    metrics = AudioMetricsRegistry()

    metrics.record_input(call_id="call-002", device_id="s9-002", sequence_number=1, byte_count=160)
    metrics.record_input(call_id="call-002", device_id="s9-002", sequence_number=4, byte_count=160)
    metrics.record_error(call_id="call-002", device_id="s9-002", error="unknown_call")

    snapshot = metrics.get("call-002", "s9-002")
    assert snapshot.dropped_input_sequences == 2
    assert snapshot.last_input_sequence == 4
    assert snapshot.last_error == "unknown_call"


def test_records_out_of_order_sequence():
    metrics = AudioMetricsRegistry()

    metrics.record_input(call_id="call-003", device_id="s9-003", sequence_number=2, byte_count=160)
    metrics.record_input(call_id="call-003", device_id="s9-003", sequence_number=1, byte_count=160)

    snapshot = metrics.get("call-003", "s9-003")
    assert snapshot.last_input_sequence == 2  # remains unchanged or does not decrement
    assert snapshot.last_error == "out_of_order_sequence"
    assert snapshot.dropped_input_sequences == 0


def test_list_all_returns_all_tracked_calls():
    metrics = AudioMetricsRegistry()
    metrics.record_input(call_id="call-1", device_id="s9-1", sequence_number=1, byte_count=160)
    metrics.record_input(call_id="call-2", device_id="s9-2", sequence_number=1, byte_count=160)

    all_metrics = metrics.list_all()
    assert len(all_metrics) == 2
    assert {m.call_id for m in all_metrics} == {"call-1", "call-2"}
