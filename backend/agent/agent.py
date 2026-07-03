"""
agent.py — CyberDeskAgent v2: State-driven enterprise AI agent.

Architecture:
  1. Planner runs FIRST — handles all deterministic decisions
  2. LLM called ONLY when natural language reasoning is needed
  3. Agent is the SOLE authority on state transitions

State machine:
  IDLE
    → COLLECTING_INFORMATION  (planner asks LLM for one question)
    → AWAITING_CONFIRMATION   (LLM decides enough info collected)
    → EXECUTING               (user confirmed)
    → COMPLETED

  Any state → RESOLVED_WITHOUT_ACTION  (user says issue fixed)
  Any state → CANCELLED                (user cancels)

Transport-independent: works with typed text, Whisper, WebRTC.
"""

import json
import logging

from agent.tool_executor import ToolExecutor
from agent.planner import Planner
from agent.states import ConversationState
from agent.workflow_memory import WorkflowMemory

logger = logging.getLogger("cyberdesk.agent")


class CyberDeskAgent:

    @staticmethod
    def run(ai_result, request, conversation, current_user, db):
        """
        Main entry point. Called once per user message.
        ai_result may be None if the planner short-circuits before the LLM.
        """
        user_text = request.message.strip()

        # ── Load structured workflow memory ────────────────────────────────────
        memory = WorkflowMemory(conversation.collected_entities)

        # ── Run planner (Python-first, transport-independent) ──────────────────
        decision = Planner.decide(user_text, conversation, memory)

        logger.info(
            "[AGENT] planner_action=%s | workflow_state=%s | tool=%s",
            decision.action,
            getattr(conversation, "workflow_state", "IDLE"),
            decision.tool_name,
        )

        # ── Route based on planner decision ────────────────────────────────────

        if decision.action == "resolved":
            return CyberDeskAgent._resolved_without_action(conversation, db)

        if decision.action == "cancel":
            return CyberDeskAgent._cancel(conversation, db)

        if decision.action == "confirm":
            return CyberDeskAgent._execute_tool(
                decision.tool_name, request, conversation, current_user, db, ai_result or {}
            )

        if decision.action == "reask_confirmation":
            return {
                "status": "waiting",
                "response": "Just to confirm — should I go ahead? Reply yes to proceed, or say cancel to stop."
            }

        if decision.action == "tool_loop":
            # Already inside an active tool's troubleshooting loop
            return CyberDeskAgent._execute_tool(
                decision.tool_name, request, conversation, current_user, db, ai_result or {}
            )

        # ── LLM path — process AI recommendation ──────────────────────────────
        return CyberDeskAgent._handle_llm_result(
            ai_result, request, conversation, current_user, db, memory
        )

    # ── LLM result processor ───────────────────────────────────────────────────

    @staticmethod
    def _handle_llm_result(ai_result, request, conversation, current_user, db, memory: WorkflowMemory):
        recommended_state = ai_result.get("recommended_state", ConversationState.IDLE)
        recommended_tool  = ai_result.get("recommended_tool")
        response_text     = ai_result.get("response", "")
        entities          = ai_result.get("entities", {})

        logger.info(
            "[AGENT] llm_recommended_state=%s | recommended_tool=%s | entities=%s",
            recommended_state,
            recommended_tool,
            {k: v for k, v in entities.items() if v is not None},
        )

        # Merge newly extracted entities into workflow memory
        memory.merge_entities(entities)

        # Carry forward the original problem if not yet set
        if not memory.problem and request.message:
            memory.set("problem", request.message)
        if not conversation.original_problem and request.message:
            conversation.original_problem = request.message

        if recommended_state == ConversationState.COLLECTING_INFORMATION:
            conversation.workflow_state = ConversationState.COLLECTING_INFORMATION
            if recommended_tool:
                conversation.pending_tool = recommended_tool
            conversation.collected_entities = memory.to_json()

            logger.info(
                "[AGENT] COLLECTING | missing_for_tool=%s | completed_steps=%s",
                memory.missing_for_tool(recommended_tool or ""),
                memory.completed_steps,
            )

            db.commit()
            return {"status": "waiting", "response": response_text}

        if recommended_state == ConversationState.READY_TO_EXECUTE and recommended_tool:
            # Check tool requirements
            missing = memory.missing_for_tool(recommended_tool)
            if missing:
                logger.warning(
                    "[AGENT] READY_TO_EXECUTE but missing fields %s — staying in COLLECTING",
                    missing,
                )
                conversation.workflow_state = ConversationState.COLLECTING_INFORMATION
                conversation.pending_tool   = recommended_tool
                conversation.collected_entities = memory.to_json()
                db.commit()
                return {"status": "waiting", "response": response_text}

            conversation.collected_entities = memory.to_json()
            return CyberDeskAgent._ask_for_confirmation(
                recommended_tool, response_text, request, conversation, db
            )

        if recommended_state in (
            ConversationState.RESOLVED_WITHOUT_ACTION,
            ConversationState.CANCELLED,
        ):
            # LLM detected resolution/cancellation — honour it
            if recommended_state == ConversationState.RESOLVED_WITHOUT_ACTION:
                return CyberDeskAgent._resolved_without_action(conversation, db)
            return CyberDeskAgent._cancel(conversation, db)

        # Default: IDLE / chat / general answer
        conversation.workflow_state = ConversationState.IDLE
        conversation.collected_entities = memory.to_json()
        db.commit()
        return {"status": "chat", "response": response_text or "How can I help you?"}

    # ── Tool execution ─────────────────────────────────────────────────────────

    @staticmethod
    def _execute_tool(tool_name, request, conversation, current_user, db, ai_result):
        logger.info("[AGENT] EXECUTING tool=%s", tool_name)

        conversation.workflow_state = ConversationState.EXECUTING
        conversation.pending_action = None   # tool sets its own sub-state if needed
        db.commit()

        result = ToolExecutor.execute(
            tool_name=tool_name,
            request=request,
            conversation=conversation,
            current_user=current_user,
            db=db,
            ai_result=ai_result,
        )

        status    = result.get("status", "")
        completed = result.get("completed", False)  # must be explicitly True

        if status == "completed" and completed is True:
            # ── Validate: only accept COMPLETED if tool confirmed a real DB action ──
            logger.info("[AGENT] COMPLETED tool=%s | action_card=%s",
                        tool_name, result.get("action_card") is not None)
            conversation.workflow_state           = ConversationState.COMPLETED
            conversation.pending_tool             = None
            conversation.pending_action           = None
            conversation.collected_entities       = None
            conversation.original_problem         = None
            conversation.troubleshooting_attempts = 0
            db.commit()

        elif status == "completed" and not completed:
            # Tool said "completed" but did NOT set completed=True → treat as waiting
            logger.warning(
                "[AGENT] Tool %s returned status=completed but completed=False — "
                "rejecting COMPLETED, keeping workflow active",
                tool_name,
            )
            result["status"] = "waiting"
            conversation.workflow_state = ConversationState.COLLECTING_INFORMATION
            db.commit()

        elif status == "waiting":
            logger.info("[AGENT] tool=%s still in progress (waiting)", tool_name)
            conversation.workflow_state = ConversationState.COLLECTING_INFORMATION
            db.commit()

        elif status in ("cancelled", "error"):
            logger.info("[AGENT] tool=%s ended with status=%s", tool_name, status)
            CyberDeskAgent._clear_workflow(conversation, db)

        return result

    @staticmethod
    def _ask_for_confirmation(tool_name, response_text, request, conversation, db):
        conversation.workflow_state = ConversationState.AWAITING_CONFIRMATION
        conversation.pending_tool   = tool_name
        if not conversation.original_problem:
            conversation.original_problem = request.message
        db.commit()

        logger.info("[AGENT] AWAITING_CONFIRMATION for tool=%s", tool_name)

        prompt = response_text or "I have everything I need. Shall I go ahead?"
        return {"status": "waiting", "response": prompt}

    # ── Terminal state helpers ─────────────────────────────────────────────────

    @staticmethod
    def _resolved_without_action(conversation, db):
        logger.info("[AGENT] RESOLVED_WITHOUT_ACTION")
        CyberDeskAgent._clear_workflow(conversation, db)
        conversation.workflow_state = ConversationState.RESOLVED_WITHOUT_ACTION
        db.commit()
        return {
            "status": "completed",
            "response": "Glad it's working again. I won't create any ticket or request. Let me know if you need anything else."
        }

    @staticmethod
    def _cancel(conversation, db):
        logger.info("[AGENT] CANCELLED")
        CyberDeskAgent._clear_workflow(conversation, db)
        conversation.workflow_state = ConversationState.CANCELLED
        db.commit()
        return {
            "status": "cancelled",
            "response": "No problem — I've cancelled the request. Let me know if there's anything else I can help with."
        }

    @staticmethod
    def _clear_workflow(conversation, db):
        conversation.pending_action           = None
        conversation.pending_tool             = None
        conversation.collected_entities       = None
        conversation.original_problem         = None
        conversation.troubleshooting_attempts = 0
        conversation.workflow_state           = ConversationState.IDLE
        db.commit()
