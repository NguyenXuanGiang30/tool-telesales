# Boxphone Gateway Handover

Tài liệu này hướng dẫn cách chạy Gateway, kết nối Flutter Android Agent, gắn AI của khách hàng, vận hành dashboard, chạy simulator và nghiệm thu phần cứng Boxphone/S9 khi có thiết bị thật.

## Phạm vi bàn giao

- Gateway command queue, ACK/NACK và simulator command flow.
- Flutter Android Agent shell và ranh giới foreground service/native bridge.
- Audio routing simulator và AI runtime bridge.
- Dashboard vận hành Boxphone.
- Deployment checklist, simulator smoke test và simulator soak test.

## Mức chứng nhận

- Level 1: Simulator-certified. Có thể hoàn thành khi chưa có S9/Boxphone thật.
- Level 2: Android Agent shell-certified. Cần build/cài APK và kiểm tra app shell trên Android.
- Level 3: Hardware-certified. Cần S9/Boxphone thật để kiểm tra telephony và audio call path.

Real GSM call audio capture/inject is not certified until the system is tested on the target Samsung S9/Boxphone hardware, ROM, and root/audio bridge.

## Thứ tự chạy nhanh

1. Cài dependencies backend.
2. Chạy Gateway.
3. Chạy backend tests.
4. Chạy simulator smoke/soak.
5. Cấu hình Android Agent.
6. Cấu hình AI adapter.
7. Mở dashboard vận hành.

## Bộ tài liệu

- [Gateway setup](gateway-setup.md)
- [Android Agent](android-agent.md)
- [AI integration](ai-integration.md)
- [Simulator](simulator.md)
- [Operations](operations.md)
- [Troubleshooting](troubleshooting.md)
- [Simulator acceptance](acceptance-simulator.md)
- [Hardware acceptance](acceptance-hardware.md)
- [Customer progress report](customer-progress-report-2026-06-24.md)

