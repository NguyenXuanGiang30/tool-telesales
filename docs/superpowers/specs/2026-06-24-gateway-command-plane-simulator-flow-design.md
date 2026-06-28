# Gateway Command Plane and Simulator Flow Design

## Goal

Build the Gateway command plane that lets real Android Agents or S9 simulators receive commands, ACK/NACK them, and provide an auditable command lifecycle for call allocation.

This package is the first production handover slice because later Android Agent, audio routing, and dashboard work all depend on a stable device command contract.

## Scope

In scope:

- In-memory command queue aligned with the current in-memory Gateway architecture.
- Command lifecycle for `DIAL`, `HANGUP`, `START_AUDIO`, `STOP_AUDIO`, and `PING`.
- Device polling endpoint for the next command.
- Device ACK/NACK endpoint.
- Command history endpoint.
- Router integration: allocated outbound calls enqueue `DIAL`.
- S9 simulator helpers for command ACK and state events.
- Unit and integration tests.

Out of scope:

- Persistent database storage.
- WebSocket push transport.
- Device token pairing.
- Real Android telephony or audio capture.

## Architecture

`DeviceCommandQueue` owns command lifecycle state. `CallRouter` remains the owner of call allocation, but when it attaches a device to a call it also enqueues the command needed by the device.

Android Agent or simulator devices poll:

```text
GET /api/v1/gateway/devices/{device_id}/commands/next
```

Then acknowledge:

```text
POST /api/v1/gateway/devices/{device_id}/commands/{command_id}/ack
```

The queue marks delivery and ACK/NACK timestamps so operations and later dashboards can audit what happened.

## Command Model

Each command contains:

- `command_id`
- `device_id`
- `command`
- `call_id`
- `payload`
- `status`
- `attempt_count`
- `created_at`
- `delivered_at`
- `acknowledged_at`
- `expires_at`
- `last_error`

Statuses:

- `queued`
- `delivered`
- `acked`
- `nacked`
- `expired`
- `failed`

Terminal statuses:

- `acked`
- `nacked`
- `expired`
- `failed`

## API Contract

### Next Command

Request:

```http
GET /api/v1/gateway/devices/S9_01/commands/next
```

Response with command:

```json
{
  "command": {
    "command_id": "uuid",
    "device_id": "S9_01",
    "command": "DIAL",
    "call_id": "call-id",
    "payload": {
      "phone_number": "0901000001",
      "sim_slot": 1,
      "audio_in_port": 50001,
      "audio_out_port": 50001
    },
    "status": "delivered",
    "attempt_count": 1
  }
}
```

Response without command:

```json
{"command": null}
```

### ACK/NACK

ACK:

```json
{"status": "acked"}
```

NACK:

```json
{"status": "nacked", "error": "telephony_failed"}
```

## Simulator Contract

The S9 simulator must be able to:

- Accept a command dictionary from API output.
- Produce ACK/NACK payloads.
- Convert a `DIAL` command to a `RINGING` device event.
- Convert a `HANGUP` command to a `DISCONNECTED` event.
- NACK unsupported commands.

## Acceptance Criteria

- Gateway tests pass.
- `DIAL` is queued exactly once when a call is allocated.
- A device can poll the next command and status becomes `delivered`.
- ACK marks command `acked`.
- NACK marks command `nacked` with error reason.
- Empty queue returns `{"command": null}`.
- Simulator can run a register -> dial -> poll command -> ACK -> ringing event flow.

## Detailed Dependencies

Inputs from existing code:

- `DeviceRegistry` owns device records and health.
- `CallSessionManager` owns call state.
- `CallRouter` allocates calls to idle healthy devices.
- `CommandName` enum already defines command names.
- `S9Simulator` already emits device events.

Outputs for later packages:

- Flutter Android Agent will consume command polling and ACK/NACK endpoints.
- Dashboard will display command history.
- Simulator soak tests will use command queue and simulator helpers.
- Audio routing package will rely on `START_AUDIO`/`STOP_AUDIO` commands later.

## State Machine

Command lifecycle:

```text
queued -> delivered -> acked
queued -> delivered -> nacked
queued -> expired
delivered -> expired
queued -> failed
delivered -> failed
```

Rules:

- A terminal command cannot be delivered again.
- A command can be ACKed/NACKed only for its assigned device.
- Expired commands remain visible in history.
- Unknown command id returns 404 through API.
- Unknown device id returns 404 through API.

## Failure Handling

- Device never polls: command expires.
- Device polls then never ACKs: command expires.
- Device sends NACK: command becomes terminal with `last_error`.
- Device sends invalid ACK status: API returns 400.
- Device tries to ACK another device command: API returns 404 to avoid leaking command existence.

## Handover Notes

This package gives customers a reliable control contract before Android hardware is present. It does not prove real telephony. It proves that Gateway can allocate calls and deliver auditable commands to the device side.
