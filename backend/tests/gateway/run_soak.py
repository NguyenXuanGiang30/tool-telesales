import time
import random
import requests
import sys

BASE_URL = "http://localhost:8000/api/v1/gateway"

def run_soak_test(cycles=10, num_devices=3):
    print("==================================================")
    print(f"Starting Boxphone Gateway Soak Test Simulator")
    print(f"Target Gateway: {BASE_URL}")
    print(f"Configuration: {num_devices} devices, {cycles} load cycles")
    print("==================================================")

    # 1. Register Mock Devices
    devices = []
    for i in range(1, num_devices + 1):
        dev_id = f"SOAK_DEVICE_{i:02d}"
        payload = {
            "device_id": dev_id,
            "ip_address": f"192.168.1.{100 + i}",
            "app_version": "1.0.0-soak",
            "audio_port": 28000 + i
        }
        try:
            r = requests.post(f"{BASE_URL}/devices/register", json=payload)
            if r.status_code == 200:
                print(f"[REGISTER] Successfully registered {dev_id}")
                devices.append({
                    "device_id": dev_id,
                    "battery": 90,
                    "temp": 35.0,
                    "signal": -60,
                    "active_call": None
                })
            else:
                print(f"[REGISTER] Failed to register {dev_id}: {r.status_code} {r.text}")
        except Exception as e:
            print(f"[REGISTER] Error connecting to gateway: {e}")
            print("Please make sure backend server is running on localhost:8000")
            sys.exit(1)

    print("\nStarting simulation loop...\n")

    # 2. Soak Loop
    for cycle in range(1, cycles + 1):
        print(f"--- Cycle {cycle}/{cycles} ---")
        
        for dev in devices:
            dev_id = dev["device_id"]
            
            # Fluctuating metrics
            dev["battery"] = max(10, dev["battery"] - random.randint(0, 2))
            dev["temp"] = round(dev["temp"] + random.uniform(-0.5, 0.8), 1)
            dev["signal"] = min(-50, max(-100, dev["signal"] + random.randint(-5, 5)))
            
            # Simulated Call Progression
            if dev["active_call"] is None:
                # 15% chance to start a mock call session
                if random.random() < 0.15:
                    dev["active_call"] = f"call_soak_{random.randint(1000, 9999)}"
                    print(f"[{dev_id}] Call started: {dev['active_call']}")
            else:
                # 30% chance to finish a mock call session
                if random.random() < 0.3:
                    print(f"[{dev_id}] Call ended: {dev['active_call']}")
                    dev["active_call"] = None

            # A. Send Heartbeat
            status = "busy" if dev["active_call"] else "idle"
            hb_payload = {
                "status": status,
                "active_call_id": dev["active_call"],
                "health": {
                    "battery_percent": dev["battery"],
                    "temperature_c": dev["temp"],
                    "signal_dbm": dev["signal"],
                    "charging": False,
                    "network_type": "LTE",
                    "storage_free_mb": 4096
                }
            }
            
            try:
                hb_res = requests.post(f"{BASE_URL}/devices/{dev_id}/heartbeat", json=hb_payload)
                print(f"[{dev_id}] Heartbeat OK. Battery: {dev['battery']}%, Temp: {dev['temp']}°C, Status: {status}")
            except Exception as e:
                print(f"[{dev_id}] Heartbeat Error: {e}")

            # B. Poll and Acknowledge Commands
            try:
                cmd_res = requests.get(f"{BASE_URL}/devices/{dev_id}/commands/next")
                if cmd_res.status_code == 200:
                    body = cmd_res.json()
                    cmd = body.get("command")
                    if cmd:
                        cmd_id = cmd["command_id"]
                        cmd_name = cmd["command"]
                        print(f"[{dev_id}] Received command {cmd_name} (ID: {cmd_id})")
                        
                        # Ack the command
                        ack_payload = {"status": "acked"}
                        ack_res = requests.post(f"{BASE_URL}/devices/{dev_id}/commands/{cmd_id}/ack", json=ack_payload)
                        if ack_res.status_code == 200:
                            print(f"[{dev_id}] Acknowledged command {cmd_id} successfully")
            except Exception as e:
                print(f"[{dev_id}] Command Polling Error: {e}")

        # C. Query audio metrics registry to simulate dashboard poll
        try:
            m_res = requests.get(f"{BASE_URL}/audio/metrics")
            if m_res.status_code == 200:
                metrics_data = m_res.json()
                print(f"[GATEWAY] Active audio metric streams tracked: {len(metrics_data)}")
        except Exception as e:
            print(f"[GATEWAY] Metrics Fetch Error: {e}")

        print("")
        time.sleep(1)

    print("==================================================")
    print("Boxphone Gateway Soak Test Simulator Completed Successfully!")
    print("==================================================")

if __name__ == "__main__":
    run_soak_test(cycles=5, num_devices=3)
