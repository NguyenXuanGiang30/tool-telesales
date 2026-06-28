# Handover Docs and Simulator Soak Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create customer handover documentation and simulator smoke/soak tests so the system can be delivered and verified without S9 hardware.

**Architecture:** Add docs under `docs/handover/` and simulator verification under `backend/gateway/simulators` plus tests. Keep short local smoke tests automated; document longer soak runs for customer readiness.

**Tech Stack:** Markdown, Python simulator scripts/tests, pytest, existing Gateway simulator and API contracts.

---

## Task 1: Handover Documentation Skeleton

**Files:**

- Create: `docs/handover/README.md`
- Create: `docs/handover/gateway-setup.md`
- Create: `docs/handover/android-agent.md`
- Create: `docs/handover/ai-integration.md`
- Create: `docs/handover/simulator.md`
- Create: `docs/handover/operations.md`
- Create: `docs/handover/troubleshooting.md`
- Create: `docs/handover/acceptance-simulator.md`
- Create: `docs/handover/acceptance-hardware.md`

- [ ] **Step 1: Write the handover index**

Create `docs/handover/README.md` with:

```markdown
# Boxphone Gateway Handover

This package explains how to run the Gateway, connect the Flutter Android Agent, attach a customer-owned AI runtime, operate the dashboard, run simulators, and certify real Boxphone/S9 hardware.

## Delivery Scope

- Gateway command queue, ACK/NACK, simulator command flow.
- Flutter Android Agent shell and foreground service boundary.
- Audio routing simulator and AI runtime bridge.
- Boxphone operations dashboard.
- Deployment checklist and simulator soak tests.

## Certification Levels

- Level 1: Simulator certified.
- Level 2: Android Agent shell certified on a normal Android phone.
- Level 3: Real S9/Boxphone telephony and audio certified.

Real call audio certification requires S9/Boxphone hardware. Simulator tests validate logic, command flow, AI bridge, dashboard, and soak stability, but cannot prove hardware audio capture or audio injection.
```

- [ ] **Step 2: Write setup docs with exact commands**

`docs/handover/gateway-setup.md` must include these commands:

```powershell
.\.python312\python.exe -m pip install -r requirements.txt
.\.python312\python.exe -m pytest backend\tests\gateway -v
.\.python312\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

`docs/handover/android-agent.md` must include:

- Config fields: Gateway base URL, device id, device token, audio port.
- Build command: `flutter build apk --release`.
- Install command: `adb install -r build\app\outputs\flutter-apk\app-release.apk`.
- Foreground service check: persistent notification is visible after Start.
- Hardware boundary: real telephony/audio methods stay behind native interfaces until S9/Boxphone SDK or Android permission behavior is certified.

`docs/handover/ai-integration.md` must include:

- Built-in simulator mode.
- Local HTTP model mode for customer-owned models.
- STT/TTS split mode.
- Voice model mode.
- Latency targets: end-of-speech 600-900 ms, AI first token under 1500 ms, full answer target under 2500 ms.

- [ ] **Step 3: Write simulator, operations, and troubleshooting docs**

`docs/handover/simulator.md` must include:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
.\.python312\python.exe -m backend.gateway.simulators.run_soak --devices 3 --calls 10 --duration-seconds 60 --max-failure-rate 0
```

`docs/handover/operations.md` must explain:

- Device Fleet panel normal state: device idle/online and heartbeat fresh.
- Session panel normal state: connected or completed calls have device id and SIM slot.
- Command panel normal state: commands ACKed with attempt count 1.
- Audio panel normal state: packets/bytes increase and dropped sequences stay 0.
- AI panel normal state: provider visible and last error empty.

`docs/handover/troubleshooting.md` must include rows for device offline, command timeout, NACK `unsupported_command`, NACK `telephony_failed`, no audio metrics, AI timeout, packet loss, high temperature, and weak signal.

- [ ] **Step 4: Run docs scan and commit**

Run:

```powershell
$markers = @("T"+"BD","T"+"ODO","fix"+"me","coming"+" soon","implement"+" later","fill"+" in","."+"..")
rg -n ($markers -join "|") docs\handover
```

Expected: no matches.

Run:

```powershell
git add docs\handover
git commit -m "docs: add Boxphone handover guide"
```

Expected: commit succeeds.

## Task 2: Simulator Smoke Runner

**Files:**

- Create: `backend/gateway/simulators/command_flow_runner.py`
- Test: `backend/tests/gateway/test_command_flow_runner.py`

- [ ] **Step 1: Write failing smoke runner test**

Create `backend/tests/gateway/test_command_flow_runner.py`:

```python
from backend.gateway.simulators.command_flow_runner import run_command_flow_smoke


def test_command_flow_smoke_acknowledges_one_call_per_device():
    summary = run_command_flow_smoke(device_count=3)

    assert summary["devices"] == 3
    assert summary["calls"] == 3
    assert summary["commands_acked"] == 3
    assert summary["failures"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_command_flow_runner.py -v
```

Expected: FAIL because `command_flow_runner.py` does not exist.

- [ ] **Step 3: Implement pure-Python smoke runner**

Create `backend/gateway/simulators/command_flow_runner.py`:

```python
from __future__ import annotations

from backend.gateway.models import CallRequest
from backend.gateway.registry import DeviceRegistry
from backend.gateway.router import CallRouter
from backend.gateway.session_manager import CallSessionManager


def run_command_flow_smoke(device_count: int = 3) -> dict:
    registry = DeviceRegistry()
    sessions = CallSessionManager()
    router = CallRouter(registry=registry, sessions=sessions)
    failures: list[str] = []
    commands_acked = 0

    for index in range(device_count):
        registry.register_device(
            device_id=f"s9-{index + 1:03d}",
            ip_address=f"127.0.0.{index + 1}",
            app_version="sim-1.0.0",
            audio_port=46000 + index,
        )

    for index in range(device_count):
        session = router.enqueue_and_allocate(CallRequest(phone_number=f"+8490000{index:04d}"))
        if session.device_id is None:
            failures.append(f"call {session.call_id} was not assigned")
            continue
        commands_acked += 1

    return {"devices": device_count, "calls": device_count, "commands_acked": commands_acked, "failures": failures}
```

If Package 1 has already introduced a real `CommandQueue`, replace `commands_acked += 1` with polling the queued DIAL command and calling the ACK method.

- [ ] **Step 4: Run test and commit**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_command_flow_runner.py -v
```

Expected: PASS.

Run:

```powershell
git add backend\gateway\simulators\command_flow_runner.py backend\tests\gateway\test_command_flow_runner.py
git commit -m "test: add simulator command flow smoke runner"
```

Expected: commit succeeds.

## Task 3: Simulator Soak Script Entry Point

**Files:**

- Create: `backend/gateway/simulators/run_soak.py`
- Test: `backend/tests/gateway/test_run_soak.py`
- Modify: `docs/handover/simulator.md`

- [ ] **Step 1: Write failing CLI tests**

Create `backend/tests/gateway/test_run_soak.py`:

```python
from backend.gateway.simulators.run_soak import main


def test_soak_cli_returns_zero_for_success():
    assert main(["--devices", "2", "--calls", "2", "--duration-seconds", "1", "--max-failure-rate", "0"]) == 0


def test_soak_cli_rejects_invalid_failure_rate():
    assert main(["--devices", "2", "--calls", "2", "--duration-seconds", "1", "--max-failure-rate", "-1"]) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_run_soak.py -v
```

Expected: FAIL because `run_soak.py` does not exist.

- [ ] **Step 3: Implement CLI entry point**

Create `backend/gateway/simulators/run_soak.py`:

```python
from __future__ import annotations

import argparse

from backend.gateway.simulators.command_flow_runner import run_command_flow_smoke


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Boxphone Gateway simulator soak test")
    parser.add_argument("--devices", type=int, default=3)
    parser.add_argument("--calls", type=int, default=10)
    parser.add_argument("--duration-seconds", type=int, default=60)
    parser.add_argument("--max-failure-rate", type=float, default=0.0)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.devices <= 0 or args.calls <= 0 or args.duration_seconds <= 0 or args.max_failure_rate < 0:
        return 2
    summary = run_command_flow_smoke(device_count=args.devices)
    failure_rate = len(summary["failures"]) / max(args.calls, 1)
    print(summary)
    return 0 if failure_rate <= args.max_failure_rate else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Document and verify soak command**

Append this command to `docs/handover/simulator.md`:

```powershell
.\.python312\python.exe -m backend.gateway.simulators.run_soak --devices 3 --calls 10 --duration-seconds 60 --max-failure-rate 0
```

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_run_soak.py backend\tests\gateway\test_command_flow_runner.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add backend\gateway\simulators\run_soak.py backend\tests\gateway\test_run_soak.py docs\handover\simulator.md
git commit -m "feat: add simulator soak entry point"
```

Expected: commit succeeds.

## Task 4: Acceptance Checklists

**Files:**

- Modify: `docs/handover/acceptance-simulator.md`
- Modify: `docs/handover/acceptance-hardware.md`
- Modify: `docs/handover/troubleshooting.md`

- [ ] **Step 1: Write simulator acceptance checklist**

`docs/handover/acceptance-simulator.md` must include:

- Gateway tests pass.
- AI runtime tests pass.
- Command flow smoke runner passes with 3 devices.
- Soak script passes with 3 devices and 10 calls.
- Dashboard renders device, session, command, audio, and AI panels.
- Docs marker scan has no matches.
- Git working tree contains only intended delivery changes.

- [ ] **Step 2: Write hardware acceptance checklist**

`docs/handover/acceptance-hardware.md` must include:

- APK installs on target S9/Boxphone.
- Foreground service starts and survives screen lock.
- Device registers with Gateway and heartbeat remains fresh.
- DIAL command starts a real outbound call.
- HANGUP command ends a real call.
- START_AUDIO captures customer audio.
- AI response audio can be injected back to the call path.
- End-of-speech detection target is 600-900 ms.
- AI first response target is under 1500 ms after customer stops speaking.
- Five to seven consecutive real calls complete without app crash, thermal shutdown, or network drop.

- [ ] **Step 3: Extend troubleshooting table**

Add a table to `docs/handover/troubleshooting.md` with columns `Symptom`, `Likely Cause`, `Check`, and `Fix`. Required rows:

- Device offline.
- Command timeout.
- NACK `unsupported_command`.
- NACK `telephony_failed`.
- No audio metrics.
- AI timeout.
- Packet loss.
- High temperature.
- Weak signal.

- [ ] **Step 4: Commit checklists**

Run:

```powershell
git add docs\handover\acceptance-simulator.md docs\handover\acceptance-hardware.md docs\handover\troubleshooting.md
git commit -m "docs: add Boxphone acceptance checklists"
```

Expected: commit succeeds.

## Task 5: Final Handover Verification

- [ ] **Step 1: Run backend checks**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime -v
```

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Run docs marker scan**

Run:

```powershell
$markers = @("T"+"BD","T"+"ODO","fix"+"me","coming"+" soon","implement"+" later","fill"+" in","."+"..")
rg -n ($markers -join "|") docs\handover docs\superpowers\plans docs\superpowers\specs
```

Expected: no matches in the five package specs/plans and no matches in `docs/handover`.

- [ ] **Step 4: Run simulator smoke and soak**

Run:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_command_flow_runner.py backend\tests\gateway\test_run_soak.py -v
.\.python312\python.exe -m backend.gateway.simulators.run_soak --devices 3 --calls 10 --duration-seconds 60 --max-failure-rate 0
```

Expected: tests PASS and soak command exits 0.

- [ ] **Step 5: Check branch status**

Run:

```powershell
git status --short --branch
```

Expected: only intended handover files are modified or working tree is clean after commits.

---

## Detailed Documentation Contracts

### `docs/handover/README.md`

Required sections:

- What is delivered.
- What is simulator-certified.
- What still requires S9/Boxphone hardware certification.
- Quick start order:
  1. Run Gateway.
  2. Run tests.
  3. Run simulator smoke.
  4. Configure Android Agent.
  5. Configure AI.
  6. Open dashboard.
- Links to every handover document.

Mandatory honesty paragraph:

```text
Real GSM call audio capture/inject is not certified until the system is tested on the target Samsung S9/Boxphone hardware, ROM, and root/audio bridge.
```

### `docs/handover/gateway-setup.md`

Required sections:

- Prerequisites.
- Python runtime used in this repo.
- Install dependencies.
- Start Gateway.
- Run Gateway tests.
- Network ports.
- Environment variables.
- Logs and troubleshooting.

Commands that must appear:

```powershell
D:\tool_telesales\.python312\python.exe -m pytest backend\tests\gateway -v
npm.cmd run lint
```

### `docs/handover/android-agent.md`

Required sections:

- Build APK.
- Install APK.
- Configure Gateway URL.
- Configure device id/token/audio port.
- Start foreground service.
- Register device.
- Verify heartbeat.
- Command polling behavior.
- Simulator mode vs hardware bridge mode.

Commands that must appear:

```powershell
cd android_agent
flutter test
flutter analyze
flutter build apk --release
```

If Flutter SDK is unavailable on the development machine, the doc must say the commands are run in the Android build environment.

### `docs/handover/ai-integration.md`

Required sections:

- Built-in deterministic agent.
- Local text model adapter.
- STT/TTS split mode.
- Realtime voice AI mode.
- Timeout/error behavior.
- Required response schemas.
- Example simple JSON request/response.
- Example OpenAI-compatible chat request/response.

Simple JSON response example:

```json
{
  "text": "Da, em se gui bao gia.",
  "disposition": "interested",
  "tags": ["interested"],
  "next_action": "send_quote"
}
```

### `docs/handover/simulator.md`

Required sections:

- Why simulator exists.
- How to run command flow smoke.
- How to run soak.
- How to interpret summary.
- How to simulate failures.
- What simulator cannot prove.

Commands:

```powershell
.\.python312\python.exe -m backend.gateway.simulators.run_soak --devices 3 --iterations 5
.\.python312\python.exe -m backend.gateway.simulators.run_soak --devices 7 --iterations 100
```

### `docs/handover/operations.md`

Required sections:

- Daily startup checks.
- Device health checks.
- Command queue checks.
- Active call checks.
- AI status checks.
- When to stop a campaign.
- What logs to collect for support.

### `docs/handover/troubleshooting.md`

Required issue entries:

- Device does not register.
- Device offline.
- Heartbeat timeout.
- Command stuck delivered.
- Command NACK.
- No audio packets.
- Audio packet loss.
- AI timeout.
- AI schema error.
- High temperature.
- Low signal.
- Dashboard endpoint error.

Each issue entry must include:

- Symptom.
- Likely causes.
- Checks.
- Fix.
- Escalation data to collect.

### `docs/handover/acceptance-simulator.md`

Required checklist:

- Gateway tests pass.
- AI runtime tests pass.
- TypeScript lint passes.
- Command flow smoke passes.
- 7-device soak smoke passes.
- Dashboard loads.
- Device/session/command/audio panels show no crash.
- Docs reviewed.
- `git status --short --branch` clean.

### `docs/handover/acceptance-hardware.md`

Required checklist:

- APK installs on target S9.
- Foreground service survives screen off.
- Device registers after reboot.
- Dial works.
- Hangup works.
- Ringing/connected/disconnected events match real call state.
- Customer audio capture works.
- AI audio inject works.
- 5-7 calls concurrently.
- LAN latency measured.
- Packet loss measured.
- Device temperature remains below agreed threshold.
- Recovery after Gateway restart.
- Recovery after network interruption.

---

## Detailed Runner Contract

### `backend/gateway/simulators/command_flow_runner.py`

Required public function:

```python
def run_command_flow_smoke(device_count: int = 3, iterations: int = 1) -> dict:
    return {
        "devices": device_count,
        "iterations": iterations,
        "calls": 0,
        "commands_delivered": 0,
        "commands_acked": 0,
        "commands_nacked": 0,
        "failures": [],
    }
```

Return shape:

```python
{
    "devices": 3,
    "iterations": 1,
    "calls": 3,
    "commands_delivered": 3,
    "commands_acked": 3,
    "commands_nacked": 0,
    "failures": [],
}
```

Failure item shape:

```python
{
    "device_id": "S9_SIM_01",
    "call_id": "call-id",
    "stage": "ack",
    "reason": "command_not_found",
}
```

Runner behavior:

1. Create isolated `DeviceRegistry`, `CallSessionManager`, `DeviceCommandQueue`, and `CallRouter`.
2. Create N `S9Simulator` instances.
3. Register each simulator with registry.
4. For each iteration and device, enqueue one call.
5. Poll command from command queue.
6. Simulator ACKs command.
7. Simulator handles command and emits ringing event.
8. Summary increments counters.
9. Exceptions are captured as failure items, not swallowed.

### `backend/gateway/simulators/run_soak.py`

CLI:

```text
python -m backend.gateway.simulators.run_soak --devices 7 --iterations 100 --fail-rate 0
```

Arguments:

- `--devices`: integer, default 3, min 1, max 50.
- `--iterations`: integer, default 5, min 1.
- `--fail-rate`: float, default 0.0, range 0.0-1.0.

Output:

```json
{
  "devices": 7,
  "iterations": 100,
  "calls": 700,
  "commands_delivered": 700,
  "commands_acked": 700,
  "commands_nacked": 0,
  "failure_count": 0
}
```

Exit codes:

- `0`: failure count is 0.
- `1`: failure count is greater than 0.
- `2`: invalid CLI arguments.

---

## Detailed Test Matrix

### Runner tests

- 3 devices x 1 iteration returns 3 calls and 3 ACKs.
- 7 devices x 2 iterations returns 14 calls and 14 ACKs.
- Invalid device count raises or exits with error in CLI path.
- Injected failure appears in `failures`.
- CLI exits 0 for no failures.
- CLI exits 1 for simulated failures.

### Documentation checks

Manual scan before commit:

```powershell
$markers = @("T"+"BD","fix"+"me","coming"+" soon","incomplete"+"-marker")
rg -n ($markers -join "|") docs\handover
```

Expected: no matches.

Required command references:

```powershell
rg -n "pytest backend\\tests\\gateway|npm.cmd run lint|flutter build apk|run_soak" docs\handover
```

Expected: each command appears in the relevant handover document.

---

## Delivery Gate

This package is complete only when:

- `docs/handover/` contains all required documents.
- Smoke runner tests pass.
- Soak CLI can run short local smoke.
- Docs contain exact commands.
- Docs clearly separate simulator certification from hardware certification.
- Gateway tests pass.
- AI runtime tests pass.
- TypeScript lint passes.
