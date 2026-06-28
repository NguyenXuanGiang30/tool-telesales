import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from backend.gateway.ai_runtime.errors import AIProviderSchemaError
from backend.gateway.ai_runtime.local_model_adapter import (
    LocalModelAdapterConfig,
    LocalModelHTTPAdapter,
)
from backend.gateway.ai_runtime.schemas import (
    AIDisposition,
    AISessionStart,
    ConversationContext,
    ConversationSession,
    TranscriptTurn,
)


def run(coro):
    return asyncio.run(coro)


class JsonHandler(BaseHTTPRequestHandler):
    response_body = {}
    status_code = 200
    requests = []

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        JsonHandler.requests.append(
            {
                "path": self.path,
                "authorization": self.headers.get("Authorization"),
                "body": json.loads(body.decode("utf-8")),
            }
        )
        self.send_response(JsonHandler.status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(JsonHandler.response_body).encode("utf-8"))

    def log_message(self, format, *args):
        return


class LocalServer:
    def __enter__(self):
        JsonHandler.requests = []
        self.server = HTTPServer(("127.0.0.1", 0), JsonHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"
        return self

    def __exit__(self, exc_type, exc, tb):
        self.server.shutdown()
        self.thread.join(timeout=2)


def make_context() -> ConversationContext:
    session = ConversationSession.from_start(
        AISessionStart(
            call_id="call-1",
            phone_number="0987654321",
            metadata={"name": "Anh A"},
        )
    )
    return ConversationContext(session=session)


def test_local_adapter_returns_configured_greeting_on_start():
    adapter = LocalModelHTTPAdapter(
        LocalModelAdapterConfig(
            base_url="http://127.0.0.1:9",
            greeting_text="Xin chao tu local model",
        )
    )

    reply = run(adapter.start_session(make_context()))

    assert reply.text == "Xin chao tu local model"
    assert reply.complete is False


def test_local_adapter_parses_simple_json_response():
    JsonHandler.status_code = 200
    JsonHandler.response_body = {
        "text": "Da, em se gui bao gia.",
        "disposition": "interested",
        "tags": ["interested"],
        "next_action": "send_quote",
    }
    with LocalServer() as server:
        adapter = LocalModelHTTPAdapter(
            LocalModelAdapterConfig(base_url=server.base_url, mode="simple_json")
        )
        reply = run(
            adapter.generate_reply(
                make_context(),
                TranscriptTurn(call_id="call-1", text="toi quan tam"),
            )
        )

    assert reply.text == "Da, em se gui bao gia."
    assert reply.disposition == AIDisposition.INTERESTED
    assert reply.tags == ["interested"]
    assert reply.next_action == "send_quote"
    assert JsonHandler.requests[0]["path"] == "/generate"
    assert JsonHandler.requests[0]["body"]["customer_text"] == "toi quan tam"


def test_local_adapter_parses_openai_chat_response():
    JsonHandler.status_code = 200
    JsonHandler.response_body = {
        "choices": [{"message": {"content": "Em da ghi nhan nhu cau."}}]
    }
    with LocalServer() as server:
        adapter = LocalModelHTTPAdapter(
            LocalModelAdapterConfig(
                base_url=server.base_url,
                mode="openai_chat",
                model="local-model",
                api_key="secret",
            )
        )
        reply = run(
            adapter.generate_reply(
                make_context(),
                TranscriptTurn(call_id="call-1", text="toi can tu van"),
            )
        )

    assert reply.text == "Em da ghi nhan nhu cau."
    assert reply.disposition is None
    assert JsonHandler.requests[0]["path"] == "/v1/chat/completions"
    assert JsonHandler.requests[0]["authorization"] == "Bearer secret"


def test_local_adapter_retries_http_5xx_then_succeeds():
    attempts = {"count": 0}

    class RetryHandler(JsonHandler):
        def do_POST(self):
            attempts["count"] += 1
            if attempts["count"] == 1:
                length = int(self.headers.get("Content-Length", "0"))
                if length > 0:
                    self.rfile.read(length)
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"temporary failure")
                return
            JsonHandler.do_POST(self)

    JsonHandler.status_code = 200
    JsonHandler.response_body = {"text": "Da, em nghe anh chi.", "disposition": "completed"}
    server = HTTPServer(("127.0.0.1", 0), RetryHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        adapter = LocalModelHTTPAdapter(
            LocalModelAdapterConfig(
                base_url=f"http://127.0.0.1:{server.server_port}",
                mode="simple_json",
                max_retries=1,
            )
        )
        reply = run(
            adapter.generate_reply(
                make_context(),
                TranscriptTurn(call_id="call-1", text="xin chao"),
            )
        )
    finally:
        server.shutdown()
        thread.join(timeout=2)

    assert attempts["count"] == 2
    assert reply.text == "Da, em nghe anh chi."


def test_local_adapter_rejects_invalid_simple_json_schema():
    JsonHandler.status_code = 200
    JsonHandler.response_body = {"message": "missing text"}
    with LocalServer() as server:
        adapter = LocalModelHTTPAdapter(
            LocalModelAdapterConfig(base_url=server.base_url, mode="simple_json")
        )
        try:
            run(
                adapter.generate_reply(
                    make_context(),
                    TranscriptTurn(call_id="call-1", text="xin chao"),
                )
            )
        except AIProviderSchemaError as exc:
            assert exc.provider == "local_model"
            assert "text" in exc.message
        else:
            raise AssertionError("Expected AIProviderSchemaError")
