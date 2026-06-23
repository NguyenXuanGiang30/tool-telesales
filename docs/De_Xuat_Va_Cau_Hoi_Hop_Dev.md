# ĐỀ XUẤT KỸ THUẬT & CÂU HỎI THẢO LUẬN VỚI DEV KHÁCH HÀNG
## DỰ ÁN: TÍCH HỢP TOOL TELESALES PC VỚI PHẦN CỨNG BOXPHONE (SAMSUNG S9)

Tài liệu này tổng hợp các đề xuất kỹ thuật từ đội ngũ phát triển giải pháp kết nối (Chúng tôi) và bộ câu hỏi thảo luận trực tiếp với đội ngũ phát triển phần mềm Node.js (Khách hàng) để tích hợp hệ thống **AI Voice Agent tự động gọi điện và giao tiếp trực tiếp với khách hàng qua phần cứng Boxphone**.

---

## PHẠM VI CHỨC NĂNG KHI TÍCH HỢP (FUNCTIONAL SCOPE - AI CALLBOT)

Trong mô hình này, **AI sẽ đóng vai trò người gọi điện (caller) và đàm thoại trực tiếp với khách hàng**. Tool Node.js trên PC đóng vai trò là Trạm điều khiển chiến dịch (Campaign Controller) và Giám sát thời gian thực (Real-time Dashboard).

### 1. Cơ chế thực hiện cuộc gọi của AI Callbot
*   **Quản lý chiến dịch gọi (Campaign Management):** Người vận hành tải danh sách số điện thoại (leads) lên Tool PC, cài đặt kịch bản AI và ấn bắt đầu chiến dịch.
*   **Tự động quay số & Chọn SIM (Auto Dialing & SIM Selection):** Tool PC tự động gửi lệnh qua WebSocket tới Boxphone để quay số; hỗ trợ chọn SIM 1/SIM 2 hoặc tự động đảo SIM (Auto-rotate SIM) để tối ưu chi phí cước viễn thông.
*   **Kết nối đàm thoại AI (AI Media Connection):** Ngay khi cuộc gọi được kết nối (`CONNECTED`), luồng âm thanh 2 chiều của cuộc gọi di động trên Samsung S9 sẽ được định tuyến trực tiếp đến **AI Voice Bot Engine** (STT -> LLM -> TTS) để bắt đầu giao tiếp bằng giọng nói với khách hàng.
*   **Tự động gác máy (Auto Hang-up):** AI tự động gác máy qua lệnh gửi từ Tool PC tới Boxphone khi kết thúc hội thoại hoặc khi phát hiện khách hàng dập máy, cuộc gọi bị lỗi (máy bận, thuê bao không liên lạc được).

### 2. Chức năng giám sát & Lưu trữ (Monitoring & Analytics)
*   **Giám sát hội thoại trực tiếp (Live Transcripts):** Tool PC hiển thị thời gian thực nội dung khách hàng nói (Text dịch từ STT) và câu trả lời của AI (Text đưa vào TTS) trên màn hình giám sát chiến dịch.
*   **Tự động ghi âm cuộc gọi (Call Recording):** Tự động ghi âm cuộc gọi hai chiều để phục vụ việc kiểm thử, tối ưu kịch bản AI.
*   **Báo cáo & Tóm tắt bằng AI (Post-call Summary):** Sau cuộc gọi, LLM tự động tóm tắt nội dung cuộc đàm thoại, phân loại mức độ quan tâm của khách hàng (Interested/Busy/Refused) và tự động đồng bộ kết quả vào CRM.
*   **Giám sát sức khỏe thiết bị Boxphone (Device Health Monitoring):**
    *   Giám sát trạng thái kết nối mạng (Online/Offline/Latency) của từng điện thoại S9.
    *   Cảnh báo an toàn nhiệt độ pin (>45°C) để phòng chống phồng pin/cháy nổ do sạc 24/7.
    *   Theo dõi cường độ sóng di động (dBm) của từng SIM trong Boxphone.

---

## I. CÁC ĐỀ XUẤT KỸ THUẬT CHÍNH (TECHNICAL PROPOSALS)

### 1. Giao thức điều khiển (Control Plane)
*   **Đề xuất:** Sử dụng giao thức **WebSocket** chạy trong mạng nội bộ (LAN). Node.js hỗ trợ rất tốt giao thức này qua các thư viện như `ws` hoặc `socket.io`.
*   **Mô hình hoạt động:**
    *   Điện thoại Samsung S9 (Agent App) chạy WebSocket Client kết nối đến WebSocket Server được khởi tạo bởi Tool Node.js trên PC (hoặc ngược lại).
*   **Tập lệnh điều khiển đề xuất:**
    *   `DIAL(phone_number, sim_slot)`: Ra lệnh gọi đi bằng số điện thoại và SIM được chỉ định (SIM 1 hoặc SIM 2).
    *   `HANGUP()`: Ngắt cuộc gọi hiện tại.
    *   `HOLD()` / `RESUME()`: Tạm giữ cuộc gọi (ngắt âm thanh tạm thời nhưng giữ kết nối viễn thông) / Tiếp tục đàm thoại.
*   **Các sự kiện trạng thái phản hồi về PC:**
    *   `RINGING`: Đang đổ chuông.
    *   `CONNECTED`: Cuộc gọi được kết nối (khách hàng bắt máy, bắt đầu tính giờ gọi).
    *   `DISCONNECTED`: Cuộc gọi kết thúc (kèm lý do ngắt và thời lượng đàm thoại).
    *   `INCOMING_CALL`: Nhận cuộc gọi đến (hiển thị số gọi đến và SIM nhận).
    *   `ERROR(code)`: Trả về các mã lỗi cụ thể (thuê bao bận, mất sóng, hết tài khoản, lỗi phần cứng...).

### 2. Giải pháp truyền dẫn âm thanh thời gian thực (Data Plane)
*   **Định hướng kết nối với AI Engine:**
    *   **Phương án A (Khuyên dùng): WebRTC (UDP) Offline** chạy nội bộ LAN. Mỗi thiết bị Samsung S9 sẽ thiết lập một kết nối WebRTC trực tiếp tới AI Voice Bot Server. Ưu điểm là sử dụng chuẩn nén codec Opus cực tốt, tự động triệt tiêu tiếng vọng (AEC), tự động khử nhiễu và bù mất gói tin (jitter buffer) để AI nghe rõ nhất giọng khách hàng.
    *   **Phương án B: Raw UDP Socket qua Node.js Gateway**. Các thiết bị S9 sẽ truyền nhận luồng âm thanh PCM thô (16-bit, 16kHz, mono) về App Node.js qua module `dgram`. App Node.js sẽ đóng vai trò Proxy/Gateway, nhận các gói tin âm thanh này rồi chuyển tiếp (forward) lên AI Voice Engine (qua gRPC, WebSockets hoặc REST streaming).
*   **Đầu vào/Đầu ra âm thanh của AI Voice Engine:**
    *   **Đầu vào AI (Speech-to-Text):** Nhận luồng âm thanh khách hàng nói từ Boxphone -> gửi từng block âm thanh (vài chục ms) vào mô hình STT để dịch thành văn bản.
    *   **Đầu ra AI (Text-to-Speech):** Nhận văn bản câu trả lời từ LLM -> Tổng hợp thành luồng âm thanh giọng nói (TTS) -> Cắt thành các packet nhỏ gửi ngược lại Boxphone qua WebRTC/UDP để phát vào cuộc gọi di động cho khách hàng nghe.

### 3. Vấn đề can thiệp phần cứng Android
*   **Hiện trạng hệ điều hành:** Từ Android 9 trở đi, Google chặn ứng dụng bên thứ ba can thiệp vào âm thanh cuộc gọi di động vì lý do bảo mật.
*   **Đề xuất giải pháp:** Bắt buộc phải **Root thiết bị Samsung S9**, nạp Custom ROM hoặc cài đặt các module cấp thấp (như Magisk Audio Return Channel) để Agent App có thể can thiệp và truyền nhận âm thanh trực tiếp từ chip modem di động (Audio HAL level).

### 4. Hạ tầng mạng LAN nội bộ
*   **Đề xuất kết nối:** Toàn bộ cụm Boxphone và PC chạy Tool Telesales kết nối qua cáp mạng Ethernet (hạn chế tối đa dùng Wi-Fi để tránh nhiễu và mất gói tin).
*   **Cấu hình mạng:** Thiết lập **VLAN riêng** cho hệ thống Telesales-Boxphone và kích hoạt **QoS (Quality of Service)** ưu tiên băng thông cho các gói tin âm thanh UDP.

### 5. Kế hoạch chạy thử (POC - Proof of Concept)
*   Đề xuất triển khai thử nghiệm POC quy mô nhỏ: **1 máy PC + 1 máy Samsung S9** trong **2 tuần** để kiểm nghiệm thực tế độ trễ âm thanh (< 50ms qua LAN) và tính ổn định của lệnh điều khiển trước khi tiến hành viết code tích hợp diện rộng.

---

## II. BỘ CÂU HỎI THẢO LUẬN DÀNH CHO DEV KHÁCH HÀNG (DISCUSSION QUESTIONS)

Bạn nên gửi trước hoặc đưa ra thảo luận các câu hỏi này với đội Dev của khách hàng trong cuộc họp:

### 1. Về kiến trúc tích hợp AI và Quản lý Chiến dịch trên Node.js
*   **Q-1.1:** Tool Node.js hiện tại của các bạn chạy dạng ứng dụng UI bằng **Electron** làm Dashboard giám sát, hay chạy dưới dạng dịch vụ backend/CLI trên server trung gian để quản lý tự động cuộc gọi?
*   **Q-1.2:** AI Voice Bot Engine (STT, LLM, TTS) sẽ được tích hợp và chạy trực tiếp trên cùng máy PC cài Tool Node.js (chạy local/offline) hay chạy trên một máy chủ AI Server độc lập (Cloud hoặc On-premise)?
*   **Q-1.3:** Việc cài đặt thêm các thư viện NPM liên quan đến xử lý âm thanh hoặc kết nối WebRTC (như `ws` cho socket, `wrts` hoặc native bindings) có gặp rào cản nào về cấu hình hoặc môi trường triển khai không?

### 2. Về định tuyến âm thanh tới AI Voice Engine
*   **Q-2.1:** AI Engine của các bạn hỗ trợ nhận luồng âm thanh đầu vào qua giao thức nào (WebRTC, Raw UDP Socket, hay gRPC/WebSocket Streaming)?
*   **Q-2.2:** Đội ngũ Dev của các bạn muốn điện thoại Boxphone S9 kết nối trực tiếp luồng âm thanh WebRTC với AI Server của các bạn, hay muốn đi qua App Node.js làm Proxy trung gian để quản lý/ghi âm?

### 3. Về quy định bảo mật & Root máy Android
*   **Q-3.1:** Chính sách bảo mật của quý công ty có cấm việc kết nối các thiết bị Android đã bị Root vào mạng LAN nội bộ không?
*   **Q-3.2:** Phía quý khách muốn tự thực hiện việc nạp ROM/Root thiết bị Samsung S9 theo tài liệu hướng dẫn của chúng tôi, hay muốn chúng tôi thực hiện cấu hình trọn gói?

### 4. Về lưu trữ ghi âm cuộc gọi (Call Recording)
*   **Q-4.1:** File ghi âm cuộc gọi hai chiều cần được ghi lại ở đầu nào? (Ghi trực tiếp trên PC của nhân viên từ nguồn âm thanh đã mix, hay ghi âm trên điện thoại S9 rồi upload lên máy chủ tập trung sau khi gác máy?)
*   **Q-4.2:** Các bạn có yêu cầu định dạng âm thanh (.wav, .mp3, .ogg) hoặc chuẩn mã hóa bảo mật nào cho file ghi âm không?

### 5. Về định tuyến và phân tải cuộc gọi (Load Balancing)
*   **Q-5.1:** Khi thực hiện gọi ra, Tool PC sẽ tự tính toán để chọn thiết bị S9 rảnh rồi gửi lệnh trực tiếp đến IP của máy đó, hay quý khách muốn chúng tôi xây dựng một Gateway trung gian để tự động nhận lệnh, phân phối cuộc gọi và quản lý trạng thái của cụm Boxphone?

---

## III. CÁC RỦI RO CẦN CẢNH BÁO SỚM (IMPORTANT WARNINGS)

> [!WARNING]
> **Độ trễ viễn thông (GSM Latency):**
> Độ trễ cam kết dưới 50ms chỉ áp dụng trong phân đoạn mạng LAN nội bộ (PC ↔ Boxphone). Khi cuộc gọi đi qua nhà mạng viễn thông (GSM/VoLTE), độ trễ thực tế sẽ cộng thêm từ 50ms - 150ms tùy thuộc vào chất lượng sóng tại thời điểm gọi.

> [!CAUTION]
> **Nhiệt độ và phồng pin phần cứng:**
> Việc cắm sạc liên tục và thực hiện cuộc gọi liên tục trên điện thoại S9 sẽ sinh nhiệt độ rất cao (dễ gây phồng pin, cháy nổ). Cần đảm bảo cụm Boxphone có quạt tản nhiệt hoạt động liên tục và tích hợp cảm biến ngắt sạc khi nhiệt độ pin vượt ngưỡng 45°C.

---

## IV. KHẢ NĂNG TÍCH HỢP TRÍ TUỆ NHÂN TẠO (AI INTEGRATION CAPABILITIES)

Vì kiến trúc đề xuất truyền tải tín hiệu điều khiển qua WebSocket và luồng dữ liệu âm thanh số (Audio Stream) qua WebRTC/UDP trong mạng LAN, hệ thống hoàn toàn sẵn sàng để mở rộng kết nối với các dịch vụ AI một cách dễ dàng:

### 1. AI Auto-Callbot (Robot gọi điện tự động)
*   **Cách thức kết nối:** Thay vì định tuyến âm thanh và lệnh tới PC của nhân viên, luồng WebRTC/UDP âm thanh và kết nối WebSocket điều khiển từ Boxphone sẽ được kết nối trực tiếp đến **máy chủ AI Voice Bot**.
*   **Quy trình xử lý:**
    1.  AI gửi lệnh `DIAL` qua WebSocket để gọi khách hàng.
    2.  Khi khách hàng bắt máy, Boxphone gửi luồng âm thanh khách hàng nói qua WebRTC -> AI Server.
    3.  AI Server thực hiện Speech-to-Text (STT) -> LLM (Claude/GPT) xử lý câu trả lời -> Text-to-Speech (TTS) chuyển thành giọng nói AI.
    4.  Luồng âm thanh giọng nói AI được truyền ngược lại qua WebRTC -> Boxphone -> phát cho khách hàng.

### 2. AI Real-time Assistant / Co-pilot (Trợ lý ảo hỗ trợ Telesales thời gian thực)
*   **Cách thức kết nối:** Tool Node.js trên PC nhân viên sẽ "nhân bản" (duplicate) luồng âm thanh đàm thoại hai chiều và gửi lên một proxy AI Server ở local/cloud.
*   **Quy trình xử lý:**
    1.  AI Server chuyển đổi giọng nói của cả khách hàng và nhân viên thành văn bản thời gian thực (Real-time Transcription).
    2.  AI phân tích thái độ của khách hàng (Sentiment Analysis) và nội dung cuộc gọi.
    3.  Hiển thị gợi ý kịch bản nói tiếp theo, xử lý từ chối hoặc gợi ý sản phẩm ngay trên giao diện Tool PC của nhân viên.

### 3. AI Post-call Summary (Tự động tóm tắt cuộc gọi và cập nhật CRM)
*   **Cách thức kết nối:** Sau khi cuộc gọi kết thúc (`DISCONNECTED`), Tool PC gửi file ghi âm cuộc gọi lên AI Server để phân tích.
*   **Quy trình xử lý:**
    1.  AI tự động tóm tắt nội dung cuộc gọi (Call Summary) và trích xuất thông tin quan trọng (họ tên, nhu cầu, mức độ quan tâm, lịch hẹn).
    2.  Hệ thống tự động điền các thông tin này vào CRM mà nhân viên không cần gõ tay, giảm 80% thời gian xử lý sau cuộc gọi (ACW).

---

## V. PHƯƠNG ÁN GIẢI QUYẾT 3 VẤN ĐỀ KỸ THUẬT TRỌNG TÂM

Dựa trên trao đổi kỹ thuật thực tế, dưới đây là phương án giải quyết chi tiết cho 3 bài toán lớn của dự án:

### VẤN ĐỀ 1: Làm thế nào để Boxphone kết nối được với App Local mới code (phát triển từ ứng dụng của anh Đức)?

*   **Bản chất:** Thiết lập cơ chế giao tiếp nội bộ trong mạng LAN giữa App Local Node.js/Electron chạy trên PC của nhân viên và Agent App chạy trên từng máy Samsung S9.
*   **Giải pháp chi tiết:**
    1.  **Định vị thiết bị (Device Discovery):** 
        *   Khi Boxphone (các máy S9) khởi động, Agent App sẽ gửi tín hiệu broadcast UDP hoặc tự động kết nối (REST API/WebSocket) tới địa chỉ IP của PC chạy App Local (IP này được cấu hình tĩnh hoặc nhập tay trên giao diện).
    2.  **Kênh truyền nhận lệnh (Control Channel):**
        *   Thiết lập một kết nối **WebSocket** duy trì liên tục giữa App Local và Agent App trên S9. Mỗi thiết bị S9 sẽ đăng ký với App Local bằng một định danh duy nhất (ví dụ: `Device_ID` hoặc `SIM_Number`).
    3.  **Kênh truyền âm thanh (Audio Channel):**
        *   Khi có tín hiệu cuộc gọi, App Local sử dụng thư viện WebRTC hoặc mở cổng UDP socket (sử dụng module `dgram` của Node.js) để bắt đầu nhận luồng PCM từ S9 và truyền luồng PCM từ micro PC về S9.

### VẤN ĐỀ 2: Làm thế nào để Boxphone thực hiện nhiều cuộc gọi cùng lúc?

*   **Bản chất:** Một điện thoại Samsung S9 vật lý chỉ có thể thực hiện **tối đa 1 cuộc gọi đàm thoại hoạt động** tại một thời điểm (giới hạn phần cứng mạng GSM). Để gọi nhiều cuộc gọi đồng thời, bắt buộc phải sử dụng **nhiều thiết bị S9 hoạt động song song** trong cụm Boxphone.
*   **Giải pháp chi tiết:**
    1.  **Xây dựng Gateway điều phối cuộc gọi (Call Router / Load Balancer):**
        *   Chúng ta sẽ phát triển một module điều phối (chạy ngầm trên PC hoặc trên một máy server Boxphone trung gian).
        *   Module này duy trì danh sách trạng thái kết nối của tất cả các máy S9 trong cụm (`S9 #1`, `S9 #2`, `S9 #3`...) với 3 trạng thái cơ bản: `IDLE` (rảnh), `BUSY` (đang gọi), `OFFLINE` (mất kết nối).
    2.  **Cơ chế phân tải cuộc gọi:**
        *   Khi hệ thống yêu cầu gọi ra đồng thời (ví dụ: AI cần gọi cho 5 khách hàng cùng lúc): Gateway sẽ quét danh sách thiết bị và tự động phân bổ:
            *   Cuộc gọi 1 -> Giao cho máy `S9 #1` (IP: 192.168.1.10)
            *   Cuộc gọi 2 -> Giao cho máy `S9 #2` (IP: 192.168.1.11)
            *   Cuộc gọi 3 -> Giao cho máy `S9 #3` (IP: 192.168.1.12)...
        *   Nếu tất cả các máy S9 đều `BUSY`, các cuộc gọi tiếp theo sẽ được đưa vào hàng đợi (Queue) chờ cho đến khi có thiết bị chuyển sang trạng thái `IDLE`.

### VẤN ĐỀ 3: Làm thế nào để AI nhận/phát nhiều cuộc gọi cùng lúc mà không bị đè luồng âm thanh?

*   **Bản chất:** AI Server cần tiếp nhận nhiều luồng âm thanh từ các máy S9 khác nhau gửi về và phản hồi đúng luồng âm thanh giọng nói tương ứng của cuộc gọi đó mà không bị lẫn lộn dữ liệu giữa các phiên.
*   **Giải pháp chi tiết:**
    1.  **Cô lập bằng định danh Session ID & Port độc lập (Transport Layer Isolation):**
        *   Mỗi kết nối WebRTC hoặc UDP từ một máy S9 về AI Server sẽ là một kết nối socket riêng biệt, chạy trên một cổng (Port) UDP khác nhau.
        *   Ví dụ:
            *   Luồng âm thanh từ `S9 #1` truyền về Port `50001` của AI Server.
            *   Luồng âm thanh từ `S9 #2` truyền về Port `50002` của AI Server.
    2.  **Xử lý đa luồng bất đồng bộ trên AI Server (Session-based Processing):**
        *   AI Server (Node.js/Python) khi nhận dữ liệu từ các cổng khác nhau sẽ ánh xạ (mapping) luồng âm thanh đó với một `Session ID` cuộc gọi tương ứng.
        *   Mỗi `Session ID` sẽ có một instance xử lý AI độc lập:
            *   **Luồng S9 #1 (Khách A):** Cổng 50001 -> Nhận Audio A -> Đưa vào Bộ giải mã STT của Khách A -> LLM xử lý ngữ cảnh của Khách A -> Bộ tổng hợp TTS tạo giọng nói phản hồi A -> Gửi ngược lại cổng 50001 về S9 #1.
            *   **Luồng S9 #2 (Khách B):** Cổng 50002 -> Nhận Audio B -> Đưa vào Bộ giải mã STT của Khách B -> LLM xử lý ngữ cảnh của Khách B -> Bộ tổng hợp TTS tạo giọng nói phản hồi B -> Gửi ngược lại cổng 50002 về S9 #2.
        *   Do dữ liệu âm thanh được đóng gói và quản lý theo địa chỉ Socket mạng (IP:Port) và ID phiên đàm thoại riêng biệt, AI hoàn toàn có thể xử lý hàng chục cuộc gọi đồng thời song song mà không bao giờ bị đè luồng hay lẫn tiếng của nhau.

---

## VI. TIÊU CHUẨN ĐỘ TRỄ PHẢN HỒI CỦA AI VOICE AGENT (MỤC TIÊU NGHIÊM NGẶT: <= 1.0 GIÂY)

Để đạt được trải nghiệm đàm thoại tự nhiên cao nhất, dự án đặt mục tiêu **tổng độ trễ phản hồi (End-to-End Latency) ở mức tối đa là 1.0 giây** (tính từ thời điểm khách hàng dứt lời đến lúc thiết bị Boxphone phát âm thanh phản hồi của AI).

Dưới đây là bảng phân rã kỹ thuật chi tiết để đạt được mục tiêu **<= 1.0 giây**:

| Bước xử lý | Nhiệm vụ kỹ thuật | Chỉ số mục tiêu | Giải pháp tối ưu hóa bắt buộc để đạt mốc 1s |
| :--- | :--- | :--- | :--- |
| **1. VAD (Voice Activity Detection)** | Phát hiện khách hàng đã dừng nói để AI bắt đầu trả lời. | **150ms – 200ms** | - Sử dụng mô hình VAD siêu nhẹ (như Silero VAD) chạy local trên RAM.<br>- Cấu hình ngưỡng im lặng ở mức **150ms - 200ms** (ngưỡng tối thiểu để phân biệt hơi thở/ngắt nhịp ngắn và dừng hẳn câu). |
| **2. STT (Speech-to-Text)** | Chuyển đổi giọng nói thành văn bản. | **100ms – 150ms** | - Triển khai mô hình STT **Local/On-premise** (như Faster-Whisper hoặc Whisper-large-v3-turbo tối ưu qua TensorRT-LLM/ONNX trên GPU local).<br>- Chạy cơ chế **Streaming** từng cụm 30ms-50ms âm thanh để nhận dạng tức thì, loại bỏ trễ truyền tải internet. |
| **3. LLM (Language Model)** | Tạo văn bản phản hồi dựa trên ngữ cảnh kịch bản. | **150ms – 200ms** | - Dùng các mô hình LLM cực nhanh và gọn (như Llama-3-8B-Instruct, Qwen-2.5-7B, Gemini-1.5-Flash).<br>- Sử dụng các API có tốc độ sinh Token đầu tiên (Time-To-First-Token) cực thấp (như Groq API < 100ms) hoặc chạy local vLLM/TensorRT-LLM trên GPU.<br>- Rút ngắn System Prompt và dùng cơ chế sinh từ nào đẩy đi từ đó (Streaming Tokens). |
| **4. TTS (Text-to-Speech)** | Chuyển văn bản của LLM thành âm thanh. | **100ms – 150ms** | - Sử dụng công nghệ **Streaming TTS** tốc độ cao chạy local (như Kokoro-82M, StyleTTS2 hoặc vITS).<br>- Ngay khi LLM sinh được 2-3 từ đầu tiên, TTS sẽ tổng hợp ngay lập tức và phát ra loa dưới dạng stream chunk (độ dài chunk ~20ms - 50ms) thay vì đợi cả câu. |
| **5. Network Latency** | Độ trễ truyền tải gói tin trong mạng LAN và mạng viễn thông. | **100ms – 150ms** | - Mạng LAN nội bộ: **< 10ms** (sử dụng cáp mạng Ethernet trực tiếp cho Boxphone, không dùng Wi-Fi).<br>- Mạng viễn thông di động GSM: **50ms – 100ms** (đây là giới hạn vật lý của nhà mạng, cần đặt Boxphone nơi có sóng di động mạnh nhất). |
| **TỔNG CỘNG (End-to-End)** | **Tổng thời gian khách dừng nói đến khi nghe thấy tiếng AI phản hồi.** | **700ms – 950ms** (Đạt mục tiêu) | **Mô hình Pipeline Streaming gối đầu:** Luồng dữ liệu chạy trực tiếp qua LAN và xử lý song song. |

---

## VII. CẤU HÌNH PHẦN CỨNG YÊU CẦU (HARDWARE REQUIREMENTS)

Cấu hình phần cứng phụ thuộc hoàn toàn vào kiến trúc triển khai AI mà khách hàng lựa chọn:

### 1. Phương án A: Chạy AI Local Offline hoàn toàn (Khuyên dùng để đạt độ trễ < 1s)
Toàn bộ mô hình STT (Faster-Whisper), LLM (Qwen-7B/Llama-3-8B), và TTS (Kokoro/StyleTTS2) được cài đặt và xử lý trực tiếp trên Máy chủ nội bộ đặt tại văn phòng (cùng mạng LAN với Boxphone).

*Quy mô tính toán dưới đây dành cho cụm Boxphone hoạt động **10 - 20 cuộc gọi đồng thời (Concurrent Calls)**:*

*   **Bộ xử lý (CPU):** Intel Core i7 / i9 (Thế hệ 12 trở lên) hoặc AMD Ryzen 7 / 9 (Tối thiểu 8 nhân / 16 luồng).
*   **Bộ nhớ trong (RAM):** Tối thiểu **32 GB** (Khuyên dùng **64 GB** DDR5) để đủ không gian nạp đồng thời các mô hình AI lên bộ nhớ.
*   **Card đồ họa (GPU - Bắt buộc phải có của NVIDIA):**
    *   **Tối thiểu:** 1x **NVIDIA RTX 3060 / 4060 (Phiên bản có 12GB VRAM)** hoặc **RTX 4070 (16GB VRAM)**.
    *   **Khuyên dùng tối ưu:** 1x **NVIDIA RTX 4090 (24GB VRAM)** hoặc card chuyên dụng **NVIDIA L4 / A10G**.
    *   *Lý do:* GPU NVIDIA với công nghệ CUDA Core chịu trách nhiệm xử lý tính toán song song luồng âm thanh đàm thoại thời gian thực. Dung lượng VRAM quyết định khả năng chạy cùng lúc nhiều mô hình AI.
*   **Năng lực tải thực tế (Số máy S9 chạy đồng thời):**
    *   Với Card **RTX 3060 / 4060 (12GB VRAM):** Hỗ trợ chạy ổn định **5 – 10 máy Samsung S9** gọi đồng thời.
    *   Với Card **RTX 4070 (16GB VRAM) hoặc NVIDIA L4 (24GB VRAM):** Hỗ trợ chạy ổn định **10 – 15 máy Samsung S9** gọi đồng thời.
    *   Với Card **RTX 4090 (24GB VRAM) hoặc NVIDIA A10G (24GB VRAM):** Hỗ trợ chạy ổn định **20 – 30 máy Samsung S9** gọi đồng thời.
    *   *Mở rộng:* Nếu cần chạy cụm lớn hơn (50 - 100 máy S9), có thể lắp ghép nhiều GPU trên cùng một server hoặc sử dụng cơ chế chia tải (Clustering) ra nhiều máy server LAN.
*   **Ổ cứng:** SSD NVMe M.2 tốc độ cao dung lượng **1 TB** (để chứa các file Model AI nặng hàng chục GB và ghi âm cuộc gọi).
*   **Hạ tầng mạng:** Bộ chuyển mạch Gigabit Switch 1Gbps, kết nối dây cáp Cat6 trực tiếp từ Boxphone và PC Server vào Switch.

### 2. Phương án B: Chạy mô hình Hybrid Cloud (AI chạy Cloud, PC chỉ làm Gateway)
Toàn bộ phần xử lý STT, LLM, TTS sẽ gọi qua các API của các nhà cung cấp bên thứ ba (như OpenAI, Groq, FPT AI, Vbee...). Máy tính PC đặt tại văn phòng chỉ làm nhiệm vụ nhận/gửi âm thanh từ Boxphone và chuyển tiếp lên Internet.

*   **Bộ xử lý (CPU):** Intel Core i5 / i7 (Thế hệ 10 trở lên) hoặc AMD Ryzen 5 / 7.
*   **Bộ nhớ trong (RAM):** **8 GB** hoặc **16 GB**.
*   **Card đồ họa (GPU):** Không yêu cầu.
*   **Năng lực tải thực tế (Số máy S9 chạy đồng thời):**
    *   Một máy PC thông thường có thể quản lý luồng điều khiển và âm thanh cho **50 – 100 máy Samsung S9** gọi đồng thời (vì việc xử lý AI nặng đã được chuyển giao hoàn toàn lên Cloud).
    *   *Giới hạn ở đây:* Phụ thuộc hoàn toàn vào băng thông mạng Internet (mỗi cuộc gọi WebRTC/UDP cần khoảng 100Kbps băng thông) và giới hạn số lượt gọi API/phút (Rate Limits) của gói dịch vụ Cloud AI bạn mua.
*   **Ổ cứng:** SSD 256 GB / 512 GB.
*   **Đường truyền Internet:** Cần đường truyền cáp quang băng thông rộng, băng thông quốc tế cao và độ trễ Ping tới các Server AI (Singapore/Mỹ) ổn định ở mức **< 50ms**. Bắt buộc phải có kết nối mạng dự phòng (2 nhà mạng khác nhau) để tránh gián đoạn hệ thống.

---

## VIII. ĐÁNH GIÁ TÍNH KHẢ THI CỦA DỰ ÁN (FEASIBILITY ASSESSMENT)

Tổng quan dự án tích hợp hệ thống AI Voice Agent đàm thoại qua cụm Boxphone Samsung S9 được đánh giá là **HOÀN TOÀN KHẢ THI** về cả mặt kỹ thuật lẫn kinh tế, nếu kiểm soát tốt các yếu tố then chốt dưới đây:

### 1. Tính khả thi về mặt Kỹ thuật (Technical Feasibility): **8.5 / 10**
*   **Khả năng kết nối và điều khiển phần cứng:** **Khả thi cao**. Việc giao tiếp điều khiển qua WebSocket giữa Node.js và Android đã rất phổ biến và có độ ổn định tuyệt đối trong mạng LAN.
*   **Truyền dẫn âm thanh độ trễ thấp:** **Khả thi**. Node.js (với module `dgram` cho UDP) và Electron (với WebRTC) đủ năng lực truyền âm thanh thời gian thực với độ trễ LAN cực nhỏ (< 20ms).
*   **Xử lý AI thời gian thực dưới 1 giây:** **Khả thi**. Các card đồ họa thế hệ mới (RTX 4090, RTX 5070) kết hợp với công nghệ Streaming và mô hình AI nén (Quantized) hoàn toàn xử lý xong STT + LLM + TTS trong vòng **700ms - 900ms**.
*   **Yếu tố quyết định (Prerequisite):** Bắt buộc phải **Root được Samsung S9** và cài Custom ROM/Magisk Module để trích xuất được luồng âm thanh đàm thoại trực tiếp từ modem viễn thông (Audio HAL). Đây là phần việc cần làm Proof of Concept (POC) đầu tiên trước khi triển khai phần mềm.

### 2. Tính khả thi về mặt Vận hành & Kinh tế (Operational & Financial Feasibility): **9.5 / 10**
*   **Hiệu quả chi phí (ROI):** Cực kỳ cao. Thay vì duy trì một phòng telesales 10 - 20 người với chi phí lương cứng, BHXH và quản lý lớn, hệ thống AI Callbot chạy qua Boxphone chỉ tốn chi phí điện năng, khấu hao phần cứng và cước viễn thông nội mạng thông thường (khoảng 500đ – 1000đ/phút).
*   **Khả năng mở rộng (Scalability):** Dễ dàng nâng cấp. Khi muốn tăng công suất từ 10 cuộc gọi lên 50 hay 100 cuộc gọi đồng thời, chỉ cần mua thêm điện thoại S9 cắm vào cụm Boxphone và lắp thêm card GPU vào máy chủ AI, phần mềm hoàn toàn giữ nguyên kiến trúc điều phối.

### 3. Các rủi ro lớn cần kiểm soát (Key Risks & Mitigation):
1.  **Rủi ro cháy nổ, phồng pin Boxphone:** 
    *   *Khắc phục:* Tủ Boxphone bắt buộc phải có quạt tản nhiệt công suất lớn thổi liên tục và sử dụng mạch ngắt sạc thông minh (hoặc tháo pin chạy trực tiếp bằng nguồn điện DC 4.2V đấu dây).
2.  **Rủi ro nhà mạng chặn SIM (Spam Block):**
    *   *Khắc phục:* Cài đặt kịch bản đảo SIM tự động (SIM Rotation) trên Tool Node.js. Giới hạn số cuộc gọi tối đa của mỗi SIM mỗi ngày dưới ngưỡng quy định của nhà mạng và giãn cách thời gian giữa các cuộc gọi để tránh bị quét spam.
3.  **Rủi ro mất kết nối mạng LAN:**
    *   *Khắc phục:* Không sử dụng Wi-Fi cho các thiết bị S9 và PC. Toàn bộ thiết bị kết nối qua cáp mạng Cat6 và Gigabit Switch chuyên dụng để đảm bảo băng thông âm thanh không bao giờ bị nghẽn hay rớt gói.

---

## IX. DANH SÁCH CHUẨN BỊ TRIỂN KHAI (PREPARATION CHECKLIST)

Để cuộc họp kỹ thuật diễn ra hiệu quả và dự án được bắt đầu suôn sẻ, dưới đây là các đầu việc và thiết bị cần chuẩn bị sẵn:

### 1. Chuẩn bị cho Cuộc họp Dev sắp tới (Meeting Agenda & Docs)
*   **Gửi trước tài liệu đề xuất:** Gửi file [De_Xuat_Va_Cau_Hoi_Hop_Dev.md](file:///d:/tool_telesale/De_Xuat_Va_Cau_Hoi_Hop_Dev.md) cho đội ngũ Dev của đối tác trước cuộc họp ít nhất 1 ngày để họ nghiên cứu trước.
*   **Xác định phân chia ranh giới công việc (RACI):**
    *   *Đội ngũ của bạn (Kết nối):* Chịu trách nhiệm về thiết bị Boxphone, Android ROM, Root máy, Agent App điều khiển trên S9 và truyền luồng âm thanh ra mạng LAN.
    *   *Đội ngũ đối tác (Dev Khách hàng):* Chịu trách nhiệm tích hợp lệnh điều khiển vào Tool PC Node.js/Electron, kết nối luồng âm thanh LAN vào AI Engine (STT/LLM/TTS) để AI trò chuyện.
*   **Tập trung vào bộ câu hỏi cốt lõi:** Làm rõ kịch bản AI chạy Local hay Cloud và giao thức AI tiếp nhận âm thanh (WebRTC hay UDP).

### 2. Chuẩn bị thiết bị thử nghiệm thực tế (POC Hardware)
Không cần mua cả cụm Boxphone lớn ngay từ đầu. Để làm thử nghiệm kỹ thuật (POC), bạn chỉ cần chuẩn bị:
*   **01 Điện thoại Samsung S9:** Đã được Root thành công, nạp Custom ROM và cài đặt module can thiệp âm thanh cuộc gọi (như Magisk Audio Return Channel).
*   **02 SIM điện thoại:** Đã kích hoạt, đăng ký gói cước cuộc gọi và nạp tiền đầy đủ để thực hiện cuộc gọi kiểm thử.
*   **01 Thiết bị mạng Switch nhỏ (hoặc Router LAN):** Và cáp mạng Cat6 để cắm dây trực tiếp từ điện thoại S9 (qua cổng chuyển đổi OTG-to-Ethernet) và máy tính PC vào chung mạng LAN.
*   **01 PC cấu hình thử nghiệm:** 
    *   Có cài sẵn môi trường chạy Node.js / Electron.
    *   Có GPU NVIDIA (nếu muốn chạy thử AI Local) hoặc kết nối mạng internet tốc độ cao (nếu muốn gọi thử API Cloud).

### 3. Chuẩn bị tài liệu Nghiệp vụ & Kịch bản AI
*   **Kịch bản hội thoại mẫu (Text):** 1 kịch bản chào hàng ngắn (dưới 10 câu thoại qua lại) để nạp vào AI chạy thử nghiệm đàm thoại.
*   **Tài liệu API của AI Engine:** Nếu đối tác đã có sẵn máy chủ AI hoặc sử dụng bên thứ 3 (như OpenAI, FPT, Vbee...), hãy chuẩn bị sẵn tài liệu kết nối API của họ để nhóm nghiên cứu cấu trúc dữ liệu truyền nhận âm thanh.
