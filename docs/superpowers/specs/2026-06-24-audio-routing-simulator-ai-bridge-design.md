# Audio Routing Simulator and AI Runtime Bridge Design

## Goal

Connect the existing Gateway audio packet contract to simulator input and the AI runtime so the system can run an end-to-end AI conversation path without real Boxphone hardware.

This package proves session-aware audio routing, AI session isolation, and AI response routing before the native S9 audio bridge exists.

## Scope

In scope:

- Session-aware audio router.
- Audio packet validation against active call/device session.
- Text-frame simulator input for deterministic tests.
- PCM frame input path into `RuntimeAIAdapter`.
- AI output frames mapped back to the correct device/call.
- Metrics for packet count, bytes, last sequence, dropped packets.
- Unit and integration tests.

Out of scope:

- Real UDP server hardening.
- Real STT/TTS provider implementation.
- Root/native audio capture/inject.
- Long-running soak test runner.

## Architecture

`AudioSessionRouter` sits between device audio packets and AI runtime.

```text
S9 simulator / Android Agent
  -> AudioPacket
  -> AudioSessionRouter
  -> RuntimeAIAdapter.receive_audio(call_id, pcm_frame)
  -> Assistant audio frames
  -> AudioPacket direction AI_TO_CUSTOMER
  -> device/simulator output queue
```

The router does not route by IP/port alone. It validates `call_id` and `device_id` against `CallSessionManager`.

## Text-Frame Mode

For simulator-certified testing, payloads may start with:

```text
TEXT:
```

The existing `RuntimeAIAdapter` already supports `TEXT:` frames. This package exposes that through `AudioPacket` so tests can simulate a customer saying:

```text
TEXT:toi quan tam bao gia
```

## Metrics

Per active call:

- packets in
- packets out
- bytes in
- bytes out
- last input sequence
- dropped sequence count
- last packet timestamp
- last error

## Error Handling

Reject and log:

- unknown call id
- unknown device id
- packet device does not own call
- packet for completed/failed session
- unsupported audio direction
- malformed packet

The router returns structured errors in tests and logs them for dashboard use later.

## Acceptance Criteria

- Router accepts customer-to-AI packets for active sessions.
- Router rejects packets from the wrong device.
- Router rejects packets for unknown or ended calls.
- Text-frame audio reaches AI runtime and updates AI result.
- AI output frames are packaged as `AI_TO_CUSTOMER` packets.
- Metrics update for accepted/rejected packets.
- Gateway and AI runtime tests pass.

## Detailed Dependencies

Inputs:

- Existing `AudioPacket` encode/decode contract.
- Existing `RuntimeAIAdapter` and AI conversation runtime.
- Existing `CallSessionManager` and `CallSession` ownership data.
- Simulator text-frame behavior from `RuntimeAIAdapter`.

Outputs:

- Dashboard can display audio metrics.
- Handover soak tests can verify session-aware audio routing without hardware.
- Native S9 audio bridge can later send the same `AudioPacket` format.

## Routing Rules

- Only `CUSTOMER_TO_AI` packets are accepted as router input.
- The packet `call_id` must exist.
- The packet `device_id` must match the session's assigned device.
- The session must not be `COMPLETED` or `FAILED`.
- Packets for unknown or inactive sessions are rejected and counted as errors.
- Output packets must always use `AI_TO_CUSTOMER`.

## Metrics Rules

- Count accepted input packets.
- Count output packets generated from AI frames.
- Track payload byte totals.
- Track sequence gaps.
- Track last error per call/device.
- Metrics must be read-only through API response objects.

## Hardware Boundary

This package proves software routing and AI session integration. It does not prove the S9 can capture or inject audio from a real GSM/VoLTE call path.

## Handover Notes

When Boxphone hardware becomes available, the native bridge should produce the same `AudioPacket` payloads that the simulator produces. Gateway logic should not need to change.
