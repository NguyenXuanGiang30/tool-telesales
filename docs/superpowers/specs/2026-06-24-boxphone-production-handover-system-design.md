# Boxphone Production Handover System Design

## Muc tieu

Xay dung he thong Boxphone Telesales co the ban giao cho khach hang o muc tot nhat khi hien tai chua co Samsung S9/Boxphone that.

Muc tieu ban giao trong giai do nay la "simulator-certified production package":

- Gateway, AI runtime, command plane, audio protocol, dashboard, simulator, Android Agent contract, tai lieu cai dat va test harness hoan chinh.
- Khach hang co the gan AI local/cloud theo contract ro rang ma khong phai cham vao Boxphone, SIM, audio routing.
- Khi co Boxphone/S9 that, chi can thay simulator/native bridge bang device bridge that va chay bo nghiem thu phan cung.
- Khong claim da production-ready phan capture/inject audio cuoc goi that neu chua test tren S9/root/custom ROM that.

## Nguyen tac kien truc

Gateway la loi on dinh. Android Agent la thiet bi chap hanh. AI la plugin co the thay the.

He thong khong duoc khoa vao mot nha cung cap AI, mot firmware Boxphone, hay mot engine STT/TTS cu the. Moi thanh phan phai giao tiep qua contract on dinh:

- Device control contract: register, heartbeat, health, command, ACK/NACK, event.
- Audio contract: packet PCM16 mono 16 kHz gan voi `call_id`, `device_id`, sequence va timestamp.
- AI contract: start/end session, transcript/audio input, assistant response, final result.
- Dashboard/admin contract: doc trang thai, logs, command history, session history va config.

## Pham vi ban giao

### Trong repo nay phai hoan chinh

1. Gateway Production Core
   - Device pairing/token.
   - Register, heartbeat, health.
   - Command queue cho `DIAL`, `HANGUP`, `START_AUDIO`, `STOP_AUDIO`, `PING`.
   - Command status: `queued`, `delivered`, `acked`, `nacked`, `expired`, `failed`.
   - ACK/NACK, retry, timeout va audit log.
   - Session isolation theo `call_id`.
   - API de dashboard va Android Agent su dung.

2. Boxphone/S9 Simulator
   - Gia lap 5 den 7 thiet bi S9.
   - Register, heartbeat, health.
   - Poll/nhan command, gui ACK/NACK va state event.
   - Gia lap ringing, connected, disconnected, no_answer, busy, error.
   - Audio/text-frame loopback de test AI truoc khi co thiet bi.
   - Soak/load test de chung minh Gateway khong treo va khong lan session.

3. Flutter Android Agent
   - App shell trong `android_agent/`.
   - Man hinh cau hinh Gateway URL, device id, device token, audio port.
   - Local config persistence.
   - Register, heartbeat, health loop.
   - Command poller hoac WebSocket client tuy giai do.
   - ACK/NACK command.
   - Log viewer va trang thai ket noi.
   - Foreground service skeleton.
   - TelephonyBridge va AudioBridge interface.
   - Simulator bridge/fallback mode de chay khong can S9 root.

4. Audio Plane
   - Mo rong `AudioPacket` thanh router/session-aware audio path.
   - Audio input tu Android/simulator vao dung AI session.
   - Audio output tu AI ve dung device/call.
   - Loopback/test mode.
   - Packet metrics: sequence gap, packet loss, jitter-ish timing, bytes in/out.
   - Interface cho root/native audio bridge that.

5. AI Plug-in Layer
   - AI runtime/local model adapter hien co la nen.
   - Them docs/config sample de khach gan AI local.
   - Ho tro 3 kieu tich hop:
     - Text model: STT -> LLM/Dialog -> TTS.
     - Voice model local: audio PCM vao, audio PCM ra.
     - Built-in deterministic agent de demo/fallback.
   - Provider error/timeout khong lam treo Gateway.

6. Dashboard van hanh
   - Device list: online/offline/idle/busy/degraded.
   - Health: pin, nhiet, song, charging, storage, app version.
   - Call session list: queued, dialing, ringing, connected, completed, failed.
   - Command log va ACK/NACK history.
   - Audio state va metrics.
   - AI config/status.
   - Error/reconnect log.

7. Security va pairing
   - Device token rieng tung thiet bi.
   - Gateway tu choi device chua pair hoac sai token.
   - Token khong hardcode trong code.
   - Audit log cho command va device events.
   - LAN deployment co the chay HTTP trong POC, nhung production checklist phai yeu cau TLS/VPN hoac mang rieng.

8. Tai lieu ban giao
   - README cai Gateway.
   - Huong dan build APK.
   - Huong dan pair device.
   - Huong dan gan AI local.
   - Huong dan chay simulator 5-7 thiet bi.
   - Checklist nghiem thu simulator.
   - Checklist nghiem thu Boxphone/S9 that.
   - Troubleshooting: device offline, command timeout, audio loss, AI timeout.

### Chi certify khi co Boxphone/S9 that

Nhung muc sau chi duoc danh dau "production certified" sau khi test tren phan cung that:

- Dial/hangup qua telephony tren Samsung S9.
- Detect ringing/connected/disconnected tu call state that.
- Capture audio khach hang tu call path that.
- Inject audio AI vao call path that.
- Do latency end-to-end tu khach noi den AI tra loi.
- Soak test nhiet, pin, song, crash, reconnect tren ROM that.
- Quyen root/custom ROM/Magisk/Xposed neu can.

## Data flow muc tieu

### Device onboarding

1. Admin tao hoac cap device token.
2. Android Agent nhap Gateway URL, device id, token.
3. Agent goi register.
4. Gateway verify token va tao/refresh DeviceRecord.
5. Agent bat heartbeat/health loop.
6. Dashboard hien device online.

### Outbound call

1. Campaign/dashboard/API tao call request.
2. Gateway router chon device `online + idle + healthy`.
3. Gateway tao session voi `call_id`.
4. Gateway queue command `DIAL` cho device.
5. Android Agent nhan command, ACK/NACK.
6. Agent/native bridge dial so va gui event `dialing`, `ringing`, `connected`.
7. Khi connected, Gateway start AI session neu campaign bat AI.
8. Audio customer -> Gateway -> AI runtime.
9. AI response audio -> Gateway -> Android Agent -> call path.
10. Call end -> Gateway result, release device, update lead/campaign.

### Command lifecycle

Command gom:

- `command_id`
- `device_id`
- `call_id`
- `command`
- `payload`
- `status`
- `attempt_count`
- `created_at`
- `delivered_at`
- `acknowledged_at`
- `expires_at`
- `last_error`

Command khong duoc mat im lang. Neu Android Agent khong ACK trong timeout, Gateway mark expired/failed va release session theo policy.

### Audio lifecycle

Moi audio packet phai co:

- `call_id`
- `device_id`
- `direction`
- `sequence_number`
- `timestamp_ms`
- `sample_rate`
- `channels`
- `codec`
- `payload_length`

Gateway khong route audio chi bang IP/port. Moi packet phai map qua session dang active. Packet sai device, sai call, sai state, hoac out-of-session bi reject/log.

## Error handling

He thong phai degrade graceful:

- Device mat heartbeat: mark offline, release active call theo policy.
- Command timeout: retry neu safe, neu qua gioi han thi fail session.
- Android NACK: fail command va log reason.
- AI timeout/schema error: mark AI session failed hoac fallback built-in agent neu cau hinh cho phep.
- Audio packet loss: log metric, khong crash Gateway.
- Dashboard/API khong duoc lam hong state neu request sai schema.

## Testing strategy

### Unit tests

- Command queue status transitions.
- Token pairing validation.
- Router command enqueue.
- Audio packet encode/decode/reject invalid.
- AI runtime/provider errors.

### Integration tests

- Simulator registers 7 devices.
- Gateway allocates 7 concurrent calls without session mixing.
- Each device receives exactly its command.
- ACK/NACK updates command state.
- AI runtime receives correct session input.
- Audio/text loopback reaches correct call.

### Soak tests without hardware

- 7 simulated devices.
- 24-hour target for final handover, shorter smoke run in CI/local.
- Random heartbeat delay, command timeout, AI timeout, reconnect.
- Pass criteria: no unhandled exception, no session/audio mixing, failed sessions have reason.

### Hardware acceptance tests later

- APK installs on S9.
- Agent survives screen off/foreground service.
- Dial/hangup works.
- Call state event matches real call state.
- Audio capture/inject works.
- 5-7 concurrent calls.
- Latency and packet loss measured in LAN.

## Implementation packages

### Package 1: Gateway command plane

Deliverables:

- `backend/gateway/command_queue.py`
- API endpoints for command next/ack/nack/history.
- Router integration to enqueue `DIAL`.
- Tests for command lifecycle.

### Package 2: Simulator-certified device flow

Deliverables:

- Enhanced S9 simulator client.
- Multi-device simulator runner.
- Tests for 5-7 devices and command ACK.
- Smoke script for demo without hardware.

### Package 3: Flutter Android Agent MVP

Deliverables:

- `android_agent/` Flutter app.
- Config screen.
- Gateway client.
- Agent controller.
- Heartbeat/health loop.
- Command poller and ACK/NACK.
- Foreground service skeleton/native method channel.
- README build APK.

### Package 4: Audio routing and AI bridge

Deliverables:

- Session-aware audio router.
- Simulator audio/text-frame input.
- AI runtime bridge from audio/text events.
- Audio output path to device/simulator.
- Metrics and tests.

### Package 5: Dashboard operations

Deliverables:

- Device dashboard.
- Session/call dashboard.
- Command log.
- AI config/status.
- Health/error views.

### Package 6: Security, docs, handover

Deliverables:

- Pairing/token docs and tests.
- Deployment config examples.
- Operator guide.
- Customer AI integration guide.
- Simulator acceptance checklist.
- Hardware acceptance checklist.

## Definition of done

He thong duoc coi la san sang ban giao giai do simulator-certified khi:

- Gateway tests pass.
- AI runtime tests pass.
- Frontend lint/build pass.
- Android Agent static analysis/tests pass neu Flutter SDK co san.
- Simulator co the chay multi-device flow.
- Dashboard doc duoc device/session/command/AI state.
- Tai lieu cai dat va nghiem thu day du.
- `git status --short --branch` sach.

He thong duoc coi la hardware production-certified chi sau khi:

- Co S9/Boxphone that.
- Chay du hardware acceptance checklist.
- Do duoc latency, packet loss, stability.
- Fix cac loi phat sinh tu ROM/root/audio bridge.

## Ranh gioi va trung thuc ban giao

Ban giao cho khach hang phai noi ro:

- Phan Gateway, AI, simulator, dashboard, docs co the certify trong repo.
- Phan audio call path that phu thuoc S9/root/custom ROM va phai certify tren thiet bi.
- Kien truc da duoc thiet ke de thay simulator bang hardware bridge ma khong doi loi nghiep vu.

