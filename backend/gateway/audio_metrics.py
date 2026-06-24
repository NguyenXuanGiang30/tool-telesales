from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import RLock


@dataclass
class AudioSessionMetrics:
    call_id: str
    device_id: str
    packets_in: int = 0
    packets_out: int = 0
    bytes_in: int = 0
    bytes_out: int = 0
    last_input_sequence: int | None = None
    dropped_input_sequences: int = 0
    last_packet_at: datetime | None = None
    last_error: str | None = None

    def as_dict(self) -> dict:
        return {
            "call_id": self.call_id,
            "device_id": self.device_id,
            "packets_in": self.packets_in,
            "packets_out": self.packets_out,
            "bytes_in": self.bytes_in,
            "bytes_out": self.bytes_out,
            "last_input_sequence": self.last_input_sequence,
            "dropped_input_sequences": self.dropped_input_sequences,
            "last_packet_at": self.last_packet_at.isoformat() if self.last_packet_at else None,
            "last_error": self.last_error,
        }

    def to_dict(self) -> dict:
        return self.as_dict()


class AudioMetricsRegistry:
    def __init__(self) -> None:
        self._metrics: dict[str, AudioSessionMetrics] = {}
        self._lock = RLock()

    def get(self, call_id: str, device_id: str) -> AudioSessionMetrics:
        with self._lock:
            if call_id not in self._metrics:
                self._metrics[call_id] = AudioSessionMetrics(call_id=call_id, device_id=device_id)
            return self._metrics[call_id]

    def record_input(self, call_id: str, device_id: str, sequence_number: int, byte_count: int) -> AudioSessionMetrics:
        with self._lock:
            metrics = self.get(call_id, device_id)
            metrics.packets_in += 1
            metrics.bytes_in += byte_count
            metrics.last_packet_at = datetime.now(timezone.utc)

            if metrics.last_input_sequence is None:
                metrics.last_input_sequence = sequence_number
            else:
                if sequence_number > metrics.last_input_sequence + 1:
                    metrics.dropped_input_sequences += sequence_number - metrics.last_input_sequence - 1
                    metrics.last_input_sequence = sequence_number
                elif sequence_number <= metrics.last_input_sequence:
                    metrics.last_error = "out_of_order_sequence"
                else:
                    metrics.last_input_sequence = sequence_number
            return metrics

    def record_output(self, call_id: str, device_id: str, byte_count: int) -> AudioSessionMetrics:
        with self._lock:
            metrics = self.get(call_id, device_id)
            metrics.packets_out += 1
            metrics.bytes_out += byte_count
            metrics.last_packet_at = datetime.now(timezone.utc)
            return metrics

    def record_error(self, call_id: str, device_id: str, error: str) -> AudioSessionMetrics:
        with self._lock:
            metrics = self.get(call_id, device_id)
            metrics.last_error = error
            metrics.last_packet_at = datetime.now(timezone.utc)
            return metrics

    def list_all(self) -> list[AudioSessionMetrics]:
        with self._lock:
            return list(self._metrics.values())
