from __future__ import annotations

import json
import struct
from dataclasses import dataclass
from enum import IntEnum


class AudioDirection(IntEnum):
    CUSTOMER_TO_AI = 1
    AI_TO_CUSTOMER = 2


@dataclass(frozen=True)
class AudioPacket:
    direction: AudioDirection
    call_id: str
    device_id: str
    sequence_number: int
    timestamp_ms: int
    sample_rate: int
    channels: int
    payload: bytes
    version: int = 1

    def encode(self) -> bytes:
        metadata = {
            "version": self.version,
            "direction": int(self.direction),
            "call_id": self.call_id,
            "device_id": self.device_id,
            "sequence_number": self.sequence_number,
            "timestamp_ms": self.timestamp_ms,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "payload_length": len(self.payload),
            "codec": "pcm16",
        }
        metadata_bytes = json.dumps(metadata, separators=(",", ":")).encode("utf-8")
        return struct.pack("!H", len(metadata_bytes)) + metadata_bytes + self.payload

    @classmethod
    def decode(cls, raw: bytes) -> "AudioPacket":
        if len(raw) < 2:
            raise ValueError("packet is too short")
        (metadata_length,) = struct.unpack("!H", raw[:2])
        metadata_end = 2 + metadata_length
        if len(raw) < metadata_end:
            raise ValueError("metadata length exceeds packet size")
        metadata = json.loads(raw[2:metadata_end].decode("utf-8"))
        payload = raw[metadata_end:]
        expected_length = int(metadata["payload_length"])
        if len(payload) != expected_length:
            raise ValueError(
                f"payload length mismatch: expected {expected_length}, got {len(payload)}"
            )
        return cls(
            version=int(metadata["version"]),
            direction=AudioDirection(int(metadata["direction"])),
            call_id=str(metadata["call_id"]),
            device_id=str(metadata["device_id"]),
            sequence_number=int(metadata["sequence_number"]),
            timestamp_ms=int(metadata["timestamp_ms"]),
            sample_rate=int(metadata["sample_rate"]),
            channels=int(metadata["channels"]),
            payload=payload,
        )
