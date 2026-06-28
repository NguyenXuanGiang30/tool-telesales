# Báo cáo tiến độ tích hợp Boxphone Gateway

Ngày báo cáo: 24/06/2026

## 1. Mục đích báo cáo

Tài liệu này dùng để báo cáo cho khách hàng về những hạng mục đã được thực hiện trong giai đoạn xây dựng nền tảng Boxphone Gateway. Đây là **báo cáo tiến độ**, không phải biên bản nghiệm thu cuối cùng.

Trong giai đoạn hiện tại, đội phát triển đã tập trung làm phần lõi nghiệp vụ trước: Gateway điều phối thiết bị, Android Agent shell, simulator, dashboard vận hành, audio routing mô phỏng và AI runtime bridge. Mục tiêu là để sau này khi có máy S9/Boxphone thật, khách hàng chỉ cần kết nối thiết bị và gắn AI theo contract đã định nghĩa, không phải viết lại toàn bộ logic điều phối cuộc gọi.

## 2. Tóm tắt để khách hàng dễ hiểu

Hệ thống hiện đã có nền tảng phần mềm cho mô hình sau:

1. Gateway đóng vai trò trung tâm điều phối.
2. Mỗi Boxphone/S9 hoặc Android Agent sẽ đăng ký vào Gateway.
3. Gateway theo dõi từng thiết bị: online/offline, pin, nhiệt độ, sóng, cổng audio, trạng thái bận/rảnh.
4. Khi có yêu cầu gọi ra, Gateway chọn thiết bị phù hợp và tạo lệnh gọi.
5. Thiết bị lấy lệnh từ Gateway, thực hiện, rồi gửi ACK/NACK để báo thành công hoặc lỗi.
6. Dashboard hiển thị đội thiết bị, phiên gọi, lịch sử lệnh và chỉ số audio.
7. Lớp AI runtime được thiết kế để gắn AI của khách hàng: local model, HTTP model, STT/TTS tách riêng hoặc voice model.
8. Khi chưa có máy thật, simulator được dùng để kiểm tra logic điều phối, command flow, audio flow và AI flow.

Nói cách khác: phần "bộ não nghiệp vụ" của hệ thống đã được xây dựng. Phần còn cần thiết bị thật để xác nhận là telephony GSM và audio call path trên S9/Boxphone.

## 3. Trạng thái tổng quan theo mức độ hoàn thành

| Hạng mục | Trạng thái hiện tại | Khách hàng nên hiểu như thế nào |
| --- | --- | --- |
| Gateway Core | Đã có nền tảng | Hệ thống trung tâm đã có khả năng quản lý thiết bị và phiên gọi |
| Command queue ACK/NACK | Đã có | Gateway có thể giao việc cho thiết bị và biết thiết bị đã nhận/thực hiện hay lỗi |
| S9/Boxphone simulator | Đã có | Có thể test logic trước khi có máy S9/Boxphone thật |
| Flutter Android Agent shell | Đã có shell | Đã có app nền để cài lên Android, cần build APK và nối native bridge khi có môi trường/thiết bị |
| Audio routing simulator | Đã có | Đã có cách route audio/text theo đúng call/device, tránh trộn phiên |
| AI runtime bridge | Đã có nền | Khách có thể gắn AI local/cloud theo contract, cần test với model cụ thể của khách |
| Dashboard vận hành | Đã có panel chính | Có màn hình để theo dõi device, call, command và audio metrics |
| Tài liệu và soak test | Đã có bản đầu | Có hướng dẫn và công cụ test mô phỏng, cần tiếp tục tách thành bộ handover chi tiết |
| Hardware certification | Chưa thể xác nhận | Bắt buộc cần S9/Boxphone thật để test gọi/audio thật |

## 4. Luồng nghiệp vụ đã xây dựng được

### 4.1. Luồng kết nối thiết bị

Đã làm được:

- Thiết bị có thể register vào Gateway bằng `device_id`, IP, app version và audio port.
- Gateway lưu danh sách thiết bị đang kết nối.
- Thiết bị có thể gửi heartbeat định kỳ để Gateway biết thiết bị còn sống.
- Thiết bị có thể gửi health metrics như pin, nhiệt độ, sóng, charging, bộ nhớ trống.
- Dashboard có thể đọc dữ liệu này để hiển thị trạng thái vận hành.

Giá trị với khách hàng:

- Đội vận hành biết được máy nào đang online, máy nào có thể nhận cuộc gọi, máy nào có dấu hiệu lỗi.
- Đây là nền tảng để sau này quản lý nhiều máy S9/Boxphone cùng lúc.

### 4.2. Luồng điều phối cuộc gọi

Đã làm được:

- Gateway có model `CallSession` để quản lý từng phiên gọi.
- Khi có yêu cầu gọi ra, Gateway tạo session và tìm thiết bị phù hợp.
- Gateway enqueue command `DIAL` cho thiết bị được chọn.
- Mỗi command có `command_id`, `device_id`, payload và trạng thái.
- Thiết bị/simulator poll command từ Gateway.
- Thiết bị ACK khi nhận/chấp nhận lệnh, hoặc NACK khi không thực hiện được.

Giá trị với khách hàng:

- Logic gọi ra không nằm rải rác trên từng máy. Gateway là nơi ra quyết định và theo dõi.
- Nếu thiết bị lỗi, Gateway có cơ sở để phát hiện qua NACK/timeout thay vì mất im lặng.
- Đây là điều kiện quan trọng để chạy telesales nhiều thiết bị một cách ổn định.

### 4.3. Luồng mô phỏng S9/Boxphone

Đã làm được:

- Có simulator S9 để giả lập thiết bị khi chưa có máy thật.
- Simulator có thể register, gửi heartbeat, nhận command và ACK/NACK.
- Simulator có thể giả lập flow cuộc gọi như dialing/ringing/connected/disconnected ở mức logic.
- Có test cho command flow simulator.

Giá trị với khách hàng:

- Khách hàng có thể xem và test logic hệ thống trước khi phần cứng sẵn sàng.
- Đội phát triển có thể tiếp tục làm Gateway, dashboard và AI flow mà không bị dừng vì thiếu máy S9/Boxphone.
- Khi có máy thật, simulator sẽ là baseline để so sánh với hành vi thiết bị thật.

### 4.4. Luồng audio và AI

Đã làm được:

- Đã có audio protocol cho dữ liệu audio/text-frame trong mỗi phiên gọi.
- Audio router biết route packet theo `call_id`, `device_id`, direction và sequence.
- Có reject/log cho packet sai phiên, sai thiết bị hoặc không hợp lệ.
- Có audio metrics registry để đếm packet, bytes, lỗi và tình trạng stream.
- AI runtime layer gồm built-in agent, adapter bridge và local HTTP model adapter.
- Local model adapter có cơ chế timeout/retry/error handling.

Giá trị với khách hàng:

- Hệ thống không bị khóa vào một nhà cung cấp AI cụ thể.
- Khách hàng có thể gắn AI đang chạy local trên máy của họ, miễn là đáp ứng contract HTTP/schema.
- Built-in agent có thể dùng để demo khi chưa có model AI thật.
- Phần cần xác nhận sau là audio thật từ cuộc gọi GSM trên S9/Boxphone.

Nói rõ về "AI tự trò chuyện":

- Ở tầng runtime, hệ thống đã có nền để AI nhận input và trả response theo session.
- Để trở thành AI voice realtime trên cuộc gọi thật, cần có thêm một trong các cấu hình:
  - STT để biến tiếng khách hàng thành text.
  - LLM/dialog model để sinh câu trả lời.
  - TTS để biến câu trả lời thành audio.
  - Hoặc một voice model realtime nhận audio vào và trả audio ra.
- Khi có model cụ thể của khách hàng, chỉ cần nối vào adapter theo contract, sau đó chạy test latency và chất lượng hội thoại.

### 4.5. Luồng dashboard vận hành

Đã làm được:

- Có frontend API client/type cho Gateway.
- Có panel danh sách thiết bị.
- Có panel theo dõi session/call.
- Có panel lịch sử command và ACK/NACK.
- Có panel audio metrics.
- Các panel đã được gắn vào khu vực cấu hình hệ thống.
- Có unit test cho Device Fleet panel.

Giá trị với khách hàng:

- Khách hàng không chỉ có backend API, mà đã có màn hình để nhìn thấy tình trạng hệ thống.
- Khi demo, có thể cho thấy thiết bị đang register, heartbeat, command và metrics.
- Khi vận hành, dashboard là nơi đầu tiên để kiểm tra lỗi device offline, command failed, audio bất thường.

## 5. Chi tiết theo 5 gói đã thống nhất

### Gói 1: Gateway command queue + ACK/NACK + simulator command flow

Kết quả đã có:

- `DeviceRegistry`: quản lý thiết bị kết nối.
- `CallSessionManager`: quản lý phiên gọi.
- `DeviceCommandQueue`: quản lý hàng đợi lệnh cho từng thiết bị.
- API register/heartbeat/health.
- API lấy command tiếp theo.
- API ACK/NACK command.
- Router enqueue lệnh DIAL khi có call request.
- Test backend cho registry, router, command queue, API và simulator flow.

Điều khách hàng có thể thấy:

- Tạo thiết bị mô phỏng.
- Gateway nhận thiết bị.
- Gateway giao command.
- Simulator nhận command.
- Command được ACK/NACK và có thể quan sát qua API/dashboard.

Giới hạn hiện tại:

- Chưa có device token/pairing production đầy đủ.
- Chưa test với hardware S9/Boxphone thật.

### Gói 2: Flutter Android Agent shell + client/controller + foreground service skeleton

Kết quả đã có:

- Thư mục `android_agent/` với project Flutter.
- `gateway_client.dart` để giao tiếp với Gateway.
- `agent_controller.dart` để quản lý vòng đời kết nối.
- `config_store.dart` để lưu cấu hình local.
- UI shell để nhập Gateway URL, device id, audio port và theo dõi trạng thái.
- Android project skeleton để build APK sau khi có Flutter SDK.

Điều khách hàng có thể hiểu:

- Android Agent là ứng dụng sẽ chạy trên máy Android/S9.
- App này đóng vai trò "tay chân" của Gateway trên thiết bị.
- Gateway giao việc, Android Agent nhận việc và báo kết quả.

Giới hạn hiện tại:

- Máy hiện tại chưa có Flutter/Dart SDK nên chưa build được APK release trong môi trường này.
- Foreground service/native telephony/audio bridge cần làm tiếp và cần test trên máy thật.

### Gói 3: Audio routing simulator + AI runtime bridge

Kết quả đã có:

- Audio protocol.
- Audio router theo session.
- Audio metrics.
- AI simulator.
- Built-in agent.
- Local model adapter.
- Adapter bridge cho AI runtime.
- Test cho audio và AI runtime.

Điều khách hàng có thể hiểu:

- Gateway đã có "cổng cắm AI".
- AI của khách có thể là local model, HTTP endpoint, STT/TTS pipeline hoặc voice model.
- Gateway sẽ giữ vai trò điều phối session, còn AI chỉ cần xử lý nội dung hội thoại theo contract.

Giới hạn hiện tại:

- Audio trong simulator chưa đồng nghĩa với audio thật của cuộc gọi GSM.
- Cần S9/Boxphone thật để test capture tiếng khách và phát tiếng AI vào call path.

### Gói 4: Dashboard vận hành Boxphone

Kết quả đã có:

- Device Fleet panel.
- Session Monitor panel.
- Command History panel.
- Audio Metrics panel.
- Frontend API client/type.
- Unit test panel thiết bị.

Điều khách hàng có thể hiểu:

- Khách có màn hình để xem hệ thống đang chạy ra sao.
- Khi có nhiều máy, dashboard giúp biết máy nào lỗi, máy nào đang gọi, command nào chưa ACK.
- Đây là nền tảng cho phòng vận hành telesales.

Giới hạn hiện tại:

- Giao diện có panel chính, nhưng nếu bàn giao production cho operator sử dụng hằng ngày thì nên tiếp tục polish UI/UX, filter, search, export log và role permission.

### Gói 5: Docs bàn giao + deployment checklist + simulator soak tests

Kết quả đã có:

- User manual ban đầu.
- Mock app server cho Gateway.
- Soak script có thể chạy với Gateway API.
- Soak script đã được chỉnh để có timeout, exit code và health update đúng endpoint.
- Báo cáo tiến độ này.

Điều khách hàng có thể hiểu:

- Khách có thể xem được cách cài đặt và cách demo luồng mô phỏng.
- Đội kỹ thuật có cơ sở để chạy test trước khi đưa máy thật vào.

Giới hạn hiện tại:

- Bộ handover nên được tách thêm thành các tài liệu riêng: gateway setup, android build, AI integration, simulator guide, operations guide, troubleshooting, simulator acceptance và hardware acceptance.

## 6. Bằng chứng kiểm tra đã có

Trong môi trường hiện tại đã chạy các nhóm kiểm tra sau:

| Nhóm kiểm tra | Kết quả |
| --- | --- |
| Backend Gateway tests | 77 passed, có 2 warning không chặn test |
| Frontend lint/typecheck | Pass |
| DeviceFleetPanel unit test | Pass |
| Frontend Vitest tổng | Pass sau khi loại trừ việc quét nhầm `.worktrees` và Firestore emulator test |
| Frontend Vite build | Pass, còn warning chunk lớn/import Firebase |
| Soak test ngắn | Pass với 1 simulated device và 1 cycle |

Những mục chưa thể kiểm tra trong môi trường hiện tại:

- `flutter test`.
- `flutter analyze`.
- `flutter build apk --release`.
- Cài APK lên S9/Boxphone.
- Dial/hangup cuộc gọi GSM thật.
- Detect ringing/connected/disconnected từ call state thật.
- Capture audio khách hàng thật.
- Inject audio AI vào cuộc gọi thật.
- Đo latency end-to-end giữa lúc khách dừng nói và lúc AI bắt đầu trả lời.

## 7. Điểm cần nói rõ với khách hàng

Nên nói rõ:

- Phần Gateway, simulator, AI adapter, dashboard và logic nghiệp vụ đã có nền tảng.
- Hiện có thể demo bằng simulator.
- Hệ thống đã được thiết kế để khách hàng gắn AI local/cloud theo contract.
- Chưa nên nói là đã production-certified cho Boxphone/S9 thật vì chưa có thiết bị để test.
- Khi có thiết bị, việc tiếp theo là nối native bridge và chạy hardware acceptance checklist.

Không nên nói:

- "Đã hoàn thành toàn bộ production trên S9" vì chưa có máy thật.
- "Audio call GSM đã chạy thật" vì chưa certify trên hardware.
- "Chỉ cần cài APK là xong" vì APK release và native telephony/audio bridge vẫn cần build/test.

## 8. Rủi ro và hướng xử lý

| Rủi ro | Tác động | Hướng xử lý |
| --- | --- | --- |
| Chưa có S9/Boxphone thật | Chưa certify được telephony/audio thật | Dùng simulator để hoàn thiện logic, sau đó chạy hardware checklist khi có máy |
| Android hạn chế call audio | Có thể không capture/inject audio bằng API thường | Khảo sát root/custom ROM/vendor SDK/native bridge |
| Chưa có Flutter SDK trong môi trường hiện tại | Chưa build APK release tại máy này | Cài Flutter SDK trong build machine và chạy test/build |
| AI của khách có nhiều dạng khác nhau | Có thể khác schema/latency | Chốt adapter contract và test với endpoint/model cụ thể |
| Gateway đang in-memory cho simulator | Chưa đủ cho production dài hạn | Thêm persistent storage, audit log, token pairing |

## 9. Việc nên làm tiếp theo

Ưu tiên ngắn hạn:

- Hoàn thiện bộ handover docs thành các file riêng.
- Chạy lại verification đầy đủ sau khi docs/script ổn định.
- Cài Flutter SDK và build APK.
- Chạy Android Agent trên điện thoại Android thường để verify register/heartbeat/command polling.

Ưu tiên khi có S9/Boxphone:

- Cài APK lên thiết bị thật.
- Test foreground service khi khóa màn hình.
- Test dial/hangup thật.
- Test call state event thật.
- Test audio capture/inject.
- Đo latency AI.
- Chạy soak test với 5-7 thiết bị.

Ưu tiên production hardening:

- Device token và pairing.
- Audit log command/device event.
- Persistent database cho session/command/device.
- Retry/timeout policy rõ ràng.
- TLS/VPN/private LAN deployment checklist.
- Role permission cho dashboard nếu cần.

## 10. Kết luận có thể gửi khách hàng

Trong giai đoạn vừa qua, đội phát triển đã hoàn thành phần nền tảng quan trọng của Boxphone Gateway: Gateway điều phối thiết bị, command queue ACK/NACK, simulator S9, Android Agent shell, audio routing simulator, AI runtime bridge, dashboard vận hành và soak test cơ bản.

Điều này cho phép khách hàng nhìn thấy và kiểm tra logic chính của hệ thống trước khi có thiết bị thật: thiết bị kết nối vào Gateway, Gateway giao lệnh, thiết bị phản hồi ACK/NACK, dashboard theo dõi trạng thái và AI runtime sẵn sàng kết nối model của khách hàng.

Trạng thái hiện tại phù hợp để demo và tiếp tục tích hợp AI local/cloud. Để đạt mức production-certified trên Boxphone/S9 thật, cần có thiết bị thật để build/cài APK, test telephony, test audio capture/injection và chạy hardware acceptance checklist.
