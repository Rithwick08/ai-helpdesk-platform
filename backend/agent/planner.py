"""
planner.py — Python-first workflow planner.

The planner runs BEFORE the LLM on every user message.
It handles all deterministic decisions so the LLM is only called
when genuine natural language reasoning is actually needed.

Decision priority (highest first):
  1. RESOLVED_WITHOUT_ACTION  — issue resolved, user doesn't need action
  2. CANCELLATION             — user explicitly cancels
  3. AWAITING_CONFIRMATION    — intercept yes/no before it reaches LLM
  4. TOOL_LOOP_CONTINUATION   — already inside a tool's troubleshooting loop
  5. NEEDS_LLM                — everything else → call the LLM

Transport-independent: works with typed text, Whisper, WebRTC.
"""

import logging
from dataclasses import dataclass
from typing import Optional

from agent.states import (
    ConversationState,
    is_resolved_without_action,
    is_global_cancellation,
    is_soft_cancellation,
    is_confirmation,
)
from agent.workflow_memory import WorkflowMemory

logger = logging.getLogger("cyberdesk.planner")


@dataclass
class PlannerDecision:
    action: str              # "resolved" | "cancel" | "confirm" | "tool_loop" | "llm"
    reason: str              # Human-readable explanation for logging
    tool_name: Optional[str] = None
    memory: Optional[WorkflowMemory] = None


class Planner:
    """
    Stateless planner — all state is read from conversation and memory objects.
    """

    @staticmethod
    def decide(
        user_text: str,
        conversation,
        memory: WorkflowMemory,
    ) -> PlannerDecision:
        """
        Analyse the user's message and current conversation state.
        Return a PlannerDecision telling the agent what to do next.
        """
        current_state = (
            getattr(conversation, "workflow_state", None)
            or ConversationState.IDLE
        )

        logger.info(
            "[PLANNER] state=%s | pending_action=%s | pending_tool=%s | steps=%s | text=%r",
            current_state,
            conversation.pending_action,
            conversation.pending_tool,
            memory.completed_steps,
            user_text[:80],
        )

        # ── 1. Resolution detection (always wins) ──────────────────────────────
        if is_resolved_without_action(user_text):
            decision = PlannerDecision(
                action="resolved",
                reason="User indicated issue is resolved without needing action",
                memory=memory,
            )
            logger.info("[PLANNER] → %s (%s)", decision.action, decision.reason)
            return decision

        # ── 2. Global Cancellation detection (always wins except over resolution) ─────
        if is_global_cancellation(user_text):
            decision = PlannerDecision(
                action="cancel",
                reason="User explicitly cancelled the workflow",
                memory=memory,
            )
            logger.info("[PLANNER] → %s (%s)", decision.action, decision.reason)
            return decision

        # ── 2b. State-aware Soft Cancellation ──────────────────────────────────
        is_asking_confirmation = (
            current_state == ConversationState.AWAITING_CONFIRMATION or
            conversation.pending_action in ["it_escalate_confirm", "incident_escalate_confirm", "password_reset_waiting"]
        )
        if is_asking_confirmation and is_soft_cancellation(user_text):
            decision = PlannerDecision(
                action="cancel",
                reason="User declined the confirmation prompt (soft cancellation)",
                memory=memory,
            )
            logger.info("[PLANNER] → %s (%s)", decision.action, decision.reason)
            return decision

        # ── 3. Confirmation interception ───────────────────────────────────────
        if current_state == ConversationState.AWAITING_CONFIRMATION:
            if is_confirmation(user_text):
                decision = PlannerDecision(
                    action="confirm",
                    reason="User confirmed pending action; will execute tool",
                    tool_name=conversation.pending_tool,
                    memory=memory,
                )
                logger.info("[PLANNER] → %s (%s)", decision.action, decision.reason)
                return decision
            elif "?" in user_text or any(q in user_text.lower() for q in ["why ", "how ", "what ", "when ", "who ", "can ", "could "]):
                # Genuine follow-up question -> let LLM answer it
                decision = PlannerDecision(
                    action="llm",
                    reason="User asked a follow-up question during confirmation",
                    tool_name=conversation.pending_tool,
                    memory=memory,
                )
                logger.info("[PLANNER] → %s (%s)", decision.action, decision.reason)
                return decision
            else:
                # Random nonsense -> politely ask for confirmation again
                decision = PlannerDecision(
                    action="reask_confirmation",
                    reason="Unclear response while awaiting confirmation",
                    tool_name=conversation.pending_tool,
                    memory=memory,
                )
                logger.info("[PLANNER] → %s (%s)", decision.action, decision.reason)
                return decision

        # ── 4. Active tool loop (IT troubleshooting or incident follow-up) ─────
        if conversation.pending_action in (
            "it_support", "security_incident",
            "password_reset_waiting", "it_escalate_confirm",
            "incident_escalate_confirm",
        ):
            tool_map = {
                "it_support":               "it_support",
                "security_incident":        "security_incident",
                "password_reset_waiting":   "password_reset",
                "it_escalate_confirm":      "it_support",           # → _create_ticket
                "incident_escalate_confirm":"security_incident",    # → _create_incident
            }
            tool = tool_map.get(conversation.pending_action, conversation.pending_action)
            decision = PlannerDecision(
                action="tool_loop",
                reason=f"Active tool loop: {conversation.pending_action}",
                tool_name=tool,
                memory=memory,
            )
            logger.info("[PLANNER] → %s (%s)", decision.action, decision.reason)
            return decision

        # ── 5. Everything else needs the LLM ──────────────────────────────────
        decision = PlannerDecision(
            action="llm",
            reason="No deterministic decision possible; deferring to LLM",
            memory=memory,
        )
        logger.info("[PLANNER] → %s (%s)", decision.action, decision.reason)
        return decision
