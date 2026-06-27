from __future__ import annotations

import argparse
import json
from math import ceil

from backend.gateway.simulators.command_flow_runner import run_command_flow_smoke


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Boxphone Gateway simulator soak")
    parser.add_argument("--devices", type=int, default=3)
    parser.add_argument("--iterations", type=int)
    parser.add_argument("--calls", type=int)
    parser.add_argument("--duration-seconds", type=int, default=0)
    parser.add_argument("--fail-rate", "--max-failure-rate", dest="fail_rate", type=float, default=0.0)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return int(exc.code or 2)

    if args.devices < 1 or args.devices > 50:
        return 2
    if args.fail_rate < 0 or args.fail_rate > 1:
        return 2
    if args.calls is not None and args.calls < 1:
        return 2
    if args.duration_seconds < 0:
        return 2

    iterations = _resolve_iterations(
        devices=args.devices,
        iterations=args.iterations,
        calls=args.calls,
    )
    if iterations < 1:
        return 2

    try:
        summary = run_command_flow_smoke(
            device_count=args.devices,
            iterations=iterations,
        )
    except ValueError:
        return 2

    failure_count = len(summary["failures"])
    total_calls = max(summary["calls"], 1)
    failure_rate = failure_count / total_calls
    output = {
        **summary,
        "failure_count": failure_count,
        "failure_rate": failure_rate,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if failure_rate <= args.fail_rate else 1


def _resolve_iterations(
    devices: int,
    iterations: int | None,
    calls: int | None,
) -> int:
    if iterations is not None:
        return iterations
    if calls is not None:
        return max(1, ceil(calls / devices))
    return 5


if __name__ == "__main__":
    raise SystemExit(main())

