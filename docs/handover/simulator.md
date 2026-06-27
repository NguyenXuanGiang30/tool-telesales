# Simulator Runbook

Simulator dùng để kiểm tra logic Gateway, command flow, audio/text-frame và AI bridge trước khi có S9/Boxphone thật.

## Simulator chứng minh được gì

- Device register.
- Heartbeat và health update.
- Command queue DIAL.
- Device poll command.
- ACK/NACK.
- Session không bị trộn giữa thiết bị.
- Audio/text-frame đi đúng `call_id` và `device_id`.

## Simulator không chứng minh được gì

- Dial/hangup qua modem/SIM thật.
- Ringing/connected/disconnected từ Android call state thật.
- Capture tiếng khách hàng từ call path thật.
- Inject audio AI vào cuộc gọi GSM thật.
- Nhiệt, pin, sóng và crash behavior trên S9/Boxphone thật.

## Chạy toàn bộ Gateway tests

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
```

## Chạy command flow smoke

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway\test_command_flow_runner.py -v
```

## Chạy simulator soak ngắn

```powershell
.\.python312\python.exe -m backend.gateway.simulators.run_soak --devices 3 --iterations 5
```

## Chạy simulator soak dài hơn

```powershell
.\.python312\python.exe -m backend.gateway.simulators.run_soak --devices 7 --iterations 100
```

## Chạy API soak với mock Gateway server

Mở một terminal chạy mock app:

```powershell
.\.python312\python.exe backend\tests\gateway\mock_app.py
```

Mở terminal khác chạy:

```powershell
.\.python312\python.exe backend\tests\gateway\run_soak.py --cycles 5 --devices 3
```

## Cách đọc kết quả

- Exit code `0`: simulator không phát hiện failure.
- Exit code `1`: có failure trong flow.
- Exit code `2`: tham số CLI không hợp lệ.
- `commands_acked` phải bằng số command đã giao.
- `commands_nacked` phải bằng 0 trong smoke mặc định.
- `failures` phải rỗng.

## Mô phỏng lỗi

- Tăng số device/iterations để tạo tải.
- Dùng test NACK để xác nhận Gateway ghi nhận command lỗi.
- Dừng mock server để xác nhận API soak trả non-zero.
- Gửi packet sai `call_id` để xác nhận audio router reject.

