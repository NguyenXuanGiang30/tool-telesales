# Troubleshooting

## Bảng lỗi thường gặp

| Symptom | Likely Cause | Check | Fix |
| --- | --- | --- | --- |
| Device does not register | Sai Gateway URL, sai network, app chưa Start | Gọi `GET /api/v1/gateway/devices`, kiểm tra Android Agent log | Sửa Gateway URL, mở port 8000, Start lại Agent |
| Device auth failed | Sai hoặc thiếu device token | Kiểm tra `GET /api/v1/gateway/audit/events` có `device_auth_failed` | Pair lại device hoặc nhập đúng token trong Android Agent |
| Device offline | Heartbeat dừng, app bị kill, mất mạng | Kiểm tra last heartbeat và foreground notification | Start lại Agent, kiểm tra Wi-Fi/LAN, loại thiết bị khỏi campaign |
| Heartbeat timeout | Network jitter hoặc app sleep | So sánh thời điểm heartbeat cuối với log thiết bị | Bật foreground service, kiểm tra power saving |
| Command stuck delivered | Thiết bị nhận command nhưng chưa ACK/NACK | Kiểm tra command id trong dashboard và Agent log | Retry command nếu an toàn, restart Agent nếu poll loop kẹt |
| Command timeout | Device offline hoặc command poller dừng | Kiểm tra status device và command attempt count | Mark failed, release session, đưa device ra khỏi pool |
| Command NACK | Thiết bị từ chối command | Đọc `last_error` | Sửa payload, kiểm tra permission, kiểm tra telephony bridge |
| NACK `unsupported_command` | Agent chưa hỗ trợ command | Đối chiếu command name với version Agent | Cập nhật Agent hoặc không gửi command đó |
| NACK `telephony_failed` | Dial/hangup thật thất bại | Kiểm tra SIM, sóng, permission, call log | Đổi SIM/device, kiểm tra bridge, retry theo policy |
| No audio packets | Audio bridge chưa chạy hoặc sai call id | Kiểm tra Audio Metrics panel | Start audio bridge, kiểm tra port và session mapping |
| No audio metrics | Dashboard không nhận metrics hoặc chưa có stream | Gọi `GET /api/v1/gateway/audio/metrics` | Kiểm tra Gateway, audio router, simulator/audio bridge |
| Audio packet loss | Network jitter hoặc UDP drop | Kiểm tra dropped sequences và packet gap | Dùng LAN ổn định, giảm tải, theo dõi jitter |
| AI timeout | Provider chậm hoặc model local quá tải | Kiểm tra AI last error và provider log | Tăng tài nguyên model, giảm context, bật fallback nếu được |
| AI schema error | Provider trả JSON sai contract | Log raw response của provider | Sửa adapter hoặc prompt/schema model |
| High temperature | Thiết bị nóng khi gọi liên tục | Kiểm tra temperature health metric | Dừng campaign trên device, sạc/làm mát, giảm concurrency |
| Weak signal | Sóng SIM yếu | Kiểm tra signal dBm | Đổi vị trí anten/SIM/device hoặc dùng mạng tốt hơn |
| Dashboard endpoint error | Backend chưa chạy hoặc sai API base URL | Kiểm tra browser network và Gateway URL | Start Gateway, sửa env/config frontend |

## Escalation data cần gửi đội kỹ thuật

- Device id.
- Call id.
- Command id.
- Log Gateway quanh thời điểm lỗi.
- Log Android Agent.
- Screenshot dashboard.
- AI provider log nếu lỗi AI.
- Network topology và IP của Gateway/device.
