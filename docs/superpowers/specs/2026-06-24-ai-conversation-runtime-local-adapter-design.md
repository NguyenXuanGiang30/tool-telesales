# AI Conversation Runtime and Local Model Adapter Design

## Muc Tieu

Xay slice tiep theo sau Gateway core: mot AI Conversation Runtime co the tu dieu khien hoi thoai tren tung `call_id`, co built-in agent de demo/test end-to-end, va co adapter ro rang de khach hang gan mo hinh AI local cua ho vao ma khong can cham den Boxphone, S9, SIM, hay audio routing.

Thanh cong cua slice nay la:

- Gateway co the start/end AI session theo tung call.
- Moi call co conversation state rieng, transcript rieng, result rieng.
- Built-in AI co the tu tao loi chao, nghe input, tra loi theo kich ban, ket thuc va tra disposition.
- Local model adapter co the goi mot HTTP server local cua khach hang de lay cau tra loi.
- Neu AI local loi, cham, hoac tra sai schema, Gateway khong treo va call session duoc mark failed/result hop ly.
- Toan bo logic co test tu dong, khong phu thuoc GPU hay model nang.

## Pham Vi Slice Nay

Trong pham vi:

- AI session lifecycle: start, receive audio/text, detect turn, generate response, end.
- Provider interfaces cho STT, LLM/dialog, TTS.
- Built-in deterministic conversation agent de demo/test.
- Local HTTP model adapter cho model local cua khach hang.
- Schema cho AI events, transcript, response, command, result.
- Timeout, fallback, va error handling cho provider.
- Tests cho multi-session isolation va adapter failures.

Ngoai pham vi slice nay:

- Flutter Android Agent.
- Native/root call audio bridge.
- Cai dat model STT/TTS nang trong repo.
- Fine-tune model AI cho tung nganh.
- Dashboard UI quan tri AI.
- WebRTC/SRTP audio transport.

## Nguyen Tac Thiet Ke

Gateway van la chu session. AI chi la plugin duoc goi qua contract.

AI Runtime khong duoc biet S9 nao dang goi, SIM nao dang dung, hay UDP port nao dang nhan audio. Runtime chi nhan `call_id`, metadata lead/campaign, audio/text input va tra ve audio/text/result/command.

Built-in agent khong thay the AI cua khach hang. No la implementation mac dinh de he thong co the chay demo va test khi chua co model local.

Local model adapter uu tien giao thuc HTTP de khach hang de tich hop: cung may Gateway, cung LAN, hoac container local. Phase sau moi can gRPC/WebSocket streaming nang hon.

## Kien Truc De Xuat

```text
Gateway Call Session
        |
        v
AI Runtime
  |
  +-- ConversationSessionStore
  +-- TurnDetector
  +-- STTProvider
  +-- DialogProvider
  +-- TTSProvider
  |
  +-- BuiltInConversationAgent
  +-- LocalModelHTTPAdapter
        |
        v
Customer Local AI Server
```

## Module Moi

Tao package moi:

```text
backend/gateway/ai_runtime/
  __init__.py
  schemas.py
  providers.py
  conversation.py
  builtin_agent.py
  local_model_adapter.py
  errors.py
```

Tests:

```text
backend/tests/gateway/ai_runtime/
  test_conversation.py
  test_builtin_agent.py
  test_local_model_adapter.py
  test_runtime_errors.py
```

## Schemas

`schemas.py` dinh nghia cac dataclass chinh:

- `AISessionStart`: call_id, phone_number, campaign_id, lead_id, metadata, sample_rate, channels.
- `AudioInputFrame`: call_id, sequence_number, timestamp_ms, pcm.
- `TranscriptTurn`: call_id, text, confidence, started_at_ms, ended_at_ms.
- `AssistantResponse`: call_id, text, audio_frames, command.
- `AIResult`: call_id, disposition, summary, tags, next_action.
- `AISessionState`: started, listening, thinking, speaking, completed, failed.

Disposition mac dinh:

- `interested`
- `not_interested`
- `callback`
- `human_requested`
- `no_answer`
- `voicemail`
- `completed`
- `failed`

## Provider Interfaces

`providers.py` dinh nghia:

```python
class STTProvider(Protocol):
    async def transcribe(self, call_id: str, pcm: bytes, sample_rate: int) -> TranscriptTurn | None:
        raise NotImplementedError

class DialogProvider(Protocol):
    async def generate_reply(self, context: ConversationContext, turn: TranscriptTurn) -> DialogReply:
        raise NotImplementedError

class TTSProvider(Protocol):
    async def synthesize(self, call_id: str, text: str, sample_rate: int) -> list[bytes]:
        raise NotImplementedError
```

Provider phai co timeout. Timeout mac dinh:

- STT: 800 ms cho mot turn da ket thuc.
- Dialog/LLM: 1200 ms trong LAN/local mode.
- TTS: 1000 ms cho cau tra loi ngan.

Neu provider timeout, Runtime tra result failed hoac fallback response tuy cau hinh.

## Turn Detection

Target UX: khi khach dung noi, AI bat dau tra loi trong 700 ms den 1000 ms neu provider local du nhanh.

Turn detector dung cau hinh mac dinh:

- Frame audio: 20 ms.
- Silence threshold sau speech: 250 ms.
- Max customer turn: 12 giay.
- Max no-input wait: 8 giay.

Trong slice nay, implementation testable co the nhan transcript truc tiep de tranh phu thuoc STT that. Audio path van giu provider interface de sau nay gan Faster-Whisper hoac STT server local.

## Built-in Conversation Agent

Built-in agent la rule-based/deterministic de co the test va demo khong can model nang.

Flow toi thieu:

1. Khi session start, tao greeting text:
   `Xin chao, em goi tu bo phan tu van. Em co the trao doi voi anh chi mot chut duoc khong?`
2. Nhan transcript khach hang.
3. Phan loai intent bang keyword/rule:
   - Quan tam: `co`, `duoc`, `quan tam`, `bao gia`, `tu van`.
   - Tu choi: `khong`, `ban`, `khong can`, `dung goi`.
   - Goi lai: `goi lai`, `luc khac`, `mai`.
   - Gap nguoi that: `nhan vien`, `nguoi that`, `tu van vien`.
4. Tra loi theo intent.
5. Tao `AIResult` khi flow ket thuc.

Built-in agent khong can la AI thong minh. No can on dinh, du de demo pipeline va lam fallback khi local model chua san sang.

## Local Model HTTP Adapter

`local_model_adapter.py` ho tro hai schema:

### OpenAI-compatible Chat

Request:

```json
{
  "model": "local-model",
  "messages": [
    {"role": "system", "content": "You are a telesales assistant."},
    {"role": "user", "content": "Khach vua noi: toi quan tam"}
  ],
  "temperature": 0.2
}
```

Response duoc doc tu:

```json
{
  "choices": [
    {
      "message": {
        "content": "Da, em se gui thong tin bao gia cho anh chi."
      }
    }
  ]
}
```

### Simple Local JSON

Request:

```json
{
  "call_id": "call-123",
  "lead": {},
  "history": [],
  "customer_text": "toi quan tam"
}
```

Response:

```json
{
  "text": "Da, em se gui bao gia.",
  "disposition": "interested",
  "tags": ["interested"],
  "next_action": "send_quote"
}
```

Adapter config:

- `base_url`
- `mode`: `openai_chat` hoac `simple_json`
- `model`
- `api_key`
- `timeout_ms`
- `max_retries`

Adapter khong duoc throw exception len Gateway route neu loi provider da duoc classify. No phai tra error co cau truc de Runtime mark session failed hoac fallback.

## TTS Trong Slice Nay

Slice nay khong cai model TTS nang. Thay vao do co hai provider:

- `NoopTTSProvider`: tra danh sach audio frame rong, dung cho tests va text-only adapter.
- `StaticPromptTTSProvider`: map mot so intent sang PCM/WAV co san neu sau nay co asset audio.

Real TTS provider se la slice rieng sau khi chot engine local. Runtime va contract da san sang de gan provider do ma khong doi Gateway.

## Data Flow

Start session:

```text
CallRouter allocates device
  -> Call connected
  -> Gateway creates AISessionStart
  -> AI Runtime creates ConversationSession
  -> Built-in/Local provider returns greeting
  -> Gateway streams greeting audio if TTS provider returns frames
```

Customer turn:

```text
AudioPacket customer_to_ai
  -> AI Runtime buffer per call_id
  -> TurnDetector decides end of turn
  -> STTProvider returns TranscriptTurn
  -> DialogProvider returns DialogReply
  -> TTSProvider returns audio frames
  -> Runtime returns AssistantResponse to Gateway
```

End session:

```text
Hangup / timeout / conversation complete
  -> AI Runtime closes session
  -> AIResult stored on session metadata
  -> Gateway can expose result via API
```

## Error Handling

Required failures:

- Unknown call_id: reject input with structured error.
- Duplicate start session: return existing session unless previous session ended.
- STT timeout: ask customer to repeat once, then fail if repeated.
- Dialog timeout: fallback to polite retry once, then fail.
- TTS timeout: return text-only response and mark `audio_unavailable`.
- Local model invalid JSON: mark provider error with raw status and body excerpt.
- Local model HTTP 5xx: retry up to configured `max_retries`.
- Session end while provider running: ignore late response and do not reopen session.

## Testing Strategy

Unit tests:

- Built-in agent returns greeting on start.
- Built-in agent classifies interested/refusal/callback/human request.
- Conversation runtime isolates two simultaneous sessions.
- Late provider response after session ended does not mutate completed session.
- Local model adapter parses OpenAI-compatible response.
- Local model adapter parses simple JSON response.
- Local model adapter handles timeout and invalid schema.

Integration-style tests:

- Start session, feed transcript, get assistant response, end session with result.
- Multi-session flow: two calls receive different transcripts and results do not mix.

Verification commands:

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
npm.cmd run lint
```

## Acceptance Criteria

- Gateway code exposes a concrete AI runtime object that can be used by future Gateway audio routing code.
- Built-in AI can run without external model server.
- Local model adapter works with a fake HTTP server in tests.
- AI session state is keyed by `call_id` and isolated.
- Provider timeout/error does not crash Gateway.
- All gateway tests pass.
- TypeScript lint remains passing.

## Rollout Sau Slice Nay

Sau khi slice nay pass tests:

1. Gan AI Runtime vao Gateway audio route de xu ly `AudioPacket`.
2. Them API config cho local model endpoint.
3. Them real STT provider.
4. Them real TTS provider.
5. Sau do moi sang Flutter Android Agent/audio bridge.
