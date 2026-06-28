# Boxphone Gateway, Flutter Android Agent, and AI Adapter Design

## Mục tiêu

Thiết kế hệ thống Boxphone hoàn chỉnh để bên triển khai sở hữu trọn vẹn phần kết nối điện thoại Samsung S9, điều phối cuộc gọi, truyền âm thanh, ghi log, ghi âm, giám sát sức khỏe thiết bị và cung cấp sẵn một AI hội thoại mẫu.

Khách hàng chỉ cần gắn "bộ não AI" của họ vào qua một chuẩn adapter rõ ràng. AI của khách hàng có thể là mô hình chạy local trên máy/server của họ, hoặc dịch vụ AI nội bộ/cloud, miễn là tuân thủ giao thức stream audio và event do Gateway cung cấp.

## Phạm vi

Trong phạm vi:

- Flutter Android Agent cài APK trên từng Samsung S9.
- Native Android foreground service chạy bền bỉ 24/7.
- Native/root audio bridge để capture/inject audio cuộc gọi.
- Boxphone Gateway trên PC/server để quản lý thiết bị, cuộc gọi, audio session và AI adapter.
- Built-in AI Conversation Agent để demo/chạy end-to-end: STT -> LLM -> TTS -> audio trả lời.
- AI Adapter Contract để khách hàng thay built-in AI bằng AI local riêng.
- Dashboard quản trị thiết bị, cuộc gọi, health, logs và recording.
- Test POC, test multi-device, test soak và tiêu chí nghiệm thu.

Ngoài phạm vi ban đầu:

- Tối ưu mô hình AI cụ thể cho từng ngành của khách hàng.
- Xây dựng CRM hoàn chỉnh mới.
- Giải quyết sóng yếu hoặc giới hạn vật lý của nhà mạng.
- Thiết kế phần cứng tủ Boxphone, nguồn điện, quạt và chống nhiễu, ngoài việc hiển thị/giám sát các tín hiệu health mà Android Agent gửi về.

## Kiến trúc tổng thể

```text
Campaign / Lead Source
        |
        v
Business Controller
        |
        v
Boxphone Gateway
  |       |        |
  |       |        +--> Built-in AI Conversation Agent
  |       |        +--> External Local AI Adapter
  |       |
  |       +--> Recording / Logs / Health / Dashboard
  |
  +--> WSS Control Plane
  +--> UDP Audio Plane
        |
        v
Flutter Android Agent on Samsung S9
  |
  +--> Native Foreground Service
  +--> Native Telephony Bridge
  +--> Root/Native Audio Bridge
  +--> SIM / GSM call path
```

Nguyên tắc chính: Gateway là lõi ổn định, Android Agent là thiết bị chấp hành, AI là plugin có thể thay thế. Gateway không phụ thuộc vào một AI cụ thể.

## Thành phần 1: Flutter Android Agent

Android Agent được build bằng Flutter để dễ tạo APK, cài đặt và cấu hình hàng loạt trên các máy Samsung S9. Flutter chịu trách nhiệm UI, trạng thái, cấu hình và đóng gói app. Các phần cần bền bỉ, độ trễ thấp hoặc can thiệp hệ thống sẽ nằm ở native layer.

### Flutter App Layer

Chức năng:

- Màn hình nhập Gateway IP/domain, port, device token.
- Hiển thị device id, phiên bản app, trạng thái kết nối, trạng thái SIM, call state, audio state.
- Nút test register, test heartbeat, test dial, test hangup, test audio loopback.
- Viewer log cục bộ theo thời gian.
- Cấu hình auto-start, foreground mode, reconnect policy.

Flutter không trực tiếp xử lý audio stream thời gian thực trong call path chính. Flutter gọi native service qua platform channel để điều khiển và đọc trạng thái.

### Native Android Service Layer

Chức năng:

- Foreground service chạy 24/7 với persistent notification.
- Tự khởi động sau boot nếu được cấp quyền.
- WebSocket Secure client kết nối Gateway.
- UDP audio sender/receiver.
- Heartbeat định kỳ.
- Reconnect với backoff ngắn khi mất Gateway.
- Watchdog phát hiện app/service bị treo và tự phục hồi.
- Nhận command từ Gateway: `DIAL`, `HANGUP`, `HOLD`, `RESUME`, `SELECT_SIM`, `PING`, `START_AUDIO`, `STOP_AUDIO`.
- Gửi event về Gateway: `REGISTERED`, `HEARTBEAT`, `RINGING`, `CONNECTED`, `DISCONNECTED`, `BUSY`, `NO_ANSWER`, `ERROR`, `AUDIO_STARTED`, `AUDIO_STOPPED`, `HEALTH`.

### Native/Root Audio Bridge

Chức năng:

- Capture audio khách hàng từ call path của S9.
- Inject audio AI trả lời vào call path để khách nghe.
- Xuất/nhận PCM mono 16-bit, 16 kHz ở giai đoạn đầu.
- Gắn mỗi audio stream với `call_id`.
- Đẩy packet audio qua UDP theo header chuẩn của Gateway.

Do Android 9+ hạn chế can thiệp audio cuộc gọi, thiết kế giả định S9 đã root/custom ROM hoặc có module hệ thống cho phép bridge vào audio HAL/call path. Nếu root bridge chưa sẵn sàng, POC phải ưu tiên chứng minh capture/inject audio trước khi mở rộng chức năng khác.

## Thành phần 2: Boxphone Gateway

Gateway là phần sản phẩm chính mà khách hàng không cần đụng vào. Nó che toàn bộ phức tạp của S9, SIM, audio UDP, reconnect, session isolation và call routing.

### Device Registry

Lưu trạng thái mỗi thiết bị:

- `device_id`
- `ip_address`
- `app_version`
- `status`: `online`, `offline`, `idle`, `busy`, `error`
- `last_heartbeat_at`
- `sim_slots`
- `active_call_id`
- `audio_port`
- health: battery percent, temperature, signal dBm, network type, storage, charging state

Gateway chỉ cấp cuộc gọi cho thiết bị `online + idle + healthy`.

### Call Router

Chức năng:

- Nhận yêu cầu gọi từ campaign hoặc API.
- Chọn S9 rảnh theo policy: round-robin hoặc least-recently-used.
- Chọn SIM theo policy: fixed SIM, rotate SIM, carrier-aware, daily limit.
- Tạo `call_id`.
- Lock thiết bị bằng lease để tránh cấp phát trùng khi nhiều request đồng thời.
- Gửi `DIAL` tới Android Agent.
- Theo dõi state transition: queued -> dialing -> ringing -> connected -> ending -> completed/failed.
- Tự release thiết bị khi kết thúc hoặc timeout.

Nếu không có thiết bị rảnh, cuộc gọi vào queue. Queue có retry, priority, campaign id, max attempts và next-run time.

### Session Manager

Mỗi cuộc gọi có một session độc lập:

- `call_id`
- `campaign_id`
- `lead_id`
- `device_id`
- `sim_slot`
- `phone_number`
- `control_connection_id`
- `audio_session_id`
- `audio_in_port`
- `audio_out_port`
- `ai_session_id`
- start/end timestamps
- status and failure reason

Session Manager là nơi đảm bảo vấn đề thứ ba trong docs: nhiều cuộc gọi đồng thời không lẫn audio. Không có audio packet nào được route chỉ bằng port hoặc IP; packet phải map qua `call_id/session_id`.

### Audio Router

Giai đoạn đầu dùng Raw UDP PCM vì dễ debug, độ trễ thấp trong LAN và dễ nối với AI local.

Packet header đề xuất:

```text
version: uint8
direction: enum customer_to_ai | ai_to_customer
call_id: uuid/string
device_id: string
sequence_number: uint32
timestamp_ms: uint64
sample_rate: uint16
channels: uint8
payload_codec: enum pcm16
payload_length: uint16
payload: bytes
```

Audio Router chịu trách nhiệm:

- Nhận audio khách từ Android Agent.
- Kiểm tra `call_id`, `device_id`, sequence và timestamp.
- Đo packet loss, jitter, one-way latency.
- Gửi audio tới AI Adapter đúng session.
- Nhận audio từ AI Adapter.
- Gửi audio về đúng Android Agent/session.
- Ghi stream hai chiều vào recorder nếu cấu hình bật recording.

Mục tiêu POC: PCM 16 kHz, 16-bit, mono, frame 20 ms. WebRTC có thể bổ sung ở phase sau nếu cần AEC/jitter buffer/Opus tốt hơn.

### Recording and Audit

Mỗi cuộc gọi có:

- metadata JSON
- call event timeline
- control command log
- audio recording hai chiều, ưu tiên WAV trong POC
- packet loss/jitter/latency summary
- AI transcript nếu built-in AI hoặc AI ngoài trả transcript
- final disposition: interested, busy, rejected, no-answer, error, transferred

Recording lưu local trước. Cơ chế upload server tập trung là phase sau.

## Thành phần 3: Built-in AI Conversation Agent

Built-in AI Agent giúp hệ thống tự gọi và tự trò chuyện được ngay, không phải chờ khách hàng tích hợp AI riêng.

### Vai trò

- Nhận event `session.started`.
- Nhận audio khách nói từ Gateway.
- Chạy VAD/STT để lấy text.
- Chạy LLM/dialog policy để quyết định phản hồi.
- Chạy TTS để tạo audio.
- Stream audio trả về Gateway.
- Gửi command nếu cần: `hangup`, `transfer`, `tag`, `note`, `schedule_callback`.

### Thiết kế mặc định

Giai đoạn đầu built-in AI Agent có thể chạy local với các module thay thế được:

- STT: Faster-Whisper hoặc engine local tương đương.
- LLM: model local nhỏ hoặc API tương thích OpenAI nếu khách cấu hình.
- TTS: engine local hoặc file ghi âm sẵn theo intent trong giai đoạn POC.

Không khóa hệ thống vào Gemma, Whisper hay TTS cụ thể. Built-in AI chỉ là implementation mặc định của cùng AI Adapter Contract.

### Dialog Flow

Dialog flow tối thiểu:

1. Chào khách.
2. Nghe phản hồi.
3. Phân loại intent.
4. Trả lời theo kịch bản.
5. Nếu khách quan tâm, gắn tag và chuyển lead.
6. Nếu khách từ chối, kết thúc lịch sự.
7. Nếu khách yêu cầu gặp người thật, gửi `transfer`.
8. Nếu voicemail/no-answer, gửi disposition tương ứng.

## Thành phần 4: External Local AI Adapter Contract

Khách hàng có thể thay built-in AI bằng AI local riêng. Gateway cung cấp một contract ổn định, không để khách chạm vào thiết bị, SIM hoặc UDP Android.

### Control Events Gateway -> AI

```json
{
  "type": "session.started",
  "call_id": "uuid",
  "campaign_id": "uuid",
  "lead": {
    "name": "Nguyen Van A",
    "phone": "0987654321",
    "metadata": {}
  },
  "audio": {
    "sample_rate": 16000,
    "channels": 1,
    "codec": "pcm16",
    "frame_ms": 20
  }
}
```

```json
{
  "type": "session.ended",
  "call_id": "uuid",
  "reason": "customer_hangup",
  "duration_ms": 68000,
  "recording_path": "recordings/call.wav"
}
```

### Audio Frames Gateway -> AI

Audio có thể đi qua WebSocket binary frame hoặc gRPC streaming ở phase sau. POC ưu tiên WebSocket để dễ tích hợp.

Metadata frame đi kèm:

```json
{
  "type": "audio.input",
  "call_id": "uuid",
  "sequence_number": 124,
  "timestamp_ms": 1710000000000,
  "codec": "pcm16"
}
```

### AI -> Gateway

```json
{
  "type": "audio.output",
  "call_id": "uuid",
  "sequence_number": 88,
  "timestamp_ms": 1710000000500,
  "codec": "pcm16"
}
```

```json
{
  "type": "command",
  "call_id": "uuid",
  "command": "hangup",
  "reason": "conversation_complete"
}
```

```json
{
  "type": "result",
  "call_id": "uuid",
  "disposition": "interested",
  "summary": "Khach quan tam va muon nhan bao gia.",
  "tags": ["interested", "send_quote"],
  "next_action": "send_zalo"
}
```

### Yêu cầu tương thích AI local

AI local của khách hàng chỉ cần:

- Mở server adapter trong cùng LAN hoặc cùng máy Gateway.
- Nhận event/session/audio theo contract.
- Trả audio PCM đúng sample rate hoặc báo codec không hỗ trợ.
- Trả command/result đúng schema.
- Không cần biết thiết bị S9 nào đang gọi.

## Bảo mật

Control plane:

- Dùng WSS hoặc WebSocket LAN kèm token trong POC, nâng lên TLS trong production.
- Android Agent có device token riêng.
- Gateway từ chối device chưa pair.
- Command phải có `command_id`; Agent phải trả ACK/NACK.

Audio plane:

- Mỗi call có ephemeral session key.
- POC có thể chạy LAN tin cậy, nhưng header vẫn có `call_id`, sequence và timestamp để chống lẫn session.
- Production mã hóa payload audio bằng AES-GCM hoặc chuyển sang SRTP/WebRTC.

AI adapter:

- External AI phải đăng ký adapter token.
- Gateway giới hạn adapter chỉ truy cập session audio/result, không truy cập device control trực tiếp.

## Trạng thái và lỗi

Call state chuẩn:

```text
queued
allocating_device
dialing
ringing
connected
ai_listening
ai_thinking
ai_speaking
ending
completed
failed
```

Device state chuẩn:

```text
offline
online
idle
busy
degraded
error
maintenance
```

Lỗi cần xử lý:

- Device mất heartbeat.
- WebSocket disconnect.
- UDP audio timeout.
- DIAL không ACK.
- Khách không bắt máy.
- SIM busy/no network/no credit.
- Audio bridge không sẵn sàng.
- AI adapter không phản hồi.
- TTS không trả audio.
- Recording write failure.

Gateway phải degrade graceful: không treo chiến dịch, release device đúng cách, ghi failure reason và đưa lead vào retry nếu policy cho phép.

## Dashboard quản trị

Màn hình cần có:

- Danh sách S9: online/offline, idle/busy, nhiệt, pin, sóng, SIM.
- Danh sách call sessions realtime.
- Queue chiến dịch và số thiết bị đang rảnh.
- Cảnh báo: nhiệt độ > 45°C, mất kết nối > 10s, packet loss cao, AI adapter timeout.
- Chi tiết cuộc gọi: timeline, recording, transcript, disposition.
- Cấu hình Gateway IP, token, audio ports, AI adapter endpoint, retry policy, SIM policy.

## Tiêu chí nghiệm thu

POC một S9:

- APK Flutter cài được lên S9.
- Agent register được với Gateway.
- Heartbeat ổn định trong 2 giờ.
- Gateway gửi `DIAL` và nhận được state event.
- Audio loopback hoặc call audio bridge chứng minh được capture/inject.
- Built-in AI trả được audio phản hồi qua Gateway.

Pilot nhiều S9:

- 5 đến 7 S9 online cùng lúc.
- 5 đến 7 cuộc gọi đồng thời không lẫn audio/session.
- Không cấp phát trùng thiết bị.
- Packet loss LAN đo được và cảnh báo nếu vượt 0.1%.
- Reconnect control trong tối đa 1.5 giây với lỗi mạng ngắn.
- Audio round-trip LAN mục tiêu dưới 50 ms khi đo loopback nội bộ.
- Gateway chạy soak 24 giờ không treo.

Production readiness:

- Device token và adapter token hoạt động.
- Recording và audit log đầy đủ.
- Health dashboard hiển thị đúng pin/nhiệt/sóng.
- Có tài liệu cài APK, pair device, cấu hình Gateway, cấu hình AI adapter.
- Có bộ simulator S9 và simulator AI để test khi chưa có thiết bị thật.

## Kế hoạch triển khai đề xuất

### Phase 1: Gateway skeleton và simulator

- Tách Gateway service khỏi logic AI demo hiện tại.
- Xây Device Registry, Call Router, Session Manager.
- Viết S9 simulator và AI simulator.
- Chuẩn hóa event schema và audio packet header.

### Phase 2: Flutter Android Agent POC

- Tạo Flutter app shell.
- Native foreground service.
- WebSocket register/heartbeat/ACK.
- UDP audio loopback.
- Test cài APK trên một S9.

### Phase 3: Root/native audio bridge POC

- Chứng minh capture audio call path.
- Chứng minh inject audio vào call path.
- Đo latency và packet loss trong LAN.
- Tạo fallback mode nếu audio bridge chưa ready.

### Phase 4: Built-in AI Conversation Agent

- Kết nối Gateway audio vào AI Agent mặc định.
- Triển khai dialog flow tối thiểu.
- Gửi result/tag/summary về Gateway.

### Phase 5: External Local AI Adapter

- Mở WebSocket/gRPC adapter endpoint.
- Tài liệu schema.
- Viết sample adapter để khách chạy AI local.
- Test thay built-in AI bằng adapter ngoài.

### Phase 6: Hardening

- Token pairing, ACK/NACK, retry, reconnect.
- Queue chiến dịch và SIM policy.
- Recording/log/dashboard.
- Soak test 24 giờ và test 7 S9 đồng thời.

## Ảnh hưởng đến code hiện tại

Code hiện tại có thể giữ làm nền POC, nhưng cần tách lại:

- `backend/main.py` không nên vừa là AI demo vừa là Gateway.
- `ws_server.py` trở thành Control Plane service hoặc được thay bằng module gateway mới.
- `call_router.py` cần thêm queue, lock, lease và session lifecycle.
- `S9AudioSession` cần chuyển từ port tĩnh sang session-aware audio routing.
- Frontend System Settings cần đổi từ SIP/GSM config chung sang Boxphone Device Dashboard.
- Built-in AI hiện tại nên được bọc sau AI Adapter Contract.

## Quyết định thiết kế đã chốt

- Bên triển khai làm cả Android Agent.
- Android Agent dùng Flutter cho app/APK, native layer cho service/telephony/audio.
- Gateway-first, không khóa vào một AI cụ thể.
- Có built-in AI để tự trò chuyện end-to-end.
- Khách hàng có thể thay built-in AI bằng model local riêng qua adapter.
- Giai đoạn đầu dùng Raw UDP PCM có header riêng; WebRTC là lựa chọn mở rộng.
