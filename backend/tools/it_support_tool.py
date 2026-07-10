"""
it_support_tool.py — Reasoning-Driven IT Support troubleshooting engine.

Architecture (v4 — Workflow-Aware Reasoning):
  - On every turn, the full WorkflowMemory (including ticket_context) is passed to reason_it_support().
  - The LLM owns ALL semantic decisions: CONTINUE / RESOLVED / ESCALATE / TICKET_QUERY / NEW_ISSUE.
  - Python stores LLM-extracted facts into WorkflowMemory and acts on the returned intent.
  - No hardcoded step graph. No keyword-based intent classification.

Contracts:
  - tool_completed() returned ONLY after a real ITTicket row is committed to the DB.
  - tool_waiting()   returned for every intermediate troubleshooting turn.
  - _create_ticket() is the ONLY function that touches the database.
"""

import logging

from services.ai_service import diagnose_it_issue, reason_it_support
from models.it_ticket import ITTicket
from models.ticket_history import TicketHistory
from agent.workflow_memory import WorkflowMemory
from agent.tool_response import tool_waiting, tool_completed

logger = logging.getLogger("cyberdesk.tool.it_support")




class ITSupportTool:

    def execute(self, request, conversation, current_user, db, ai_result):
        memory = WorkflowMemory(conversation.collected_entities)

        # Restore pending_action so the planner keeps routing here
        conversation.pending_action = "it_support"
        db.commit()

        phase = memory.get("it.phase")  # None | "active"

        if phase is None:
            # ── First call: run diagnosis, store context, ask opening question ──
            return self._start_workflow(request, conversation, current_user, db, memory)
        else:
            # ── Subsequent calls: run reasoning turn ───────────────────────────
            return self._run_reasoning_turn(request, conversation, current_user, db, memory)

    # ── First call ─────────────────────────────────────────────────────────────

    def _start_workflow(self, request, conversation, current_user, db, memory: WorkflowMemory):
        """First call: run initial diagnosis and start the LLM reasoning loop."""
        problem = conversation.original_problem or request.message
        analysis = diagnose_it_issue(problem, current_user)

        category  = analysis.get("category", "Other")
        diagnosis = analysis.get("diagnosis", "")
        priority  = analysis.get("priority", "Medium")

        logger.info("[IT_SUPPORT] START | category=%s | problem=%r", category, problem[:60])

        # Store initial context in memory
        memory.set("problem",       problem)
        memory.set("it.phase",      "active")
        memory.set("it.category",   category)
        memory.set("it.diagnosis",  diagnosis)
        memory.set("it.priority",   priority)
        memory.set("it.facts",      {})
        memory.set("it.attempted",  [])

        conversation.original_problem = problem
        conversation.collected_entities = memory.to_json()
        db.commit()

        # Build full workflow summary for the reasoning LLM
        workflow_summary = memory.active_workflow_summary("it_support")
        memory_context = {
            "category":        category,
            "diagnosis":       diagnosis,
            "facts":           {},
            "attempted_steps": [],
            "ticket_context":  workflow_summary["ticket_context"],
        }

        # Get conversation history from request if available
        conv_history = getattr(request, "conversation_history", [])

        result = reason_it_support(
            problem=problem,
            memory_context=memory_context,
            conversation_history=conv_history,
            current_user=current_user,
        )

        logger.info(
            "[IT_SUPPORT] Reasoning turn | intent=%s | reasoning=%s",
            result.get("intent", result.get("status", "UNKNOWN")), result.get("reasoning", "")[:80],
        )

        # Store any extracted facts
        if result["memory_updates"]:
            facts = memory.get("it.facts") or {}
            facts.update(result["memory_updates"])
            memory.set("it.facts", facts)
            conversation.collected_entities = memory.to_json()
            db.commit()

        return self._handle_reasoning_result(result, request, conversation, current_user, db, memory)

    # ── Subsequent calls ───────────────────────────────────────────────────────

    def _run_reasoning_turn(self, request, conversation, current_user, db, memory: WorkflowMemory):
        """Every call after the first: pass context to LLM and act on result."""
        problem   = memory.get("problem") or conversation.original_problem or request.message
        category  = memory.get("it.category", "Unknown")
        diagnosis = memory.get("it.diagnosis", "")
        facts     = memory.get("it.facts") or {}
        attempted = memory.get("it.attempted") or []

        # Build full workflow summary for the reasoning LLM
        workflow_summary = memory.active_workflow_summary("it_support")
        memory_context = {
            "category":        category,
            "diagnosis":       diagnosis,
            "facts":           facts,
            "attempted_steps": attempted,
            "ticket_context":  workflow_summary["ticket_context"],
        }

        conv_history = getattr(request, "conversation_history", [])

        result = reason_it_support(
            problem=problem,
            memory_context=memory_context,
            conversation_history=conv_history,
            current_user=current_user,
        )

        logger.info(
            "[IT_SUPPORT] Reasoning turn | intent=%s | reasoning=%s",
            result.get("intent", result.get("status", "UNKNOWN")), result.get("reasoning", "")[:80],
        )

        # Merge extracted facts
        if result["memory_updates"]:
            facts = memory.get("it.facts") or {}
            facts.update(result["memory_updates"])
            memory.set("it.facts", facts)

        # Record assistant response as an attempted step (for future context)
        if result.get("assistant_response"):
            attempted = memory.get("it.attempted") or []
            # Store a short summary of what was attempted (first 80 chars of the assistant response)
            attempted.append(result["assistant_response"][:80])
            memory.set("it.attempted", attempted)

        conversation.collected_entities = memory.to_json()
        db.commit()

        return self._handle_reasoning_result(result, request, conversation, current_user, db, memory)

    # ── Result dispatcher ──────────────────────────────────────────────────────

    def _handle_reasoning_result(self, result: dict, request, conversation, current_user, db, memory: WorkflowMemory):
        """Translate LLM intent into tool response."""
        # Support both 'intent' (new) and 'status' (legacy alias) fields
        status   = result.get("intent") or result.get("status", "CONTINUE")
        response = result["assistant_response"]

        if status == "RESOLVED":
            logger.info("[IT_SUPPORT] LLM returned RESOLVED — no ticket needed")
            conversation.pending_action           = None
            conversation.original_problem         = None
            conversation.troubleshooting_attempts = 0
            conversation.collected_entities       = None
            db.commit()
            return tool_completed(
                "Great news — I'm glad that fixed it! No IT ticket was required "
                "since the issue was resolved through self-service troubleshooting. "
                "Let me know if anything else comes up."
            )

        if status == "ESCALATE":
            if memory.get("ticket_context"):
                logger.info("[IT_SUPPORT] LLM returned ESCALATE but ticket_context exists — preventing duplicate ticket")
                return tool_waiting(
                    "There is already an open ticket for this issue. I’ll continue using that ticket unless you’re reporting a completely different problem.",
                    memory
                )
            logger.info("[IT_SUPPORT] LLM returned ESCALATE — creating ticket")
            return self._create_ticket(request, conversation, current_user, db, memory, is_exhausted=True)

        if status == "TICKET_QUERY":
            # LLM has answered the ticket question using Active Ticket context.
            # Return the response without changing workflow state.
            logger.info("[IT_SUPPORT] LLM returned TICKET_QUERY — answering from ticket_context")
            return tool_waiting(response, memory)

        if status == "NEW_ISSUE":
            # User started a completely different problem. Clear current workflow.
            logger.info("[IT_SUPPORT] LLM returned NEW_ISSUE — clearing workflow for fresh routing")
            conversation.pending_action           = None
            conversation.pending_tool             = None
            conversation.original_problem         = None
            conversation.troubleshooting_attempts = 0
            conversation.collected_entities       = None
            db.commit()
            # Return a waiting response; the router will re-classify on the next turn
            # (The LLM's assistant_response explains we're moving to the new issue)
            return {"status": "waiting", "response": response}

        # CONTINUE — keep the conversation going
        return tool_waiting(response, memory)

    # ── Ticket creation ────────────────────────────────────────────────────────

    @staticmethod
    def _create_ticket(request, conversation, current_user, db, memory: WorkflowMemory, is_exhausted: bool = False):
        """
        Create a real ITTicket DB row.
        completed=True is set ONLY here, after db.commit() succeeds.
        """
        problem   = conversation.original_problem or memory.get("problem") or "IT issue via AI Assistant"
        category  = memory.get("it.category") or "Other"
        priority  = memory.get("it.priority") or "Medium"
        diagnosis = memory.get("it.diagnosis") or ""
        facts     = memory.get("it.facts") or {}
        attempted = memory.get("it.attempted") or []
        history   = getattr(request, "conversation_history", [])

        # Build a description using LLM based on full context
        from services.ai_service import generate_ticket_description
        description = generate_ticket_description(problem, facts, attempted, history, current_user)

        ticket = ITTicket(
            title=f"IT Issue: {category} — {problem[:60]}",
            description=description,
            category=category,
            priority=priority,
            diagnosis=diagnosis,
            recommended_fix="",
            resolution_steps="",
            status="Open",
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        db.add(TicketHistory(ticket_id=ticket.id, action="Created by AI Assistant after troubleshooting"))
        db.commit()

        # Save active ticket context in WorkflowMemory so it can be asked about later
        memory.set("ticket_context", {
            "id": ticket.id,
            "type": "IT Support",
            "category": ticket.category,
            "summary": ticket.title,
            "status": ticket.status,
            "priority": ticket.priority
        })

        conversation.pending_action           = None
        conversation.original_problem         = None
        conversation.troubleshooting_attempts = 0
        conversation.collected_entities       = memory.to_json()
        db.commit()

        logger.info("[IT_SUPPORT] Ticket created | id=%d | category=%s | priority=%s", ticket.id, category, priority)

        if is_exhausted:
            reply = (
                "I've worked through all the self-service troubleshooting options "
                "and the issue still appears unresolved.\n\n"
                "I've created an IT Support ticket so one of our engineers can investigate further."
            )
        else:
            reply = (
                f"IT Ticket #{ticket.id} has been created.\n\n"
                f"Category: {ticket.category} · Priority: {ticket.priority}\n\n"
                "An IT engineer will review your ticket and contact you at your registered email. "
                "You can track the status in the IT Tickets section."
            )

        action_card = {
            "label":  "IT TICKET CREATED",
            "detail": (
                f"Ticket Number: TKT-{ticket.id} · "
                f"Category: {ticket.category} · "
                f"Priority: {ticket.priority} · "
                f"Status: Open · "
                f"Assigned Queue: L1 Helpdesk"
            ),
            "status": "success",
        }

        return tool_completed(reply, action_card=action_card, memory=memory)