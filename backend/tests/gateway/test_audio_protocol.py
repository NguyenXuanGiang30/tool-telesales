from backend.gateway.audio_protocol import AudioPacket, AudioDirection


def test_audio_packet_round_trip_preserves_payload_and_metadata():
    packet = AudioPacket(
        direction=AudioDirection.CUSTOMER_TO_AI,
        call_id="call-123",
        device_id="S9_01",
        sequence_number=7,
        timestamp_ms=123456789,
        sample_rate=16000,
        channels=1,
        payload=b"\x01\x02\x03\x04",
    )

    encoded = packet.encode()
    decoded = AudioPacket.decode(encoded)

    assert decoded.direction == AudioDirection.CUSTOMER_TO_AI
    assert decoded.call_id == "call-123"
    assert decoded.device_id == "S9_01"
    assert decoded.sequence_number == 7
    assert decoded.timestamp_ms == 123456789
    assert decoded.sample_rate == 16000
    assert decoded.channels == 1
    assert decoded.payload == b"\x01\x02\x03\x04"


def test_audio_packet_rejects_invalid_payload_length():
    packet = AudioPacket(
        direction=AudioDirection.AI_TO_CUSTOMER,
        call_id="call-123",
        device_id="S9_01",
        sequence_number=1,
        timestamp_ms=1,
        sample_rate=16000,
        channels=1,
        payload=b"abc",
    )
    encoded = packet.encode()[:-1]

    try:
        AudioPacket.decode(encoded)
    except ValueError as exc:
        assert "payload length" in str(exc)
    else:
        raise AssertionError("Expected ValueError for truncated packet")
