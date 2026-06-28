# Operations Guide

Tài liệu này dành cho người vận hành dashboard Boxphone.

## Daily startup checks

1. Gateway backend đang chạy.
2. Dashboard load được trang vận hành Gateway.
3. Android Agent hoặc simulator register thành công.
4. Device heartbeat cập nhật trong vài giây gần nhất.
5. Không có command treo ở trạng thái delivered quá lâu.
6. Audit log ghi nhận device register và command ACK/NACK.

## Device health checks

Trạng thái bình thường:

- Device idle hoặc online.
- Heartbeat fresh.
- Battery đủ ngưỡng vận hành.
- Temperature không vượt ngưỡng cảnh báo.
- Signal không quá yếu.
- App version hiển thị đúng.

Khi cần dừng campaign:

- Nhiều device offline cùng lúc.
- Nhiệt độ thiết bị vượt ngưỡng an toàn.
- Signal yếu gây lỗi gọi liên tục.
- Command NACK hàng loạt.

## Command queue checks

Trạng thái bình thường:

- Command DIAL được ACK với attempt count 1.
- Không có command expired.
- NACK có reason rõ ràng nếu thiết bị từ chối.

Khi có command timeout:

- Kiểm tra thiết bị có online không.
- Kiểm tra Android Agent còn chạy foreground service không.
- Kiểm tra network giữa thiết bị và Gateway.
- Kiểm tra audit log có `device_auth_failed`, `command_delivered`, `command_acked` hoặc `command_nacked` không.

## Active call checks

Trạng thái bình thường:

- Connected hoặc completed call có `device_id`.
- Session có SIM slot.
- Failed session có failure reason.

## Audio checks

Trạng thái bình thường:

- Packet/bytes tăng khi có audio flow.
- Dropped sequences bằng 0 trong simulator smoke.
- Packet sai session bị reject, không làm crash Gateway.

## AI status checks

Trạng thái bình thường:

- Provider visible.
- Last error rỗng.
- Response gắn đúng session.
- Timeout được ghi nhận rõ, không làm treo session khác.

## Logs cần thu thập khi support

- Device id.
- Call id.
- Command id.
- Thời điểm lỗi.
- Dashboard screenshot.
- Gateway log quanh thời điểm lỗi.
- Android Agent log nếu lỗi trên thiết bị.
- AI provider response/error nếu lỗi ở AI.
- Audit events liên quan tới device/call/command.
