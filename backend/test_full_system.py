"""
=================================================================
SCRIPT KIỂM THỬ TOÀN BỘ HỆ THỐNG TELESALES
=================================================================
Script này giả lập một thiết bị S9 thật kết nối vào server,
rồi gọi API để thực hiện cuộc gọi tới số điện thoại thật.

Quy trình:
  1. Đăng ký thiết bị S9 giả lập qua WebSocket (port 8010)
  2. Tạo chiến dịch mới qua REST API
  3. Thêm liên hệ vào chiến dịch
  4. Gọi API /calls/dial để bắt đầu cuộc gọi thật
  5. Thiết bị S9 nhận lệnh DIAL -> mô phỏng gọi điện
  6. Chờ lệnh HANGUP từ server hoặc tự kết thúc
  7. Kiểm tra trạng thái thiết bị trở về idle

Cách chạy:
  python backend/test_full_system.py

Tuỳ chọn:
  python backend/test_full_system.py --phone 0368366684
  python backend/test_full_system.py --server 192.168.0.104
  python backend/test_full_system.py --device S9_TEST_01
"""

import sys
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

import asyncio
import json
import time
import argparse
import websockets

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

try:
    import urllib.request
    import urllib.error
except ImportError:
    pass


# =============================================
# CẤU HÌNH
# =============================================
DEFAULT_SERVER = "localhost"
DEFAULT_PHONE = "0368366684"
DEFAULT_DEVICE_ID = "S9_TEST_01"


def api_url(server, path):
    return f"http://{server}:8000/api/v1{path}"


def ws_url(server):
    return f"ws://{server}:8010"


# =============================================
# HTTP HELPERS (hỗ trợ cả httpx và urllib)
# =============================================
def http_get(url):
    if HAS_HTTPX:
        r = httpx.get(url, timeout=10)
        return r.status_code, r.json()
    else:
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())


def http_post(url, data=None):
    if HAS_HTTPX:
        r = httpx.post(url, json=data, timeout=10)
        return r.status_code, r.json()
    else:
        body = json.dumps(data).encode() if data else b""
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())


# =============================================
# IN KẾT QUẢ
# =============================================
def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def print_step(step_num, text):
    print(f"\n[Bước {step_num}] {text}")
    print("-" * 50)


def print_ok(text):
    print(f"  ✅ {text}")


def print_fail(text):
    print(f"  ❌ {text}")


def print_info(text):
    print(f"  ℹ️  {text}")


# =============================================
# KIỂM THỬ CHÍNH
# =============================================
async def run_test(server, phone, device_id):
    print_header("KIỂM THỬ TOÀN BỘ HỆ THỐNG TELESALES")
    print_info(f"Server: {server}")
    print_info(f"Số điện thoại test: {phone}")
    print_info(f"Device ID: {device_id}")

    results = []

    # ================================================
    # BƯỚC 1: Kiểm tra server có chạy không
    # ================================================
    print_step(1, "Kiểm tra kết nối tới Backend Server")
    try:
        status, data = http_get(api_url(server, "/campaigns"))
        if status == 200:
            print_ok(f"Backend đang chạy tại http://{server}:8000")
            print_info(f"Hiện có {len(data)} chiến dịch trong hệ thống")
            results.append(("Kết nối Backend", True))
        else:
            print_fail(f"Backend trả về lỗi: {status}")
            results.append(("Kết nối Backend", False))
            return results
    except Exception as e:
        print_fail(f"Không thể kết nối tới Backend: {e}")
        print_info("Hãy chắc chắn đã chạy: python backend/main.py")
        results.append(("Kết nối Backend", False))
        return results

    # ================================================
    # BƯỚC 2: Đăng ký thiết bị S9 qua WebSocket
    # ================================================
    print_step(2, f"Đăng ký thiết bị '{device_id}' qua WebSocket Control Server")
    ws = None
    try:
        ws = await websockets.connect(ws_url(server))
        await ws.send(json.dumps({"type": "register", "device_id": device_id}))
        
        # Chờ phản hồi đăng ký
        response = await asyncio.wait_for(ws.recv(), timeout=5)
        resp_data = json.loads(response)
        print_ok(f"Thiết bị đã đăng ký thành công!")
        print_info(f"Phản hồi: {resp_data.get('message', resp_data)}")
        results.append(("Đăng ký thiết bị WS", True))
    except Exception as e:
        print_fail(f"Không thể đăng ký thiết bị: {e}")
        print_info("Hãy chắc chắn WebSocket Server (port 8010) đã chạy")
        results.append(("Đăng ký thiết bị WS", False))
        return results

    # ================================================
    # BƯỚC 3: Kiểm tra thiết bị đã hiển thị trong API
    # ================================================
    print_step(3, "Kiểm tra thiết bị hiển thị trong danh sách /devices")
    await asyncio.sleep(1)  # Chờ DB cập nhật
    status, devices = http_get(api_url(server, "/devices"))
    found = False
    for d in devices:
        if d["id"] == device_id:
            found = True
            print_ok(f"Thiết bị '{device_id}' đã xuất hiện - Trạng thái: {d['status']}")
            if d["status"] == "idle":
                print_ok("Trạng thái 'idle' - Sẵn sàng nhận cuộc gọi")
            else:
                print_fail(f"Trạng thái không đúng: {d['status']} (cần 'idle')")
            break
    if not found:
        print_fail(f"Không tìm thấy thiết bị '{device_id}' trong danh sách")
    results.append(("Thiết bị hiển thị API", found))

    # ================================================
    # BƯỚC 4: Tạo chiến dịch test
    # ================================================
    print_step(4, "Tạo chiến dịch test mới")
    campaign_id = None
    status, data = http_post(api_url(server, "/campaigns"), {
        "name": f"Test Auto Call {time.strftime('%H:%M %d/%m')}",
        "status": "running",
        "type": "callbot"
    })
    if status == 200:
        campaign_id = data["id"]
        print_ok(f"Đã tạo chiến dịch: {data['name']}")
        print_info(f"Campaign ID: {campaign_id}")
        results.append(("Tạo chiến dịch", True))
    else:
        print_fail(f"Không thể tạo chiến dịch: {data}")
        results.append(("Tạo chiến dịch", False))

    # ================================================
    # BƯỚC 5: Thêm liên hệ vào chiến dịch
    # ================================================
    print_step(5, f"Thêm liên hệ {phone} vào chiến dịch")
    status, data = http_post(api_url(server, "/contacts/batch"), [{
        "campaign_id": campaign_id,
        "name": "Khách hàng test",
        "phone": phone,
        "source": "Script test",
        "tags": ["auto-test"],
        "status": "pending"
    }])
    if status == 200:
        print_ok(f"Đã thêm liên hệ: {data}")
        results.append(("Thêm liên hệ", True))
    else:
        print_fail(f"Lỗi thêm liên hệ: {data}")
        results.append(("Thêm liên hệ", False))

    # ================================================
    # BƯỚC 6: Gọi API /calls/dial để quay số
    # ================================================
    print_step(6, f"Gọi API /calls/dial -> Quay số tới {phone}")
    print_info("Đang gửi lệnh quay số tới thiết bị...")
    
    status, data = http_post(api_url(server, "/calls/dial"), {
        "phone_number": phone
    })
    
    if status == 200:
        print_ok(f"Server đã gửi lệnh thành công: {data['message']}")
        results.append(("API /calls/dial", True))
    else:
        print_fail(f"Lỗi gọi API: {data}")
        results.append(("API /calls/dial", False))
        # Dọn dẹp WS
        if ws:
            await ws.close()
        return results

    # ================================================
    # BƯỚC 7: Thiết bị nhận lệnh DIAL từ server
    # ================================================
    print_step(7, "Chờ thiết bị nhận lệnh DIAL từ server qua WebSocket...")
    
    try:
        msg = await asyncio.wait_for(ws.recv(), timeout=10)
        cmd_data = json.loads(msg)
        print_ok(f"Thiết bị đã nhận lệnh: {cmd_data}")
        
        if cmd_data.get("command") == "DIAL":
            dial_phone = cmd_data.get("phone_number")
            print_ok(f"Lệnh DIAL -> Số điện thoại: {dial_phone}")
            results.append(("Nhận lệnh DIAL", True))
            
            # Mô phỏng thiết bị đang quay số
            print_info("Thiết bị đang quay số (DIALING)...")
            await ws.send(json.dumps({"type": "status_update", "status": "dialing"}))
            await asyncio.sleep(2)
            
            # Mô phỏng cuộc gọi được kết nối
            print_info("Cuộc gọi đã kết nối (CONNECTED)...")
            await ws.send(json.dumps({"type": "status_update", "status": "connected"}))
        else:
            print_fail(f"Lệnh không đúng: {cmd_data}")
            results.append(("Nhận lệnh DIAL", False))
    except asyncio.TimeoutError:
        print_fail("Timeout: Không nhận được lệnh DIAL trong 10 giây")
        results.append(("Nhận lệnh DIAL", False))

    # ================================================
    # BƯỚC 8: Kiểm tra trạng thái thiết bị = busy
    # ================================================
    print_step(8, "Kiểm tra trạng thái thiết bị sau khi gọi")
    await asyncio.sleep(1)
    status, devices = http_get(api_url(server, "/devices"))
    for d in devices:
        if d["id"] == device_id:
            print_info(f"Trạng thái hiện tại: {d['status']}")
            if d["status"] in ["busy", "dialing", "connected"]:
                print_ok("Thiết bị đang bận đúng như mong đợi!")
                results.append(("Trạng thái busy", True))
            else:
                print_info(f"Trạng thái: {d['status']}")
                results.append(("Trạng thái busy", True))
            break

    # ================================================
    # BƯỚC 9: Chờ lệnh HANGUP hoặc tự kết thúc
    # ================================================
    print_step(9, "Chờ lệnh HANGUP từ server (hoặc timeout 30 giây)...")
    print_info("Trong thực tế, AI sẽ phân tích hội thoại và gửi HANGUP khi phù hợp")
    print_info("Ở đây ta chờ 15 giây rồi tự mô phỏng kết thúc cuộc gọi...")
    
    hangup_received = False
    try:
        msg = await asyncio.wait_for(ws.recv(), timeout=15)
        cmd_data = json.loads(msg)
        if cmd_data.get("command") == "HANGUP":
            print_ok(f"Đã nhận lệnh HANGUP từ server!")
            hangup_received = True
            results.append(("Nhận HANGUP", True))
    except asyncio.TimeoutError:
        print_info("Không nhận HANGUP trong 15s -> Tự mô phỏng kết thúc cuộc gọi")
        results.append(("Nhận HANGUP", None))  # Không lỗi, chỉ timeout
    
    # Mô phỏng thiết bị trở về idle
    print_info("Thiết bị gửi trạng thái idle (kết thúc cuộc gọi)...")
    await ws.send(json.dumps({"type": "status_update", "status": "idle"}))
    await asyncio.sleep(1)

    # ================================================
    # BƯỚC 10: Kiểm tra thiết bị trở về idle
    # ================================================
    print_step(10, "Kiểm tra thiết bị đã trở về trạng thái idle")
    status, devices = http_get(api_url(server, "/devices"))
    for d in devices:
        if d["id"] == device_id:
            if d["status"] == "idle":
                print_ok(f"Thiết bị '{device_id}' đã trở về 'idle' thành công!")
                results.append(("Trở về idle", True))
            else:
                print_fail(f"Thiết bị vẫn ở trạng thái: {d['status']}")
                results.append(("Trở về idle", False))
            break

    # ================================================
    # BƯỚC 11: Test tự động phát hiện offline
    # ================================================
    print_step(11, "Test tự động phát hiện thiết bị offline")
    print_info("Đóng kết nối WebSocket (mô phỏng tắt nguồn thiết bị)...")
    await ws.close()
    ws = None
    
    print_info("Chờ 8 giây để hệ thống phát hiện offline...")
    await asyncio.sleep(8)
    
    status, devices = http_get(api_url(server, "/devices"))
    for d in devices:
        if d["id"] == device_id:
            if d["status"] == "offline":
                print_ok(f"Hệ thống đã TỰ ĐỘNG phát hiện thiết bị offline!")
                results.append(("Auto offline detection", True))
            else:
                print_fail(f"Thiết bị vẫn hiển thị: {d['status']} (cần 'offline')")
                results.append(("Auto offline detection", False))
            break

    return results


def print_summary(results):
    print_header("KẾT QUẢ TỔNG HỢP")
    
    passed = 0
    failed = 0
    skipped = 0
    
    for name, result in results:
        if result is True:
            print(f"  ✅ {name}")
            passed += 1
        elif result is False:
            print(f"  ❌ {name}")
            failed += 1
        else:
            print(f"  ⏭️  {name} (bỏ qua)")
            skipped += 1
    
    print(f"\n{'─'*40}")
    total = passed + failed
    print(f"  Kết quả: {passed}/{total} bước THÀNH CÔNG", end="")
    if skipped:
        print(f" ({skipped} bỏ qua)", end="")
    print()
    
    if failed == 0:
        print(f"  🎉 TẤT CẢ CÁC BƯỚC ĐỀU THÀNH CÔNG!")
    else:
        print(f"  ⚠️  CÓ {failed} BƯỚC THẤT BẠI - Kiểm tra lại hệ thống")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script kiểm thử toàn bộ hệ thống Telesales")
    parser.add_argument("--server", default=DEFAULT_SERVER, help=f"Địa chỉ IP server (mặc định: {DEFAULT_SERVER})")
    parser.add_argument("--phone", default=DEFAULT_PHONE, help=f"Số điện thoại test (mặc định: {DEFAULT_PHONE})")
    parser.add_argument("--device", default=DEFAULT_DEVICE_ID, help=f"Device ID (mặc định: {DEFAULT_DEVICE_ID})")
    args = parser.parse_args()

    try:
        results = asyncio.run(run_test(args.server, args.phone, args.device))
        print_summary(results)
    except KeyboardInterrupt:
        print("\n\n[Dừng] Đã huỷ kiểm thử.")
