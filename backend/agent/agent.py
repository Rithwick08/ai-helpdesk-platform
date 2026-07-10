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
    def run(decision_dict, request, conversation, memory, current_user, db, perf=None):
        """
        Main entry point. Called once per user message by the Router.
        """
        action = decision_dict.get("action")
        tool_name = decision_dict.get("tool_name")
        ai_result = decision_dict.get("llm_result")

        logger.info(
            "[AGENT] action=%s | workflow_state=%s | tool=%s",
            action,
            getattr(conversation, "workflow_state", "IDLE"),
            tool_name,
        )

        if action == "resolved":
            res = CyberDeskAgent._resolved_without_action(conversation, db)
            CyberDeskAgent._debug_log_turn(conversation, memory, action, res)
            return res

        if action == "cancel":
            res = CyberDeskAgent._cancel(conversation, db)
            CyberDeskAgent._debug_log_turn(conversation, memory, action, res)
            return res

        if action == "confirm":
            res = CyberDeskAgent._execute_tool(
                tool_name, request, conversation, current_user, db, ai_result or {}, perf=perf
            )
            CyberDeskAgent._debug_log_turn(conversation, memory, action, res)
            return res

        if action == "reask_confirmation":
            res = {
                "status": "waiting",
                "response": "Just to confirm — should I go ahead? Reply yes to proceed, or say cancel to stop."
            }
            CyberDeskAgent._debug_log_turn(conversation, memory, action, res)
            return res

        if action == "tool_loop":
            # Already inside an active tool's troubleshooting loop
            res = CyberDeskAgent._execute_tool(
                tool_name, request, conversation, current_user, db, ai_result or {}, perf=perf
            )
            CyberDeskAgent._debug_log_turn(conversation, memory, action, res)
            return res

        # Process new tool execution or LLM entity extraction
        res = CyberDeskAgent._process_tool_execution(
            tool_name, ai_result, request, conversation, current_user, db, memory, perf=perf
        )
        CyberDeskAgent._debug_log_turn(conversation, memory, action, res)
        return res

    @staticmethod
    def _debug_log_turn(conversation, memory, action, result):
        logger.info(
            "\n" + "="*50 + "\n"
            "Current Workflow State: %s\n"
            "Pending Tool: %s\n"
            "Collected Entities: %s\n"
            "Missing Fields: %s\n"
            "Router Action: %s\n"
            "Tool Executed: %s\n"
            "Final Workflow State: %s\n"
            + "="*50,
            getattr(conversation, "workflow_state", "IDLE"),
            conversation.pending_tool,
            memory.to_json(),
            memory.missing_for_tool(conversation.pending_tool) if conversation.pending_tool else "N/A",
            action,
            "Yes" if getattr(conversation, "workflow_state", "IDLE") == ConversationState.COMPLETED else "No",
            getattr(conversation, "workflow_state", "IDLE")
        )

    # ── Tool execution processor ───────────────────────────────────────────────

    @staticmethod
    def _process_tool_execution(tool, ai_result, request, conversation, current_user, db, memory: WorkflowMemory, perf=None):
        if ai_result:
            response_text = ai_result.get("response", "")
            entities = ai_result.get("entities", {})
            logger.info(
                "[AGENT] Process tool=%s | entities=%s",
                tool,
                {k: v for k, v in entities.items() if v is not None},
            )
            memory.merge_entities(entities)
        else:
            response_text = ""

        # Carry forward the original problem if not yet set
        if not memory.problem and request.message:
            memory.set("problem", request.message)
        if not conversation.original_problem and request.message:
            conversation.original_problem = request.message

        if not tool:
            # Default: IDLE / chat / general answer
            conversation.workflow_state = ConversationState.IDLE
            conversation.collected_entities = memory.to_json()
            db.commit()
            return {"status": "chat", "response": response_text or "How can I help you?"}

        # ── State transitions ──────────────────────────────────────────────────
        if memory.is_ready_for_tool(tool):
            conversation.collected_entities = memory.to_json()
            db.commit()
            
            # Agent delegates completely to the tool
            return CyberDeskAgent._execute_tool(
                tool, request, conversation, current_user, db, ai_result or {}, perf=perf
            )
        else:
            conversation.workflow_state = ConversationState.COLLECTING_INFORMATION
            conversation.pending_tool = tool
            conversation.collected_entities = memory.to_json()

            logger.info(
                "[AGENT] COLLECTING | missing_for_tool=%s",
                memory.missing_for_tool(tool),
            )

            db.commit()
            return {"status": "waiting", "response": response_text}

    # ── Tool execution ─────────────────────────────────────────────────────────

    @staticmethod
    def _execute_tool(tool_name, request, conversation, current_user, db, ai_result, perf=None):
        logger.info("[AGENT] EXECUTING tool=%s", tool_name)

        conversation.workflow_state = ConversationState.EXECUTING
        conversation.pending_action = None   # tool sets its own sub-state if needed
        db.commit()

        # ── PERF: tool_start ──────────────────────────────────────────────────
        if perf is not None:
            perf.mark("tool_start")

        result = ToolExecutor.execute(
            tool_name=tool_name,
            request=request,
            conversation=conversation,
            current_user=current_user,
            db=db,
            ai_result=ai_result,
        )

        # ── PERF: tool_end ────────────────────────────────────────────────────
        if perf is not None:
            perf.mark("tool_end")

        status    = result.get("status", "")
        completed = result.get("completed", False)  # must be explicitly True

        if status == "waiting_confirmation":
            logger.info("[AGENT] AWAITING_CONFIRMATION tool=%s", tool_name)
            conversation.workflow_state = ConversationState.AWAITING_CONFIRMATION
            conversation.pending_tool   = tool_name
            if not conversation.original_problem:
                conversation.original_problem = request.message
            db.commit()
            result["status"] = "waiting" # Rewrite for frontend

        elif status == "completed" and completed is True:
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
