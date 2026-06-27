# Flutter Android Agent

Android Agent là app chạy trên Android/S9/Boxphone. App này đóng vai trò thiết bị chấp hành: đăng ký với Gateway, gửi heartbeat/health, nhận command, ACK/NACK và sau này nối native telephony/audio bridge.

## Trạng thái hiện tại

- Đã có project Flutter trong `android_agent/`.
- Đã có Gateway client, config store, agent controller và UI shell.
- Đã có Android project skeleton để build APK.
- Real telephony/audio methods được giữ sau native interface cho đến khi kiểm thử trên S9/Boxphone thật.

## Cấu hình trong app

Operator cần nhập:

- Gateway base URL, ví dụ `http://192.168.1.15:8000/api/v1`.
- Device id, ví dụ `S9_AGENT_01`.
- Device token nếu môi trường đã bật pairing/token.
- Audio port, ví dụ `28000`.
- Simulator mode hoặc hardware bridge mode.

## Build và test trong Android build environment

Máy hiện tại có thể chưa có Flutter SDK. Các lệnh dưới đây cần chạy trong môi trường đã cài Flutter, Android SDK và adb.

```powershell
cd android_agent
flutter test
flutter analyze
flutter build apk --release
```

## Cài APK

Sau khi build release:

```powershell
adb install -r build\app\outputs\flutter-apk\app-release.apk
```

## Kiểm tra sau khi cài

1. Mở app.
2. Nhập Gateway URL, device id, device token và audio port.
3. Bấm Start.
4. Kiểm tra dashboard thấy device online.
5. Kiểm tra heartbeat vẫn tươi sau vài chu kỳ.
6. Kiểm tra command polling bằng cách tạo call request hoặc simulator command.
7. Kiểm tra foreground service: persistent notification phải còn hiển thị sau khi Start và sau khi khóa màn hình.

## Token behavior

- Nếu Gateway chưa pair device và chưa bật `GATEWAY_REQUIRE_DEVICE_TOKEN`, token có thể để rỗng để demo nhanh.
- Nếu Gateway đã pair device hoặc đã bật `GATEWAY_REQUIRE_DEVICE_TOKEN`, app phải gửi đúng Device Token.
- Android Agent gửi token trong register body và header `X-Device-Token` cho heartbeat, health, command poll và ACK/NACK.

## Ranh giới simulator mode và hardware bridge mode

Simulator mode:

- Dùng để kiểm tra register, heartbeat, health, command poll và ACK/NACK.
- Không chứng minh được dial/hangup/audio thật.

Hardware bridge mode:

- Cần S9/Boxphone thật.
- Cần xác nhận quyền telephony và audio capture/inject.
- Có thể cần root, custom ROM, vendor SDK hoặc native bridge riêng.
