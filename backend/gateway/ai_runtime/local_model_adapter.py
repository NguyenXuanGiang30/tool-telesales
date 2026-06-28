from __future__ import annotations

import asyncio
import json
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from .errors import AIProviderError, AIProviderSchemaError, AIProviderTimeout
from .schemas import AIDisposition, ConversationContext, DialogReply, TranscriptTurn


@dataclass(frozen=True)
class LocalModelAdapterConfig:
    base_url: str
    mode: str = "simple_json"
    model: str = "local-model"
    api_key: str | None = None
    timeout_ms: int = 1200
    max_retries: int = 0
    greeting_text: str = (
        "Xin chao, em la tro ly tu dong. "
        "Em co the trao doi voi minh mot chut duoc khong?"
    )


class LocalModelHTTPAdapter:
    provider_name = "local_model"

    def __init__(self, config: LocalModelAdapterConfig) -> None:
        self._config = config

    async def start_session(self, context: ConversationContext) -> DialogReply:
        return DialogReply(text=self._config.greeting_text.strip())

    async def generate_reply(
        self, context: ConversationContext, turn: TranscriptTurn
    ) -> DialogReply:
        request = self._build_request(context, turn)
        path = "/v1/chat/completions" if self._config.mode == "openai_chat" else "/generate"
        payload = await self._post_with_retries(path, request)
        if self._config.mode == "openai_chat":
            return self._parse_openai_chat(payload)
        if self._config.mode == "simple_json":
            return self._parse_simple_json(payload)
        raise AIProviderSchemaError(self.provider_name, f"unsupported mode: {self._config.mode}")

    def _build_request(
        self, context: ConversationContext, turn: TranscriptTurn
    ) -> dict[str, Any]:
        if self._config.mode == "openai_chat":
            messages = [
                {
                    "role": "system",
                    "content": "You are a concise Vietnamese telesales assistant.",
                }
            ]
            messages.extend(context.history)
            messages.append({"role": "user", "content": f"Khach vua noi: {turn.text}"})
            return {"model": self._config.model, "messages": messages, "temperature": 0.2}
        return {
            "call_id": context.session.call_id,
            "lead": {
                "phone_number": context.session.phone_number,
                "campaign_id": context.session.campaign_id,
                "lead_id": context.session.lead_id,
                "metadata": dict(context.session.metadata),
            },
            "history": context.history,
            "customer_text": turn.text,
        }

    async def _post_with_retries(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        attempts = self._config.max_retries + 1
        last_error: AIProviderError | None = None
        for _attempt in range(attempts):
            try:
                return await asyncio.to_thread(self._post_json, path, body)
            except AIProviderError as exc:
                last_error = exc
                if not self._is_retryable(exc):
                    raise
        if last_error:
            raise last_error
        raise AIProviderError(self.provider_name, "request failed without an exception")

    def _post_json(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = self._config.base_url.rstrip("/") + path
        headers = {"Content-Type": "application/json"}
        if self._config.api_key:
            headers["Authorization"] = f"Bearer {self._config.api_key}"
        request = urllib.request.Request(
            url=url,
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        timeout_seconds = self._config.timeout_ms / 1000
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except socket.timeout as exc:
            raise AIProviderTimeout(self.provider_name, self._config.timeout_ms) from exc
        except TimeoutError as exc:
            raise AIProviderTimeout(self.provider_name, self._config.timeout_ms) from exc
        except urllib.error.HTTPError as exc:
            if exc.code >= 500:
                raise AIProviderError(self.provider_name, f"http_{exc.code}") from exc
            raise AIProviderSchemaError(self.provider_name, f"http_{exc.code}") from exc
        except urllib.error.URLError as exc:
            raise AIProviderError(self.provider_name, str(exc.reason)) from exc
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AIProviderSchemaError(self.provider_name, "response is not valid JSON") from exc
        if not isinstance(payload, dict):
            raise AIProviderSchemaError(self.provider_name, "response JSON must be an object")
        return payload

    def _parse_openai_chat(self, payload: dict[str, Any]) -> DialogReply:
        try:
            text = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderSchemaError(
                self.provider_name, "OpenAI response must include choices[0].message.content"
            ) from exc
        if not isinstance(text, str) or not text.strip():
            raise AIProviderSchemaError(self.provider_name, "OpenAI response text is empty")
        return DialogReply(text=text.strip())

    def _parse_simple_json(self, payload: dict[str, Any]) -> DialogReply:
        text = payload.get("text")
        if not isinstance(text, str) or not text.strip():
            raise AIProviderSchemaError(self.provider_name, "simple response requires text")
        disposition = self._parse_disposition(payload.get("disposition"))
        tags = payload.get("tags") or []
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            raise AIProviderSchemaError(self.provider_name, "tags must be a list of strings")
        next_action = payload.get("next_action") or "none"
        if not isinstance(next_action, str):
            raise AIProviderSchemaError(self.provider_name, "next_action must be a string")
        return DialogReply(
            text=text.strip(),
            disposition=disposition,
            tags=tags,
            next_action=next_action,
            complete=disposition is not None,
        )

    @staticmethod
    def _parse_disposition(value: object) -> AIDisposition | None:
        if value in (None, ""):
            return None
        if not isinstance(value, str):
            raise AIProviderSchemaError("local_model", "disposition must be a string")
        try:
            return AIDisposition(value)
        except ValueError as exc:
            raise AIProviderSchemaError("local_model", f"unsupported disposition: {value}") from exc

    @staticmethod
    def _is_retryable(error: AIProviderError) -> bool:
        return isinstance(error, AIProviderError) and not isinstance(
            error, AIProviderSchemaError
        )
