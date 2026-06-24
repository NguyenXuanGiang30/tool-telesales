# Handover Docs, Deployment Checklist, and Simulator Soak Tests Design

## Goal

Create the handover package that lets a customer or implementation team install, configure, simulate, test, troubleshoot, and later certify Boxphone hardware.

This package turns the codebase into a deliverable system rather than a collection of modules.

## Scope

In scope:

- Gateway setup guide.
- Android Agent build/install guide.
- Device pairing guide.
- AI integration guide.
- Simulator runbook.
- Simulator acceptance checklist.
- Hardware acceptance checklist.
- Troubleshooting guide.
- Soak/smoke test scripts for simulator flows.

Out of scope:

- Customer-specific branding.
- Final hardware measurements without S9/Boxphone.
- Managed device deployment tooling.

## Documentation Set

Create docs under `docs/handover/`:

- `README.md`: overview and quick start.
- `gateway-setup.md`: install and run Gateway.
- `android-agent.md`: build, install, configure APK.
- `ai-integration.md`: local model, STT/TTS, voice AI options.
- `simulator.md`: run multi-device simulator.
- `operations.md`: daily checks and dashboard use.
- `troubleshooting.md`: common failures and fixes.
- `acceptance-simulator.md`: simulator-certified checklist.
- `acceptance-hardware.md`: S9/Boxphone hardware checklist.

## Soak Tests

Add scripts/tests that can run without hardware:

- register N simulated devices
- enqueue N calls
- poll and ACK commands
- send connected/disconnected events
- send text-frame audio to AI runtime
- collect pass/fail summary

Default smoke duration should be short for local development. The docs define how to run longer soak tests for customer readiness.

## Acceptance Criteria

- A new engineer can run the simulator flow from docs.
- A customer can see exactly what is certified without hardware and what requires S9.
- Soak/smoke script exits non-zero on failure.
- Docs include exact commands.
- Docs avoid claiming real call audio certification before hardware tests.

## Detailed Dependencies

Inputs:

- Gateway command plane and simulator command flow.
- AI runtime/local model adapter.
- Flutter Android Agent shell docs.
- Audio routing simulator path.
- Operations dashboard.

Outputs:

- Customer handover package.
- Internal implementation checklist.
- Simulator-certified acceptance record.
- Hardware acceptance checklist for later S9/Boxphone certification.

## Certification Levels

### Simulator-Certified

Can be completed without hardware:

- Gateway tests pass.
- AI runtime tests pass.
- Command flow smoke passes.
- Simulator soak passes.
- Dashboard loads and shows simulated state.
- Docs reviewed.

### Hardware-Certified

Requires target S9/Boxphone:

- APK installed on devices.
- Foreground service stable.
- Dial/hangup works through real telephony.
- Audio capture/inject works.
- Latency and packet loss measured.
- Multi-device soak passes.

## Handover Risk Register

- Android call audio restrictions: mitigated by root/custom ROM bridge and hardware checklist.
- Network jitter: mitigated by LAN/VLAN guidance and packet metrics.
- AI timeout/schema errors: mitigated by AI runtime error handling and docs.
- Device overheating: mitigated by health dashboard and hardware acceptance checks.
- Customer AI incompatibility: mitigated by documented adapter schemas and sample requests.

## Handover Notes

The final package must be honest: it can be production-grade software before hardware exists, but it cannot be production-certified hardware integration until tested on the exact device environment.
