from __future__ import annotations

from backend.gateway.ai_adapter import AISessionEvent, SilentAIAdapter


def create_silent_ai_adapter() -> SilentAIAdapter:
    return SilentAIAdapter()


__all__ = ["AISessionEvent", "SilentAIAdapter", "create_silent_ai_adapter"]
