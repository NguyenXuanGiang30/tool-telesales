# Boxphone Operations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operations dashboard for Boxphone devices, sessions, command history, audio metrics, and AI status.

**Architecture:** Extend the existing React frontend with typed API helpers and focused dashboard components. Keep operational views dense and scan-friendly, and isolate backend calls in `src/lib/api.ts` so backend endpoint changes do not leak through the UI.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing CSS/layout system, Gateway REST API, `npm.cmd run lint`.

---

## Task 1: Dashboard Test Harness

**Files:**

- Modify: `package.json`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Add the failing test script contract**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Add dev dependencies:

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create test setup**

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Update `vite.config.ts` with:

```ts
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  globals: true,
  passWithNoTests: true,
},
```

- [ ] **Step 3: Run test command before component tests exist**

Run:

```powershell
npm.cmd run test
```

Expected: exit code 0 after dependencies are installed because `passWithNoTests: true` is configured for the bootstrap commit.

- [ ] **Step 4: Run type check and commit**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: both commands exit 0.

Run:

```powershell
git add package.json vite.config.ts src\test\setup.ts
git commit -m "test: add frontend component test harness"
```

Expected: commit succeeds.

## Task 2: Gateway API Types and Client Methods

**Files:**

- Modify: `src/lib/api.ts`
- Test: `src/lib/api.boxphone.test.ts`

- [ ] **Step 1: Write failing API client tests**

Create `src/lib/api.boxphone.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getGatewayAIStatus,
  listGatewayAudioMetrics,
  listGatewayDeviceCommands,
  listGatewayDevices,
  listGatewaySessions,
} from './api';

describe('Boxphone gateway API client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads device fleet from gateway API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      { device_id: 's9-001', status: 'idle', active_call_id: null, app_version: '0.1.0', audio_port: 46001 }
    ])));

    const devices = await listGatewayDevices();

    expect(devices[0].device_id).toBe('s9-001');
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/gateway/devices'), expect.any(Object));
  });

  it('loads sessions, commands, audio metrics, and AI status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([])));

    await expect(listGatewaySessions()).resolves.toEqual([]);
    await expect(listGatewayDeviceCommands('s9-001')).resolves.toEqual([]);
    await expect(listGatewayAudioMetrics()).resolves.toEqual([]);
    await expect(getGatewayAIStatus()).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd run test -- src/lib/api.boxphone.test.ts
```

Expected: FAIL because the Boxphone API functions are not exported from `src/lib/api.ts`.

- [ ] **Step 3: Add TypeScript contracts**

Modify `src/lib/api.ts`:

```ts
export interface GatewayDevice {
  device_id: string;
  ip_address?: string;
  status: 'offline' | 'online' | 'idle' | 'busy' | 'degraded' | 'error' | 'maintenance';
  app_version?: string | null;
  last_heartbeat_at?: string;
  active_call_id?: string | null;
  audio_port?: number | null;
  health?: {
    battery_percent?: number | null;
    temperature_c?: number | null;
    signal_dbm?: number | null;
    charging?: boolean | null;
    network_type?: string | null;
  };
}

export interface GatewaySession {
  call_id: string;
  phone_number: string;
  state: string;
  device_id?: string | null;
  sim_slot?: number | null;
  campaign_id?: string | null;
  failure_reason?: string | null;
}

export interface GatewayCommand {
  command_id: string;
  device_id: string;
  command: string;
  status: 'pending' | 'acked' | 'nacked' | 'expired';
  attempt_count: number;
  call_id?: string | null;
  last_error?: string | null;
}

export interface AudioMetric {
  call_id: string;
  device_id?: string | null;
  packets_in: number;
  packets_out: number;
  bytes_in: number;
  bytes_out: number;
  dropped_input_sequences: number;
  dropped_output_sequences: number;
  last_error?: string | null;
}

export interface AIStatus {
  call_id: string;
  provider: 'local' | 'builtin' | 'external';
  state: string;
  last_error?: string | null;
  endpoint?: string | null;
}
```

- [ ] **Step 4: Add client methods using existing `apiFetch`**

Add to `src/lib/api.ts`:

```ts
export function listGatewayDevices() {
  return apiFetch<GatewayDevice[]>('/gateway/devices');
}

export function listGatewaySessions() {
  return apiFetch<GatewaySession[]>('/gateway/sessions');
}

export function listGatewayDeviceCommands(deviceId?: string) {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  return apiFetch<GatewayCommand[]>(`/gateway/commands${query}`);
}

export function listGatewayAudioMetrics() {
  return apiFetch<AudioMetric[]>('/gateway/audio/metrics');
}

export function getGatewayAIStatus() {
  return apiFetch<AIStatus[]>('/gateway/ai/status');
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
npm.cmd run test -- src/lib/api.boxphone.test.ts
npm.cmd run lint
```

Expected: PASS.

Run:

```powershell
git add src\lib\api.ts src\lib\api.boxphone.test.ts
git commit -m "feat: add Boxphone dashboard API client"
```

Expected: commit succeeds.

## Task 3: Device Fleet Panel

**Files:**

- Create: `src/components/boxphone/DeviceFleetPanel.tsx`
- Test: `src/components/boxphone/DeviceFleetPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `src/components/boxphone/DeviceFleetPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeviceFleetPanel } from './DeviceFleetPanel';

describe('DeviceFleetPanel', () => {
  it('renders device health and active call state', () => {
    render(<DeviceFleetPanel
      devices={[{
        device_id: 's9-001',
        status: 'busy',
        active_call_id: 'call-001',
        app_version: '0.1.0',
        audio_port: 46001,
        health: { battery_percent: 88, temperature_c: 37.5, signal_dbm: -72, charging: true, network_type: 'wifi' },
      }]}
      selectedDeviceId="s9-001"
      onSelectDevice={vi.fn()}
      loading={false}
      error={null}
    />);

    expect(screen.getByText('s9-001')).toBeInTheDocument();
    expect(screen.getByText('call-001')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd run test -- src/components/boxphone/DeviceFleetPanel.test.tsx
```

Expected: FAIL because `DeviceFleetPanel.tsx` does not exist.

- [ ] **Step 3: Implement scan-friendly fleet panel**

Create `src/components/boxphone/DeviceFleetPanel.tsx` exporting:

```tsx
export function DeviceFleetPanel(props: {
  devices: GatewayDevice[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  loading: boolean;
  error: string | null;
}) {
  // Render loading, empty, error, and table states.
  // Columns: device id, status, active call, app version, audio port, heartbeat, battery, temp, signal, network.
}
```

Implementation requirements:

- Use table or dense grid, not marketing cards.
- Use status chips with stable widths.
- Loading text: `Loading devices`.
- Empty text: `No Boxphone devices registered`.
- Error text prefix: `Device API error:`.
- Do not hardcode demo rows in production render path.

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
npm.cmd run test -- src/components/boxphone/DeviceFleetPanel.test.tsx
npm.cmd run lint
```

Expected: PASS.

Run:

```powershell
git add src\components\boxphone\DeviceFleetPanel.tsx src\components\boxphone\DeviceFleetPanel.test.tsx
git commit -m "feat: add Boxphone device fleet panel"
```

Expected: commit succeeds.

## Task 4: Sessions, Commands, Audio, and AI Panels

**Files:**

- Create: `src/components/boxphone/SessionPanel.tsx`
- Create: `src/components/boxphone/CommandHistoryPanel.tsx`
- Create: `src/components/boxphone/AudioMetricsPanel.tsx`
- Create: `src/components/boxphone/AIStatusPanel.tsx`
- Test: `src/components/boxphone/BoxphonePanels.test.tsx`

- [ ] **Step 1: Write failing panel tests**

Create `src/components/boxphone/BoxphonePanels.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AIStatusPanel } from './AIStatusPanel';
import { AudioMetricsPanel } from './AudioMetricsPanel';
import { CommandHistoryPanel } from './CommandHistoryPanel';
import { SessionPanel } from './SessionPanel';

describe('Boxphone operation panels', () => {
  it('renders sessions and commands for selected device', () => {
    render(<SessionPanel loading={false} error={null} sessions={[{ call_id: 'call-001', phone_number: '+84901234567', state: 'connected', device_id: 's9-001' }]} />);
    render(<CommandHistoryPanel loading={false} error={null} commands={[{ command_id: 'cmd-001', device_id: 's9-001', command: 'DIAL', status: 'acked', attempt_count: 1, call_id: 'call-001' }]} />);

    expect(screen.getByText('call-001')).toBeInTheDocument();
    expect(screen.getByText('DIAL')).toBeInTheDocument();
  });

  it('renders audio metrics and AI status', () => {
    render(<AudioMetricsPanel loading={false} error={null} metrics={[{ call_id: 'call-001', packets_in: 3, packets_out: 2, bytes_in: 480, bytes_out: 320, dropped_input_sequences: 0, dropped_output_sequences: 0 }]} />);
    render(<AIStatusPanel loading={false} error={null} statuses={[{ call_id: 'call-001', provider: 'local', state: 'speaking', endpoint: 'http://127.0.0.1:11434' }]} />);

    expect(screen.getByText('480 B')).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd run test -- src/components/boxphone/BoxphonePanels.test.tsx
```

Expected: FAIL because the panel components do not exist.

- [ ] **Step 3: Implement the panels**

Each panel must accept `loading`, `error`, and data props. Required empty/error text:

```ts
const emptyText = {
  sessions: 'No active Boxphone sessions',
  commands: 'No command history',
  audio: 'No audio metrics',
  ai: 'No AI runtime sessions',
};
```

Render requirements:

- `SessionPanel`: call id, phone number, state, device id, SIM slot, campaign id, failure reason.
- `CommandHistoryPanel`: command id, command, status, attempt count, call id, last error.
- `AudioMetricsPanel`: packets in/out, bytes in/out, dropped sequences, last error.
- `AIStatusPanel`: active AI sessions, provider, state, endpoint, last error.

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
npm.cmd run test -- src/components/boxphone/BoxphonePanels.test.tsx
npm.cmd run lint
```

Expected: PASS.

Run:

```powershell
git add src\components\boxphone src\components\boxphone\BoxphonePanels.test.tsx
git commit -m "feat: add Boxphone operation panels"
```

Expected: commit succeeds.

## Task 5: Wire Dashboard Into System Settings

**Files:**

- Modify: `src/pages/SystemSettings.tsx`
- Test: `src/pages/SystemSettings.boxphone.test.tsx`

- [ ] **Step 1: Write failing page integration test**

Create `src/pages/SystemSettings.boxphone.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SystemSettings from './SystemSettings';

describe('SystemSettings Boxphone dashboard', () => {
  it('loads Boxphone dashboard sections without removing existing GSM settings', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([])));

    render(<SystemSettings />);

    await waitFor(() => expect(screen.getByText('Boxphone Operations')).toBeInTheDocument());
    expect(screen.getByText('Device Fleet')).toBeInTheDocument();
    expect(screen.getByText('Audio Metrics')).toBeInTheDocument();
    expect(screen.getByText(/Gateway/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd run test -- src/pages/SystemSettings.boxphone.test.tsx
```

Expected: FAIL because Boxphone dashboard sections are not mounted.

- [ ] **Step 3: Implement page data loading**

Modify `src/pages/SystemSettings.tsx`:

- Keep the existing SIP/GSM configuration UI available.
- Add a `Boxphone Operations` section below or beside current gateway settings.
- Fetch devices, sessions, commands, audio metrics, and AI status with the client functions from `src/lib/api.ts`.
- Use independent error state per endpoint so one failed endpoint does not blank the entire dashboard.
- Poll every 5 seconds while the page is mounted; clear interval on unmount.
- Filter command history by selected device when a device is selected.

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
npm.cmd run test -- src/pages/SystemSettings.boxphone.test.tsx src/components/boxphone/DeviceFleetPanel.test.tsx src/components/boxphone/BoxphonePanels.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: PASS and build exits 0.

Run:

```powershell
git add src\pages\SystemSettings.tsx src\pages\SystemSettings.boxphone.test.tsx
git commit -m "feat: wire Boxphone operations dashboard"
```

Expected: commit succeeds.

## Task 6: Dashboard Verification

- [ ] **Step 1: Run frontend checks**

Run:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run backend Gateway regression tests**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
```

Expected: PASS.

- [ ] **Step 3: Check branch status**

Run:

```powershell
git status --short --branch
```

Expected: only intended dashboard files are modified or working tree is clean after commits.

---

## Detailed UI Architecture

Use a focused Boxphone operations area inside the current app instead of a marketing-style page.

Recommended component tree:

```text
SystemSettings
  -> BoxphoneOperationsDashboard
    -> DeviceFleetPanel
    -> SessionPanel
    -> CommandHistoryPanel
    -> AudioMetricsPanel
    -> AIStatusPanel
```

If `SystemSettings.tsx` is already too broad, create:

```text
src/pages/BoxphoneOperations.tsx
```

and add it to the existing navigation only if the current routing structure supports it cleanly.

No nested cards. Use full-width dashboard sections with compact tables.

---

## Detailed Type Contracts

Add these types to `src/lib/api.ts` or a nearby file if the existing API file is already large:

```ts
export type DeviceStatus =
  | 'offline'
  | 'online'
  | 'idle'
  | 'busy'
  | 'degraded'
  | 'error'
  | 'maintenance'

export interface GatewayDeviceHealth {
  battery_percent: number | null
  temperature_c: number | null
  signal_dbm: number | null
  charging: boolean | null
  network_type: string | null
  storage_free_mb: number | null
}

export interface GatewayDevice {
  device_id: string
  ip_address: string
  status: DeviceStatus
  app_version: string | null
  last_heartbeat_at: string
  active_call_id: string | null
  audio_port: number | null
  health: GatewayDeviceHealth
}

export interface GatewaySession {
  call_id: string
  phone_number: string
  state: string
  campaign_id: string | null
  lead_id: string | null
  device_id: string | null
  sim_slot: number | null
  audio_in_port: number | null
  audio_out_port: number | null
  ai_session_id: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
  connected_at: string | null
  ended_at: string | null
}

export interface GatewayCommand {
  command_id: string
  device_id: string
  command: string
  call_id: string | null
  payload: Record<string, unknown>
  status: string
  attempt_count: number
  created_at: string
  delivered_at: string | null
  acknowledged_at: string | null
  expires_at: string | null
  last_error: string | null
}

export interface AudioMetric {
  call_id: string
  device_id: string
  packets_in: number
  packets_out: number
  bytes_in: number
  bytes_out: number
  last_input_sequence: number | null
  dropped_input_sequences: number
  last_packet_at: string | null
  last_error: string | null
}

export interface AIStatus {
  active_sessions: number
  provider_mode: string
  local_model_base_url: string | null
  last_error: string | null
}
```

API function behavior:

- Return typed data.
- Throw an `Error` with endpoint path in the message on non-2xx responses.
- Do not swallow errors inside API helpers. Components own display states.

---

## Detailed Component Contracts

### `DeviceFleetPanel`

Props:

```ts
interface DeviceFleetPanelProps {
  devices: GatewayDevice[]
  loading: boolean
  error: string | null
  selectedDeviceId: string | null
  onSelectDevice: (deviceId: string) => void
  onRefresh: () => void
}
```

Columns:

- Device
- Status
- Active call
- IP
- Audio port
- App version
- Battery
- Temp
- Signal
- Last heartbeat

Status color rules:

- `idle`, `online`: neutral/success
- `busy`: active
- `degraded`: warning
- `offline`, `error`: danger
- `maintenance`: muted

### `SessionPanel`

Props:

```ts
interface SessionPanelProps {
  sessions: GatewaySession[]
  loading: boolean
  error: string | null
  selectedDeviceId: string | null
  onRefresh: () => void
}
```

Filtering:

- If `selectedDeviceId` is set, show sessions for that device plus queued sessions.
- Otherwise show latest active/recent sessions.

Columns:

- Call ID
- Phone
- State
- Device
- SIM
- Campaign
- Lead
- Failure
- Updated

### `CommandHistoryPanel`

Props:

```ts
interface CommandHistoryPanelProps {
  commands: GatewayCommand[]
  loading: boolean
  error: string | null
  selectedDeviceId: string | null
  onRefresh: () => void
}
```

Columns:

- Command ID
- Command
- Status
- Attempts
- Call ID
- Created
- Delivered
- ACKed
- Error

### `AudioMetricsPanel`

Props:

```ts
interface AudioMetricsPanelProps {
  metrics: AudioMetric[]
  loading: boolean
  error: string | null
  selectedDeviceId: string | null
  onRefresh: () => void
}
```

Columns:

- Call ID
- Device
- Packets in/out
- Bytes in/out
- Last sequence
- Dropped
- Last packet
- Last error

### `AIStatusPanel`

Props:

```ts
interface AIStatusPanelProps {
  status: AIStatus | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}
```

Display:

- Active sessions.
- Provider mode.
- Local model URL if configured.
- Last error.
- If endpoint is missing, show error state: `AI status endpoint is not available yet`.

---

## Detailed Data Loading Behavior

Dashboard page state:

- Load devices and sessions on mount.
- Load command history when a device is selected.
- Load audio metrics on mount.
- Load AI status on mount.
- Provide manual refresh buttons per panel.

Refresh strategy:

- Initial package may use manual refresh only.
- Auto-refresh every 5 seconds can be added if it does not cause test instability.
- Do not create multiple overlapping requests for the same panel.

Error handling:

- If one panel fails, other panels still render.
- Error text includes endpoint category, not stack trace.
- Empty state text is explicit:
  - `No devices registered`
  - `No active or recent sessions`
  - `No commands for selected device`
  - `No audio metrics yet`

---

## Detailed Test Matrix

The repo currently uses TypeScript lint as the main frontend verification. If a test framework is added later, use these test cases:

- API helper builds `/api/v1/gateway/devices`.
- API helper builds `/api/v1/gateway/sessions`.
- API helper builds `/api/v1/gateway/devices/{device_id}/commands`.
- Device panel renders offline/error/degraded/busy/idle statuses.
- Device panel calls `onSelectDevice`.
- Session panel filters by selected device.
- Command panel renders NACK error.
- Audio panel renders dropped packet count.
- AI panel renders missing endpoint error.

For this package, required verification is:

```powershell
npm.cmd run lint
```

and backend tests:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
```

---

## Visual Constraints

- Operational density is preferred over large decorative panels.
- No hero sections.
- No nested cards.
- Tables must not overflow narrow desktop widths; use horizontal scroll inside the table region if needed.
- Status chips must use text plus color, not color alone.
- Timestamps should be compact and readable.

---

## Delivery Gate

This package is complete only when:

- Boxphone dashboard is reachable from the existing UI.
- Device/session/command/audio/AI sections exist.
- Missing backend endpoints produce controlled panel errors, not page crashes.
- `npm.cmd run lint` exits 0.
- Gateway backend tests still pass.
