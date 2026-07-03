"""
security_training_tool.py — Security awareness Q&A.

Contract:
  - Always returns completed=True (no DB side-effect, pure Q&A response)
  - Never returns a generic message
"""
import logging

from services.ai_service import answer_training_question
from agent.tool_response import tool_completed

logger = logging.getLogger("cyberdesk.tool.security_training")


class SecurityTrainingTool:

    def execute(self, request, conversation, current_user, db, ai_result):
        logger.info("[SECURITY_TRAINING] Answering: %r", request.message[:60])

        result = answer_training_question(
            video_title="General Security Awareness",
            user_question=request.message
        )

        conversation.pending_action = None
        db.commit()

        answer = result.get("answer", "").strip()
        if not answer:
            answer = "I don't have a specific answer for that, but I'd recommend checking the Security Awareness training module."

        return tool_completed(answer)