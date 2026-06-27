import argparse
import os
import random
import sys
import time

import httpx


DEFAULT_BASE_URL = os.environ.get(
    "GATEWAY_BASE_URL", "http://localhost:8000/api/v1/gateway"
)
DEFAULT_TIMEOUT_SECONDS = 5.0


def _assert_success(response: httpx.Response, context: str) -> None:
    if 200 <= response.status_code < 300:
        return
    raise RuntimeError(f"{context} failed: {response.status_code} {response.text}")


def run_soak_test(
    cycles: int = 10,
    num_devices: int = 3,
    base_url: str = DEFAULT_BASE_URL,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> int:
    rng = random.Random(20260624)

    print("==================================================")
    print("Starting Boxphone Gateway Soak Test Simulator")
    print(f"Target Gateway: {base_url}")
    print(f"Configuration: {num_devices} devices, {cycles} load cycles")
    print("==================================================")

    client = httpx.Client(base_url=base_url, timeout=timeout_seconds)
    failures = 0
    devices = []

    for i in range(1, num_devices + 1):
        dev_id = f"SOAK_DEVICE_{i:02d}"
        payload = {
            "device_id": dev_id,
            "ip_address": f"192.168.1.{100 + i}",
            "app_version": "1.0.0-soak",
            "audio_port": 28000 + i,
        }

        try:
            response = client.post("/devices/register", json=payload)
            _assert_success(response, f"register {dev_id}")
            print(f"[REGISTER] Successfully registered {dev_id}")
            devices.append(
                {
                    "device_id": dev_id,
                    "battery": 90,
                    "temp": 35.0,
                    "signal": -60,
                    "active_call": None,
                }
            )
        except Exception as exc:
            print(f"[REGISTER] Error connecting to gateway: {exc}")
            print("Please make sure backend server is running on localhost:8000")
            client.close()
            return 1

    print("\nStarting simulation loop...\n")

    for cycle in range(1, cycles + 1):
        print(f"--- Cycle {cycle}/{cycles} ---")

        for dev in devices:
            dev_id = dev["device_id"]
            dev["battery"] = max(10, dev["battery"] - rng.randint(0, 2))
            dev["temp"] = round(dev["temp"] + rng.uniform(-0.5, 0.8), 1)
            dev["signal"] = min(-50, max(-100, dev["signal"] + rng.randint(-5, 5)))

            if dev["active_call"] is None:
                if rng.random() < 0.15:
                    dev["active_call"] = f"call_soak_{rng.randint(1000, 9999)}"
                    print(f"[{dev_id}] Call started: {dev['active_call']}")
            elif rng.random() < 0.3:
                print(f"[{dev_id}] Call ended: {dev['active_call']}")
                dev["active_call"] = None

            status = "busy" if dev["active_call"] else "idle"

            try:
                hb_res = client.post(f"/devices/{dev_id}/heartbeat")
                _assert_success(hb_res, f"heartbeat {dev_id}")

                health_res = client.post(
                    f"/devices/{dev_id}/health",
                    json={
                        "battery_percent": dev["battery"],
                        "temperature_c": dev["temp"],
                        "signal_dbm": dev["signal"],
                        "charging": False,
                        "network_type": "LTE",
                        "storage_free_mb": 4096,
                    },
                )
                _assert_success(health_res, f"health update {dev_id}")
                print(
                    f"[{dev_id}] Heartbeat OK. Battery: {dev['battery']}%, "
                    f"Temp: {dev['temp']}C, Status: {status}"
                )
            except Exception as exc:
                print(f"[{dev_id}] Heartbeat Error: {exc}")
                failures += 1

            try:
                cmd_res = client.get(f"/devices/{dev_id}/commands/next")
                _assert_success(cmd_res, f"command poll {dev_id}")
                command = cmd_res.json().get("command")

                if command:
                    command_id = command["command_id"]
                    command_name = command["command"]
                    print(
                        f"[{dev_id}] Received command {command_name} "
                        f"(ID: {command_id})"
                    )

                    ack_res = client.post(
                        f"/devices/{dev_id}/commands/{command_id}/ack",
                        json={"status": "acked"},
                    )
                    _assert_success(ack_res, f"command ack {dev_id}/{command_id}")
                    print(f"[{dev_id}] Acknowledged command {command_id} successfully")
            except Exception as exc:
                print(f"[{dev_id}] Command Polling Error: {exc}")
                failures += 1

        try:
            metrics_res = client.get("/audio/metrics")
            _assert_success(metrics_res, "audio metrics fetch")
            metrics_data = metrics_res.json()
            if not isinstance(metrics_data, list):
                raise RuntimeError("audio metrics response must be a list")
            print(f"[GATEWAY] Active audio metric streams tracked: {len(metrics_data)}")
        except Exception as exc:
            print(f"[GATEWAY] Metrics Fetch Error: {exc}")
            failures += 1

        print("")
        time.sleep(1)

    client.close()
    print("==================================================")
    if failures:
        print(f"Boxphone Gateway Soak Test Simulator completed with {failures} failures")
        print("==================================================")
        return 1

    print("Boxphone Gateway Soak Test Simulator Completed Successfully!")
    print("==================================================")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Boxphone Gateway soak simulator")
    parser.add_argument("--cycles", type=int, default=5)
    parser.add_argument("--devices", type=int, default=3)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    args = parser.parse_args()
    sys.exit(
        run_soak_test(
            cycles=args.cycles,
            num_devices=args.devices,
            base_url=args.base_url,
            timeout_seconds=args.timeout,
        )
    )
