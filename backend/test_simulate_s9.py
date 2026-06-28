import sys
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

import asyncio
import json
import socket
import websockets
import time

WS_URL = "ws://localhost:8010"
UDP_IP = "localhost"
UDP_PORT = 50001
DEVICE_ID = "S9_01"

async def simulate_audio_sender():
    """Giả lập gửi âm thanh PCM từ điện thoại S9 lên Server qua UDP"""
    print("[Giả lập S9 Audio] Khởi động loop gửi âm thanh...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    # Tạo một khung dữ liệu PCM thô dài 320 bytes (tương đương 10ms im lặng)
    dummy_pcm = b'\x00' * 320
    
    # Mở cổng nhận phản hồi âm thanh từ server
    sock.bind(("0.0.0.0", 0))  # Cổng ngẫu nhiên
    port_allocated = sock.getsockname()[1]
    print(f"[Giả lập S9 Audio] Cổng nhận phản hồi UDP: {port_allocated}")

    # Chạy vòng lặp nhận phản hồi UDP
    def receive_udp():
        while True:
            try:
                data, addr = sock.recvfrom(1024)
                # print(f"[Giả lập S9 Audio] Nhận âm thanh từ server ({len(data)} bytes)")
            except Exception:
                break
                
    import threading
    t = threading.Thread(target=receive_udp, daemon=True)
    t.start()

    while True:
        try:
            # Gửi gói âm thanh mỗi 20ms (640 bytes)
            sock.sendto(dummy_pcm * 2, (UDP_IP, UDP_PORT))
            await asyncio.sleep(0.02)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Giả lập S9 Audio] Lỗi gửi: {e}")
            await asyncio.sleep(1)

async def simulate_control():
    """Giả lập WebSocket client nhận lệnh điều khiển trên S9"""
    print(f"[Giả lập S9 Control] Đang kết nối tới Control Server tại {WS_URL}...")
    async with websockets.connect(WS_URL) as ws:
        # 1. Đăng ký thiết bị
        reg_msg = {
            "type": "register",
            "device_id": DEVICE_ID
        }
        await ws.send(json.dumps(reg_msg))
        print(f"[Giả lập S9 Control] Đã gửi thông tin đăng ký thiết bị: {DEVICE_ID}")

        # Chạy tác vụ gửi audio song song
        audio_task = asyncio.create_task(simulate_audio_sender())

        try:
            async for message in ws:
                data = json.loads(message)
                print(f"[Giả lập S9 Control] Nhận tin nhắn từ Server: {data}")
                
                # Phản hồi trạng thái khi nhận lệnh
                command = data.get("command")
                if command == "DIAL":
                    phone = data.get("phone_number")
                    print(f"[Giả lập S9 Control] Thực hiện gọi đi tới số: {phone}")
                    # Gửi trạng thái DIALING rồi CONNECTED
                    await ws.send(json.dumps({
                        "type": "status_update",
                        "status": "dialing"
                    }))
                    await asyncio.sleep(1.5)
                    await ws.send(json.dumps({
                        "type": "status_update",
                        "status": "connected"
                    }))
                elif command == "HANGUP":
                    print("[Giả lập S9 Control] Đập máy cuộc gọi hiện tại.")
                    await ws.send(json.dumps({
                        "type": "status_update",
                        "status": "idle"
                    }))
        except Exception as e:
            print(f"[Giả lập S9 Control] Lỗi kết nối: {e}")
        finally:
            audio_task.cancel()

if __name__ == "__main__":
    try:
        asyncio.run(simulate_control())
    except KeyboardInterrupt:
        print("[Giả lập S9] Đã dừng giả lập.")
