# AI Integration

Gateway được thiết kế để không khóa vào một nhà cung cấp AI cụ thể. Khách hàng có thể gắn AI local hoặc cloud miễn là đáp ứng contract input/output đã thống nhất.

## Các chế độ AI hỗ trợ

### Built-in deterministic agent

Dùng cho demo và fallback khi chưa có model thật. Chế độ này giúp kiểm tra session flow mà không phụ thuộc nhà cung cấp AI.

### Local HTTP text model

Khách hàng chạy model local trên máy của họ và expose HTTP endpoint. Gateway gửi text input và nhận JSON response.

Ví dụ response đơn giản:

```json
{
  "text": "Dạ, em sẽ gửi báo giá.",
  "disposition": "interested",
  "tags": ["interested"],
  "next_action": "send_quote"
}
```

### STT/TTS split mode

Pipeline gồm:

- STT: chuyển tiếng khách hàng thành text.
- LLM/dialog model: tạo câu trả lời.
- TTS: chuyển text thành audio để phát lại cho khách.

### Realtime voice AI mode

Voice model nhận audio PCM đầu vào và trả audio PCM đầu ra. Mode này phù hợp khi khách hàng có model thoại realtime hoặc server voice riêng.

## Contract OpenAI-compatible chat mẫu

Request dạng chat:

```json
{
  "model": "customer-local-model",
  "messages": [
    {"role": "system", "content": "Bạn là nhân viên telesales."},
    {"role": "user", "content": "Khách hàng hỏi giá sản phẩm."}
  ],
  "temperature": 0.3
}
```

Response cần quy về schema nội bộ:

```json
{
  "text": "Dạ, em gửi anh chị bảng giá ngay sau cuộc gọi.",
  "disposition": "interested",
  "tags": ["price_request"],
  "next_action": "send_price_list"
}
```

## Timeout và lỗi

- Provider timeout không được làm treo Gateway.
- Schema lỗi phải trả thành provider error rõ ràng.
- Có thể bật built-in agent làm fallback nếu khách hàng đồng ý.
- Mỗi AI response phải gắn với đúng `call_id` và session.

## Mục tiêu latency

- End-of-speech detection: 600-900 ms.
- AI first token: dưới 1500 ms sau khi khách dừng nói.
- Full answer target: dưới 2500 ms cho câu trả lời ngắn.

Các mục tiêu này cần đo lại khi có STT/TTS/voice model thật và audio bridge thật.

