from __future__ import annotations

from backend.gateway.ai_adapter import AIAdapter
from backend.gateway.audio_metrics import AudioMetricsRegistry
from backend.gateway.audio_protocol import AudioDirection, AudioPacket
from backend.gateway.models import CallState
from backend.gateway.registry import DeviceRegistry
from backend.gateway.session_manager import CallSessionManager


class AudioRoutingError(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


ACTIVE_AUDIO_STATES = {CallState.CONNECTED, CallState.AI_LISTENING, CallState.AI_THINKING, CallState.AI_SPEAKING}


class AudioSessionRouter:
    def __init__(
        self,
        sessions: CallSessionManager,
        registry: DeviceRegistry,
        ai_adapter: AIAdapter,
        metrics: AudioMetricsRegistry,
    ) -> None:
        self._sessions = sessions
        self._registry = registry
        self._ai_adapter = ai_adapter
        self._metrics = metrics

    async def handle_packet(self, packet: AudioPacket) -> list[AudioPacket]:
        if packet.direction != AudioDirection.CUSTOMER_TO_AI:
            self._metrics.record_error(packet.call_id, packet.device_id, "invalid_direction")
            raise AudioRoutingError("invalid_direction")

        try:
            session = self._sessions.get(packet.call_id)
        except KeyError as exc:
            self._metrics.record_error(packet.call_id, packet.device_id, "unknown_call")
            raise AudioRoutingError("unknown_call") from exc

        if session.state not in ACTIVE_AUDIO_STATES:
            self._metrics.record_error(packet.call_id, packet.device_id, "call_not_active")
            raise AudioRoutingError("call_not_active")

        if session.device_id != packet.device_id:
            self._metrics.record_error(packet.call_id, packet.device_id, "device_mismatch")
            raise AudioRoutingError("device_mismatch")

        # Record valid input packet in metrics
        self._metrics.record_input(packet.call_id, packet.device_id, packet.sequence_number, len(packet.payload))

        # Forward PCM/text payload to AI runtime
        frames = await self._ai_adapter.receive_audio(packet.call_id, packet.payload)

        responses: list[AudioPacket] = []
        for index, frame in enumerate(frames):
            seq_num = index + 1
            timestamp = packet.timestamp_ms + (index * 20)
            self._metrics.record_output(packet.call_id, packet.device_id, len(frame))
            responses.append(
                AudioPacket(
                    direction=AudioDirection.AI_TO_CUSTOMER,
                    call_id=packet.call_id,
                    device_id=packet.device_id,
                    sequence_number=seq_num,
                    timestamp_ms=timestamp,
                    sample_rate=packet.sample_rate,
                    channels=packet.channels,
                    payload=frame,
                )
            )
        return responses
