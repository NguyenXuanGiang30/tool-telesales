# Hardware Acceptance Checklist

Checklist này chỉ chạy khi có Samsung S9/Boxphone thật và môi trường mạng của khách hàng.

## Thiết bị và APK

- [ ] APK installs on target S9/Boxphone.
- [ ] Android Agent mở được sau khi cài.
- [ ] Foreground service starts.
- [ ] Foreground service survives screen off.
- [ ] Device registers with Gateway after app Start.
- [ ] Device registers again after reboot.
- [ ] Heartbeat remains fresh for agreed duration.

## Telephony

- [ ] DIAL command starts a real outbound call.
- [ ] HANGUP command ends a real call.
- [ ] Ringing event matches real call state.
- [ ] Connected event matches real call state.
- [ ] Disconnected event matches real call state.
- [ ] Failed call has failure reason.

## Audio

- [ ] START_AUDIO captures customer audio.
- [ ] STOP_AUDIO stops capture cleanly.
- [ ] AI response audio can be injected back to the call path.
- [ ] Audio packet loss is measured.
- [ ] LAN latency is measured.
- [ ] End-of-speech detection target is 600-900 ms.
- [ ] AI first response target is under 1500 ms after customer stops speaking.

## Stability

- [ ] Five to seven consecutive real calls complete without app crash.
- [ ] Five to seven concurrent or near-concurrent device sessions do not mix audio/session.
- [ ] Device temperature remains below agreed threshold.
- [ ] No thermal shutdown during acceptance run.
- [ ] Recovery after Gateway restart.
- [ ] Recovery after network interruption.
- [ ] Recovery after Android Agent restart.

## Evidence cần lưu

- Dashboard screenshots.
- Gateway logs.
- Android Agent logs.
- AI provider logs.
- Call ids and device ids.
- Latency and packet loss measurements.

