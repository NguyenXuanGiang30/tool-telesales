import asyncio

from backend.gateway.ai_runtime.builtin_agent import BuiltInConversationAgent
from backend.gateway.ai_runtime.conversation import ConversationRuntime
from backend.gateway.ai_runtime.errors import UnknownAISessionError
from backend.gateway.ai_runtime.schemas import (
    AIDisposition,
    AISessionStart,
    AISessionState,
    ConversationContext,
    DialogReply,
    TranscriptTurn,
)


def run(coro):
    return asyncio.run(coro)


def test_runtime_starts_session_with_greeting_response():
    runtime = ConversationRuntime(dialog_provider=BuiltInConversationAgent())

    response = run(
        runtime.start_session(
            AISessionStart(call_id="call-1", phone_number="0987654321")
        )
    )

    assert response.call_id == "call-1"
    assert "Xin chao" in response.text
    assert runtime.get_session("call-1").state == AISessionState.LISTENING


def test_runtime_keeps_two_sessions_isolated():
    runtime = ConversationRuntime(dialog_provider=BuiltInConversationAgent())
    run(runtime.start_session(AISessionStart(call_id="call-1", phone_number="0901")))
    run(runtime.start_session(AISessionStart(call_id="call-2", phone_number="0902")))

    response_1 = run(runtime.handle_transcript("call-1", "toi quan tam"))
    response_2 = run(runtime.handle_transcript("call-2", "luc khac goi lai"))

    assert response_1.call_id == "call-1"
    assert response_2.call_id == "call-2"
    assert runtime.get_session("call-1").result.disposition == AIDisposition.INTERESTED
    assert runtime.get_session("call-2").result.disposition == AIDisposition.CALLBACK


def test_runtime_rejects_unknown_call_id():
    runtime = ConversationRuntime(dialog_provider=BuiltInConversationAgent())

    try:
        run(runtime.handle_transcript("missing-call", "xin chao"))
    except UnknownAISessionError as exc:
        assert exc.call_id == "missing-call"
    else:
        raise AssertionError("Expected UnknownAISessionError")


def test_runtime_ignores_late_provider_response_after_session_end():
    class SlowProvider:
        def __init__(self) -> None:
            self.started = asyncio.Event()
            self.release = asyncio.Event()

        async def start_session(self, context: ConversationContext) -> DialogReply:
            return DialogReply(text="hello")

        async def generate_reply(
            self, context: ConversationContext, turn: TranscriptTurn
        ) -> DialogReply:
            self.started.set()
            await self.release.wait()
            return DialogReply(
                text="late response",
                disposition=AIDisposition.INTERESTED,
                complete=True,
            )

    async def scenario():
        provider = SlowProvider()
        runtime = ConversationRuntime(dialog_provider=provider)
        await runtime.start_session(AISessionStart(call_id="call-1", phone_number="0901"))
        pending = asyncio.create_task(runtime.handle_transcript("call-1", "toi quan tam"))
        await provider.started.wait()
        result = await runtime.end_session("call-1", "customer_hangup")
        provider.release.set()
        late_response = await pending
        return runtime, result, late_response

    runtime, result, late_response = run(scenario())

    assert result.disposition == AIDisposition.COMPLETED
    assert late_response.metadata["ignored"] is True
    assert runtime.get_session("call-1").state == AISessionState.COMPLETED
    assert runtime.get_session("call-1").result.disposition == AIDisposition.COMPLETED


def test_runtime_sends_only_completed_turns_in_provider_history():
    class CapturingProvider:
        def __init__(self) -> None:
            self.histories = []

        async def start_session(self, context: ConversationContext) -> DialogReply:
            return DialogReply(text="hello")

        async def generate_reply(
            self, context: ConversationContext, turn: TranscriptTurn
        ) -> DialogReply:
            self.histories.append(list(context.history))
            return DialogReply(text=f"reply to {turn.text}", complete=False)

    provider = CapturingProvider()
    runtime = ConversationRuntime(dialog_provider=provider)
    run(runtime.start_session(AISessionStart(call_id="call-1", phone_number="0901")))

    run(runtime.handle_transcript("call-1", "first customer turn"))
    run(runtime.handle_transcript("call-1", "second customer turn"))

    assert provider.histories[0] == []
    assert provider.histories[1] == [
        {"role": "user", "content": "first customer turn"},
        {"role": "assistant", "content": "reply to first customer turn"},
    ]
