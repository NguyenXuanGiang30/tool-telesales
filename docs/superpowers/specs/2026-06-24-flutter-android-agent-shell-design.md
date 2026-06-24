# Flutter Android Agent Shell Design

## Goal

Create a Flutter Android Agent shell that can be installed as an APK, configured for a Gateway, register itself, send heartbeat/health, poll commands, ACK/NACK command execution, and expose native-service boundaries for later telephony/audio work.

This package makes the Android side plug-compatible with the Gateway command plane even before Samsung S9 hardware is available.

## Scope

In scope:

- New `android_agent/` Flutter app.
- Configuration screen for Gateway URL, device id, device token, and audio port.
- Local config persistence.
- Gateway HTTP client.
- Agent controller for register, heartbeat, health, command poll, ACK/NACK.
- Log stream for operator visibility.
- Foreground service skeleton through Android native layer.
- Method channel boundary for future native telephony/audio bridge.
- Simulator bridge mode that handles commands without hardware.

Out of scope:

- Real telephony dial/hangup on S9.
- Root audio capture/inject.
- Push WebSocket transport.
- Production MDM provisioning.

## Architecture

Flutter owns UI, config, logs, and orchestration. Native Android owns long-running service hooks and later hardware-specific telephony/audio work.

Layers:

```text
Flutter UI
  -> AgentController
    -> GatewayClient
    -> LocalAgentStore
    -> CommandHandler
      -> PlatformBridge
        -> Android Foreground Service / future TelephonyBridge / future AudioBridge
```

## App Screens

### Agent Setup

Fields:

- Gateway base URL
- Device ID
- Device token
- Audio port
- Heartbeat interval seconds
- Poll interval seconds

Actions:

- Save config
- Register now
- Start agent
- Stop agent

### Agent Status

Shows:

- Connection state
- Last register time
- Last heartbeat time
- Last command id/status
- Active call id
- Audio mode
- Recent logs

## Gateway Client Contract

The app calls:

- `POST /api/v1/gateway/devices/register`
- `POST /api/v1/gateway/devices/{device_id}/heartbeat`
- `POST /api/v1/gateway/devices/{device_id}/health`
- `GET /api/v1/gateway/devices/{device_id}/commands/next`
- `POST /api/v1/gateway/devices/{device_id}/commands/{command_id}/ack`

The client must treat 4xx as non-retryable config/auth errors and 5xx/network errors as retryable.

## Command Handling

Supported command behavior in shell mode:

- `PING`: ACK.
- `DIAL`: simulator bridge marks active call and ACKs.
- `HANGUP`: clears active call and ACKs.
- `START_AUDIO`: ACKs but keeps audio mode as simulated.
- `STOP_AUDIO`: ACKs and clears audio mode.
- Unknown command: NACK with `unsupported_command:<name>`.

## Native Boundary

The first native skeleton exposes method channel methods:

- `startForegroundService`
- `stopForegroundService`
- `getNativeStatus`

Later S9 hardware package can add:

- `dial`
- `hangup`
- `startAudioBridge`
- `stopAudioBridge`

## Acceptance Criteria

- Flutter project exists under `android_agent/`.
- App can save and load config.
- App can register to Gateway.
- App can heartbeat and send health.
- App can poll command and ACK/NACK.
- App shows logs and current state.
- Native method channel has a foreground-service skeleton.
- If Flutter SDK is available, `flutter test` passes.
- If Android toolchain is available, APK build command is documented and works in that environment.

## Detailed Dependencies

Inputs:

- Gateway command plane package must expose register, heartbeat, health, next command, ACK/NACK.
- Device token enforcement may be added later; the Agent still stores and sends a token from the first version.
- Flutter SDK and Android build toolchain are required only for build verification, not for backend work.

Outputs:

- Android Agent package becomes the client contract for real Boxphone devices.
- Native bridge interfaces become the attachment point for Samsung S9 telephony/audio code.
- Dashboard can use Agent logs and states once API exposes them.

## Agent State Machine

```text
stopped
  -> configured
  -> registering
  -> registered
  -> running
  -> degraded
  -> error
  -> stopped
```

Rules:

- Missing or invalid config keeps state `stopped`.
- Register success sets `registered`.
- Heartbeat or poll retryable error sets `degraded` but keeps loops running.
- Non-retryable config/auth error sets `error` and stops loops.
- Manual stop cancels loops and returns to `stopped`.

## Security Requirements

- Device token must not be hardcoded.
- Token is sent only as `X-Device-Token`.
- UI must not log the full token.
- Logs can show token presence as `configured` or `missing`.

## Hardware Boundary

The shell must not pretend to dial real calls. In this package `DIAL` is handled by simulator mode only. Real telephony is a later hardware package that implements the platform bridge without changing Gateway contracts.

## Handover Notes

This package can be delivered and reviewed without S9 hardware if Flutter SDK is available. It demonstrates installable app structure and device control compatibility, not real call audio capture/inject.
