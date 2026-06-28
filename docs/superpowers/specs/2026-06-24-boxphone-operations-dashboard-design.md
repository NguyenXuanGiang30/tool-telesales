# Boxphone Operations Dashboard Design

## Goal

Add an operations dashboard that lets IT/admin users monitor Boxphone devices, call sessions, command flow, audio state, AI status, and operational errors from one place.

The dashboard is not a marketing UI. It is a dense operational surface for diagnosing device and session state during simulator-certified and later hardware-certified deployments.

## Scope

In scope:

- Device status table.
- Device health indicators.
- Active/recent call sessions table.
- Command history view.
- Audio metrics view.
- AI adapter/runtime status panel.
- Gateway API client functions for the dashboard.
- Frontend tests or type/lint verification.

Out of scope:

- User authentication/roles.
- Historical analytics warehouse.
- Realtime WebSocket dashboard.
- Campaign authoring redesign.

## Dashboard Layout

Main page: `SystemSettings` or a new `BoxphoneDashboard` route depending on current routing conventions.

Sections:

- Device Fleet
- Active Calls
- Command Queue
- Audio Metrics
- AI Runtime
- Recent Errors

The layout should be compact, scan-friendly, and suitable for repeated operations work.

## API Dependencies

Uses existing or planned endpoints:

- `GET /api/v1/gateway/devices`
- `GET /api/v1/gateway/sessions`
- `GET /api/v1/gateway/devices/{device_id}/commands`
- future `GET /api/v1/gateway/audio/metrics`
- future `GET /api/v1/gateway/ai/status`

When later endpoints are not yet implemented, frontend must isolate API calls so missing backend pieces are easy to add in the matching package.

## UI States

Each section must handle:

- loading
- empty
- populated
- error

Device severity:

- online/idle: normal
- busy: active
- degraded: warning
- offline/error: danger

## Acceptance Criteria

- Dashboard shows device list and health.
- Dashboard shows sessions.
- Dashboard shows command history when endpoint exists.
- Empty/error states are visible and not confusing.
- TypeScript lint passes.
- UI does not depend on hardcoded demo data for production paths.

## Detailed Dependencies

Inputs:

- Gateway device and session endpoints already exist.
- Command history endpoint comes from Gateway command plane package.
- Audio metrics endpoint comes from audio routing package.
- AI status endpoint may be added in a later backend package; dashboard must handle absence gracefully.

Outputs:

- Customer/operator can inspect system state without reading logs.
- Handover docs can reference a concrete operations screen.
- Simulator soak tests can be observed visually when the app is running.

## Operational Questions The Dashboard Must Answer

- Which devices are online?
- Which devices are busy or degraded?
- Which call is on which device?
- Did a device receive and ACK its command?
- Are packets flowing for an active call?
- Is AI responding or failing?
- What should an operator inspect next when something fails?

## Error-State Requirements

- Device API failure affects only device panel.
- Sessions API failure affects only session panel.
- Command API failure affects only command panel.
- Audio metrics endpoint missing shows a controlled message.
- AI status endpoint missing shows a controlled message.
- The page itself must not crash because one endpoint fails.

## Handover Notes

This dashboard is an operations surface, not a sales landing page. It should be compact, predictable, and useful during troubleshooting.
