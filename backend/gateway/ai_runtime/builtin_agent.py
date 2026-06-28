from __future__ import annotations

import unicodedata

from backend.gateway.ai_runtime.schemas import (
    AIDisposition,
    ConversationContext,
    DialogReply,
    TranscriptTurn,
)


class BuiltInConversationAgent:
    greeting_text = (
        "Xin chao, em la tro ly tu dong. "
        "Em goi de tu van thong tin san pham cho minh a."
    )

    async def start_session(self, context: ConversationContext) -> DialogReply:
        return DialogReply(text=self.greeting_text)

    async def generate_reply(
        self, context: ConversationContext, turn: TranscriptTurn
    ) -> DialogReply:
        text = self._normalize_text(turn.text)

        if self._contains_any(text, ("gap nhan vien", "gap nguoi", "nhan vien")):
            return DialogReply(
                text="Em se ket noi minh voi nhan vien tu van.",
                disposition=AIDisposition.HUMAN_REQUESTED,
                tags=["human_requested"],
                next_action="transfer",
                command={"type": "transfer", "reason": "human_requested"},
                complete=True,
            )

        if self._contains_any(text, ("khong can", "dung goi", "khong quan tam")):
            return DialogReply(
                text="Da, em xin phep ghi nhan va khong lam phien minh nua.",
                disposition=AIDisposition.NOT_INTERESTED,
                tags=["not_interested"],
                complete=True,
            )

        if self._contains_any(text, ("goi lai", "luc khac", "goi sau")):
            return DialogReply(
                text="Da, em se sap xep goi lai cho minh vao luc phu hop.",
                disposition=AIDisposition.CALLBACK,
                tags=["callback"],
                next_action="schedule_callback",
                complete=True,
            )

        if self._contains_any(text, ("quan tam", "bao gia", "tu van")):
            return DialogReply(
                text="Cam on minh. Em se gui thong tin bao gia de minh tham khao.",
                disposition=AIDisposition.INTERESTED,
                tags=["interested"],
                next_action="send_quote",
                complete=True,
            )

        return DialogReply(
            text="Da, em da nghe minh. Minh co muon em gui them thong tin khong a?",
            tags=["continue"],
        )

    @staticmethod
    def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
        return any(keyword in text for keyword in keywords)

    @staticmethod
    def _normalize_text(text: str) -> str:
        decomposed = unicodedata.normalize("NFD", text)
        without_marks = "".join(
            character
            for character in decomposed
            if unicodedata.category(character) != "Mn"
        )
        ascii_text = without_marks.replace("đ", "d").replace("Đ", "D")
        return " ".join(ascii_text.lower().split())
