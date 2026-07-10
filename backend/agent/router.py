"""
router.py — Centralized routing logic for CyberDesk.

This module is the single source of truth for determining which tool should handle
a user's message. It combines:
1. Deterministic active workflow routing (from the Planner)
2. LLM intent classification for new issues (from assistant_ai)

When a workflow is active, Python routes directly to that tool.
The tool's reasoning LLM then decides the intent (CONTINUE / ESCALATE / TICKET_QUERY / etc).
This means the LLM never picks a tool mid-workflow — hallucinated tool switches are
structurally impossible.
"""

import logging
from agent.planner import Planner
from agent.assistant_ai import chat_with_ai
from agent.workflow_memory import WorkflowMemory

logger = logging.getLogger("cyberdesk.router")


class Router:

    @staticmethod
    def determine_tool(user_text: str, conversation, memory: WorkflowMemory, current_user, conversation_history) -> tuple[dict, WorkflowMemory]:
        """
        Determines the next tool/action.
        Returns a tuple: (decision_dict, memory)
        """
        # 1. Check deterministic conditions:
        #    - Global resolution / cancellation
        #    - Confirmation / soft-cancellation while AWAITING_CONFIRMATION
        #    - Active tool loop (pending_action is set)
        decision = Planner.decide(user_text, conversation, memory)

        if decision.action != "llm":
            return {
                "action": decision.action,
                "tool_name": decision.tool_name,
                "llm_result": None
            }, memory

        # 2. No active workflow — defer to Tool Selection LLM for intent classification
        ai_result = chat_with_ai(conversation_history, current_user, memory=memory)

        return {
            "action": "execute_tool",
            "tool_name": ai_result.get("recommended_tool"),
            "llm_result": ai_result
        }, memory
