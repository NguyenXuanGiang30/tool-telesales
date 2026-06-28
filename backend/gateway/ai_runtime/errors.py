from __future__ import annotations


class AIRuntimeError(Exception):
    """Base error for AI runtime failures."""


class UnknownAISessionError(AIRuntimeError):
    def __init__(self, call_id: str) -> None:
        super().__init__(f"AI session not found: {call_id}")
        self.call_id = call_id


class AISessionAlreadyEndedError(AIRuntimeError):
    def __init__(self, call_id: str) -> None:
        super().__init__(f"AI session already ended: {call_id}")
        self.call_id = call_id


class AIProviderError(AIRuntimeError):
    def __init__(self, provider: str, message: str) -> None:
        super().__init__(f"{provider} provider failed: {message}")
        self.provider = provider
        self.message = message


class AIProviderTimeout(AIProviderError):
    def __init__(self, provider: str, timeout_ms: int) -> None:
        super().__init__(provider, f"timed out after {timeout_ms}ms")
        self.timeout_ms = timeout_ms


class AIProviderSchemaError(AIProviderError):
    def __init__(self, provider: str, message: str) -> None:
        super().__init__(provider, message)
