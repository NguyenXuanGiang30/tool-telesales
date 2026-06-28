from __future__ import annotations

from typing import Any

from backend.gateway.command_queue import DeviceCommandQueue
from backend.gateway.models import CallRequest
from backend.gateway.registry import DeviceRegistry
from backend.gateway.router import CallRouter
from backend.gateway.session_manager import CallSessionManager
from backend.gateway.simulators.s9_simulator import S9Simulator


Failure = dict[str, Any]


def run_command_flow_smoke(device_count: int = 3, iterations: int = 1) -> dict:
    if device_count < 1:
        raise ValueError("device_count must be at least 1")
    if iterations < 1:
        raise ValueError("iterations must be at least 1")

    registry = DeviceRegistry()
    sessions = CallSessionManager()
    command_queue = DeviceCommandQueue()
    router = CallRouter(
        registry=registry,
        sessions=sessions,
        command_queue=command_queue,
    )
    simulators = _register_simulators(registry, device_count)

    calls = 0
    commands_delivered = 0
    commands_acked = 0
    commands_nacked = 0
    failures: list[Failure] = []

    for iteration in range(iterations):
        allocated_sessions = []

        for index in range(device_count):
            phone_number = f"+8490{iteration + 1:02d}{index + 1:06d}"
            try:
                session = router.enqueue_and_allocate(
                    CallRequest(
                        phone_number=phone_number,
                        campaign_id="simulator-smoke",
                        lead_id=f"lead-{iteration + 1}-{index + 1}",
                    )
                )
                calls += 1
                if not session.device_id:
                    failures.append(
                        _failure(
                            stage="allocate",
                            reason="call_was_not_assigned",
                            call_id=session.call_id,
                        )
                    )
                    continue
                allocated_sessions.append(session)
            except Exception as exc:
                failures.append(
                    _failure(stage="allocate", reason=str(exc), device_id=None)
                )

        for session in allocated_sessions:
            device_id = session.device_id
            simulator = simulators.get(device_id)

            if not device_id or not simulator:
                failures.append(
                    _failure(
                        stage="simulator_lookup",
                        reason="simulator_not_found",
                        call_id=session.call_id,
                        device_id=device_id,
                    )
                )
                continue

            try:
                command = command_queue.next_for_device(device_id)
                if command is None:
                    failures.append(
                        _failure(
                            stage="poll",
                            reason="command_not_found",
                            call_id=session.call_id,
                            device_id=device_id,
                        )
                    )
                    continue

                commands_delivered += 1
                command_dict = command.as_dict()
                ack_payload = simulator.ack_command(command_dict)

                if ack_payload["status"] == "acked":
                    command_queue.ack(device_id, command.command_id)
                    commands_acked += 1
                else:
                    command_queue.nack(
                        device_id,
                        command.command_id,
                        ack_payload.get("error") or "simulator_nacked_command",
                    )
                    commands_nacked += 1
                    failures.append(
                        _failure(
                            stage="ack",
                            reason=ack_payload.get("error") or "nacked",
                            call_id=session.call_id,
                            device_id=device_id,
                        )
                    )
                    continue

                event = simulator.handle_command(command_dict)
                if event.get("event") != "RINGING":
                    failures.append(
                        _failure(
                            stage="handle_command",
                            reason=f"unexpected_event:{event.get('event')}",
                            call_id=session.call_id,
                            device_id=device_id,
                        )
                    )
                    continue

                simulator.connected_event(session.call_id)
                simulator.disconnected_event(session.call_id)
            except Exception as exc:
                failures.append(
                    _failure(
                        stage="command_flow",
                        reason=str(exc),
                        call_id=session.call_id,
                        device_id=device_id,
                    )
                )

        for session in allocated_sessions:
            try:
                router.complete_call(session.call_id)
            except Exception as exc:
                failures.append(
                    _failure(
                        stage="complete",
                        reason=str(exc),
                        call_id=session.call_id,
                        device_id=session.device_id,
                    )
                )

    return {
        "devices": device_count,
        "iterations": iterations,
        "calls": calls,
        "commands_delivered": commands_delivered,
        "commands_acked": commands_acked,
        "commands_nacked": commands_nacked,
        "failures": failures,
    }


def _register_simulators(
    registry: DeviceRegistry,
    device_count: int,
) -> dict[str, S9Simulator]:
    simulators: dict[str, S9Simulator] = {}
    for index in range(device_count):
        simulator = S9Simulator(
            device_id=f"S9_SIM_{index + 1:02d}",
            ip_address=f"127.0.0.{index + 1}",
            audio_port=46000 + index,
        )
        registry.register_device(
            device_id=simulator.device_id,
            ip_address=simulator.ip_address,
            app_version=simulator.app_version,
            audio_port=simulator.audio_port,
        )
        simulators[simulator.device_id] = simulator
    return simulators


def _failure(
    stage: str,
    reason: str,
    call_id: str | None = None,
    device_id: str | None = None,
) -> Failure:
    return {
        "device_id": device_id,
        "call_id": call_id,
        "stage": stage,
        "reason": reason,
    }

