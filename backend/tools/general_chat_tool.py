"""
general_chat_tool.py — General cybersecurity Q&A fallback.

Contract:
  - Always waiting=False (no workflow, just answering)
  - Returns status="chat" to distinguish from workflow messages
"""
import logging

from services.ai_service import answer_training_question

logger = logging.getLogger("cyberdesk.tool.general_chat")


class GeneralChatTool:

    def execute(self, request, conversation, current_user, db, ai_result):
        logger.info("[GENERAL_CHAT] Question: %r", request.message[:60])

        result = answer_training_question(
            video_title="General Security Awareness",
            user_question=request.message
        )

        conversation.pending_action = None
        db.commit()

        answer = result.get("answer", "").strip()
        if not answer:
            answer = "I don't have a specific answer for that. Could you rephrase or provide more context?"

        return {
            "status":   "chat",
            "response": answer,
            "completed": False,
        }