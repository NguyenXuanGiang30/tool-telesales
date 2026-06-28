# Gateway Setup

Tài liệu này dùng để cài, chạy và kiểm tra Boxphone Gateway backend.

## Prerequisites

- Windows PowerShell.
- Python runtime trong repo: `D:\tool_telesales\.python312\python.exe`.
- Backend dependencies trong `backend\requirements.txt`.
- Network port mặc định: `8000`.

## Cài dependencies

Chạy từ repo root:

```powershell
.\.python312\python.exe -m pip install -r backend\requirements.txt
```

Nếu đang đứng trong thư mục `backend`, có thể chạy:

```powershell
.\.python312\python.exe -m pip install -r requirements.txt
```

## Chạy Gateway

Chạy từ repo root:

```powershell
.\.python312\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Nếu môi trường import backend cần app-dir, dùng:

```powershell
.\.python312\python.exe -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8000
```

Gateway API base URL:

```text
http://localhost:8000/api/v1
```

Gateway device API:

```text
http://localhost:8000/api/v1/gateway
```

## Kiểm tra backend

Chạy Gateway test suite:

```powershell
D:\tool_telesales\.python312\python.exe -m pytest backend\tests\gateway -v
```

Chạy AI runtime tests:

```powershell
D:\tool_telesales\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime -v
```

Chạy frontend type/lint từ repo root:

```powershell
npm.cmd run lint
```

## Các endpoint quan trọng

- `POST /api/v1/gateway/devices/{device_id}/pairing`: tạo/cập nhật token pairing cho thiết bị.
- `POST /api/v1/gateway/devices/register`: đăng ký thiết bị.
- `POST /api/v1/gateway/devices/{device_id}/heartbeat`: cập nhật heartbeat.
- `POST /api/v1/gateway/devices/{device_id}/health`: cập nhật pin, nhiệt, sóng.
- `GET /api/v1/gateway/devices/{device_id}/commands/next`: thiết bị lấy command tiếp theo.
- `POST /api/v1/gateway/devices/{device_id}/commands/{command_id}/ack`: thiết bị ACK/NACK command.
- `POST /api/v1/gateway/calls/dial`: tạo yêu cầu gọi ra.
- `GET /api/v1/gateway/audio/metrics`: đọc metrics audio.
- `GET /api/v1/gateway/audit/events`: đọc audit log của Gateway.

## Device token và pairing

Trong dev/simulator mode, device chưa pair vẫn có thể register để giữ tương thích với test và demo nhanh.

Trong production, bật yêu cầu token:

```powershell
$env:GATEWAY_REQUIRE_DEVICE_TOKEN="true"
```

Tạo token cho thiết bị:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8000/api/v1/gateway/devices/S9_AGENT_01/pairing `
  -ContentType "application/json" `
  -Body '{"token":"CHANGE_ME_DEVICE_SECRET"}'
```

Khi device đã pair, Android Agent hoặc simulator phải gửi token trong body register hoặc header:

```text
X-Device-Token: CHANGE_ME_DEVICE_SECRET
```

Token không được lưu dạng raw trong pairing store. Gateway lưu hash + salt.

## Persistent state nhẹ

Để lưu pairing và audit log ra file:

```powershell
$env:GATEWAY_STATE_DIR="D:\tool_telesales\data\gateway"
```

Gateway sẽ dùng:

- `device_pairings.json`: lưu token hash/salt cho thiết bị.
- `gateway_audit.jsonl`: lưu audit event dạng JSON Lines.

## Cấu hình production cần chốt

- Device token và pairing policy.
- Database/persistent storage cho device, command, session và audit log.
- TLS/VPN hoặc private LAN cho môi trường khách hàng.
- Log retention và backup policy.
