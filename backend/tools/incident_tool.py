"""
incident_tool.py — Reasoning-Driven SOC Security Incident workflow engine (v3).

Architecture
------------
On every turn the LLM receives the incident type, all collected evidence,
and the conversation history. It decides what to ask next, extracts multiple
evidence fields from a single user message, and signals COLLECT/READY_FOR_TICKET/RESOLVED.

Python stores extracted evidence in WorkflowMemory and creates the ticket
only when the LLM returns READY_FOR_TICKET (subject to a minimum-evidence guard).

soc_evidence_fields.json is kept as a field schema reference:
  - Field keys (e.g. "sender_email") are used as memory keys and in summaries.
  - Field labels (e.g. "Sender Email") are sent to the LLM as "evidence still needed".
  - Question text and validators are no longer used for question ordering.
  - Safety messages are still shown exactly once at workflow start.

Contracts
---------
  - tool_completed() returned ONLY after db.commit() on a real Incident row.
  - tool_waiting()   returned for every intermediate step.
  - Minimum 2 evidence items must be collected before READY_FOR_TICKET is honoured.
"""

import json
import logging
import os
import re
from datetime import datetime
from typing import Optional

from models.incident import Incident
from agent.workflow_memory import WorkflowMemory
from agent.tool_response import tool_waiting, tool_completed
from tools.incident_classifier import classify_incident
from services.ai_service import reason_soc_incident

logger = logging.getLogger("cyberdesk.tool.incident")

# ── Load field schema (for labels, keys, and safety messages) ─────────────────
_FIELDS_PATH = os.path.join(os.path.dirname(__file__), "soc_evidence_fields.json")
with open(_FIELDS_PATH, "r", encoding="utf-8") as _f:
    _CONFIG = json.load(_f)

_SAFETY_MESSAGES: dict[str, str] = _CONFIG.get("_safety_messages", {})

# Minimum number of evidence items Python requires before honouring READY_FOR_TICKET
_MIN_EVIDENCE_COUNT = 2


def _get_field_schema(category: str) -> list[dict]:
    """Return the field list for a category (used for labels and keys only)."""
    cat_cfg = _CONFIG.get(category, _CONFIG.get("unknown", {}))
    return cat_cfg.get("fields", [])


def _get_missing_field_labels(category: str, evidence: dict) -> list[str]:
    """Return human-readable labels for fields not yet collected."""
    fields = _get_field_schema(category)
    return [
        f["label"]
        for f in fields
        if not evidence.get(f["key"])
    ]


def _build_summary(category: str, severity: str, evidence: dict, reporter: Optional[str] = None) -> str:
    """Generate a clean summary from collected evidence."""
    fields = _get_field_schema(category)
    lines = ["Incident Summary", ""]
    lines.append(f"Category: {category.replace('_', ' ').title()}")
    lines.append(f"Severity: {severity}")
    if reporter:
        lines.append(f"Reporter: {reporter}")
    lines.append("")
    for field in fields:
        val = evidence.get(field["key"]) or "—"
        lines.append(f"{field['label']}: {val}")
    lines.append("")
    lines.append("Creating your SOC incident ticket...")
    return "\n".join(lines)


# ── Main tool class ────────────────────────────────────────────────────────────
class IncidentTool:

    def execute(self, request, conversation, current_user, db, ai_result):
        memory = WorkflowMemory(conversation.collected_entities)
        phase  = memory.get("soc.phase")  # None | "collecting"

        logger.info(
            "[INCIDENT] execute | soc.phase=%s | category=%s",
            phase, memory.get("soc.category"),
        )

        if phase is None:
            return self._start_workflow(request, conversation, current_user, db, memory)

        if phase == "collecting":
            return self._run_reasoning_turn(request, conversation, current_user, db, memory)

        # Unexpected phase — restart safely
        logger.warning("[INCIDENT] Unknown soc.phase=%r — restarting workflow", phase)
        memory.set("soc.phase", None)
        return self._start_workflow(request, conversation, current_user, db, memory)

    # ── First call ─────────────────────────────────────────────────────────────

    def _start_workflow(self, request, conversation, current_user, db, memory: WorkflowMemory):
        """Classify the incident, show safety message, start reasoning loop."""
        problem = conversation.original_problem or request.message

        classified = classify_incident(problem)
        category   = classified.get("category", "unknown")
        severity   = classified.get("severity", "Medium")
        confidence = classified.get("confidence", 0.5)

        logger.info("[INCIDENT] START | category=%s | severity=%s", category, severity)

        # Initialise memory
        memory.set("problem",        problem)
        memory.set("soc.phase",      "collecting")
        memory.set("soc.category",   category)
        memory.set("soc.severity",   severity)
        memory.set("soc.confidence", confidence)
        memory.set("soc.evidence",   {})  # key-value evidence store

        conversation.original_problem   = problem
        conversation.pending_action     = "security_incident"
        conversation.summary            = problem
        conversation.collected_entities = memory.to_json()
        db.commit()

        # Show safety message (once only, before any LLM reasoning)
        safety_msg = _SAFETY_MESSAGES.get(category, _SAFETY_MESSAGES.get("unknown", ""))

        # Get missing field labels for initial LLM context
        missing_labels = _get_missing_field_labels(category, {})

        conv_history = getattr(request, "conversation_history", [])

        result = reason_soc_incident(
            incident_type=category,
            collected_evidence={},
            missing_field_labels=missing_labels,
            conversation_history=conv_history,
            current_user=current_user,
            initial_severity=severity,
            ticket_context=memory.get("ticket_context"),
        )

        intent = result.get("intent") or result.get("status", "COLLECT")
        logger.info("[INCIDENT] First reasoning turn | intent=%s", intent)

        # Store any extracted evidence from the opening message
        if result["memory_updates"]:
            evidence = memory.get("soc.evidence") or {}
            evidence.update(result["memory_updates"])
            memory.set("soc.evidence", evidence)
            conversation.collected_entities = memory.to_json()
            db.commit()

        # Update severity if changed
        memory.set("soc.severity", result.get("severity", severity))
        conversation.collected_entities = memory.to_json()
        db.commit()

        # Prepend safety message to the first assistant response
        llm_response = result["assistant_response"]
        if safety_msg:
            full_response = f"{safety_msg}\n\n{llm_response}"
        else:
            full_response = llm_response

        # Check if the LLM already has enough evidence from the initial message
        if intent == "READY_FOR_TICKET":
            if memory.get("ticket_context"):
                logger.info("[INCIDENT] First turn READY_FOR_TICKET but ticket_context exists — preventing duplicate ticket")
                return tool_waiting(
                    "There is already an open security incident ticket for this issue. I’ll continue using that ticket unless you’re reporting a completely different problem.",
                    memory
                )
                
            evidence = memory.get("soc.evidence") or {}
            if len([v for v in evidence.values() if v]) >= _MIN_EVIDENCE_COUNT:
                return self._create_incident(request, conversation, db, memory, current_user)

        return tool_waiting(full_response, memory)

    # ── Subsequent calls ───────────────────────────────────────────────────────

    def _run_reasoning_turn(self, request, conversation, current_user, db, memory: WorkflowMemory):
        """Every call after the first: run LLM reasoning, store extracted evidence, act on status."""
        category  = memory.get("soc.category") or "unknown"
        severity  = memory.get("soc.severity") or "Medium"
        evidence  = memory.get("soc.evidence") or {}

        missing_labels = _get_missing_field_labels(category, evidence)
        conv_history   = getattr(request, "conversation_history", [])

        result = reason_soc_incident(
            incident_type=category,
            collected_evidence=evidence,
            missing_field_labels=missing_labels,
            conversation_history=conv_history,
            current_user=current_user,
            initial_severity=severity,
            ticket_context=memory.get("ticket_context"),
        )

        intent = result.get("intent") or result.get("status", "COLLECT")
        logger.info(
            "[INCIDENT] Reasoning turn | intent=%s | updates=%s",
            intent, list(result["memory_updates"].keys()),
        )

        # Merge extracted evidence
        if result["memory_updates"]:
            evidence.update(result["memory_updates"])
            memory.set("soc.evidence", evidence)

        # Update severity
        new_severity = result.get("severity", severity)
        memory.set("soc.severity", new_severity)
        conversation.collected_entities = memory.to_json()
        db.commit()

        # ── Handle status ──────────────────────────────────────────────────────
        if intent == "RESOLVED":
            logger.info("[INCIDENT] LLM returned RESOLVED — no ticket needed")
            conversation.pending_action   = None
            conversation.original_problem = None
            conversation.summary          = None
            conversation.collected_entities = None
            db.commit()
            return tool_completed(
                "Understood — I won't create an incident ticket. "
                "If anything changes or you need to report this later, feel free to reach out."
            )

        if intent == "READY_FOR_TICKET":
            if memory.get("ticket_context"):
                logger.info("[INCIDENT] LLM returned READY_FOR_TICKET but ticket_context exists — preventing duplicate ticket")
                return tool_waiting(
                    "There is already an open security incident ticket for this issue. I’ll continue using that ticket unless you’re reporting a completely different problem.",
                    memory
                )
                
            # Python minimum-evidence guard
            collected_count = len([v for v in evidence.values() if v])
            if collected_count >= _MIN_EVIDENCE_COUNT:
                logger.info("[INCIDENT] READY_FOR_TICKET with %d evidence items — creating ticket", collected_count)
                return self._create_incident(request, conversation, db, memory, current_user)
            else:
                logger.info("[INCIDENT] READY_FOR_TICKET but only %d evidence items — continuing collection", collected_count)
                # Fall through to COLLECT

        if intent == "TICKET_QUERY":
            logger.info("[INCIDENT] LLM returned TICKET_QUERY — answering from ticket_context")
            return tool_waiting(result["assistant_response"], memory)

        if intent == "NEW_ISSUE":
            logger.info("[INCIDENT] LLM returned NEW_ISSUE — clearing workflow for fresh routing")
            conversation.pending_action           = None
            conversation.pending_tool             = None
            conversation.original_problem         = None
            conversation.summary                  = None
            conversation.collected_entities       = None
            db.commit()
            return {"status": "waiting", "response": result["assistant_response"]}

        # COLLECT — keep gathering
        return tool_waiting(result["assistant_response"], memory)

    # ── Ticket creation ────────────────────────────────────────────────────────

    @staticmethod
    def _create_incident(request, conversation, db, memory: WorkflowMemory, current_user):
        """
        Create the Incident DB row and return tool_completed().
        This is the ONLY place that writes to the database for this tool.
        """
        category   = memory.get("soc.category") or "unknown"
        severity   = memory.get("soc.severity") or "Medium"
        confidence = float(memory.get("soc.confidence", 0.5) or 0.5)
        problem    = conversation.original_problem or memory.get("problem") or "Security incident via AI Assistant"
        evidence   = memory.get("soc.evidence") or {}
        history    = getattr(request, "conversation_history", [])

        # Build description using LLM
        from services.ai_service import generate_ticket_description
        description = generate_ticket_description(problem, evidence, [], history, current_user)

        reporter_name = None
        if current_user:
            reporter_name = getattr(current_user, "full_name", None) or getattr(current_user, "email", None)

        # Build summary for display
        summary_text = _build_summary(
            category=category,
            severity=severity,
            evidence=evidence,
            reporter=reporter_name,
        )

        incident = Incident(
            title=f"Security Incident: {category.replace('_', ' ').title()} — {problem[:60]}",
            description=description,
            category=category.replace("_", " ").title(),
            severity=severity,
            confidence_score=confidence,
            status="Open",
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)

        # Save active ticket context in WorkflowMemory so it can be asked about later
        memory.set("ticket_context", {
            "id": incident.id,
            "type": "Security Incident",
            "category": incident.category,
            "summary": incident.title,
            "status": incident.status,
            "priority": incident.severity
        })

        # Clear conversation state
        conversation.pending_action     = None
        conversation.original_problem   = None
        conversation.summary            = None
        conversation.collected_entities = memory.to_json()
        db.commit()

        logger.info(
            "[INCIDENT] Created | id=%d | category=%s | severity=%s | evidence_items=%d",
            incident.id, incident.category, incident.severity, len(evidence),
        )

        card_status = {
            "Critical": "critical",
            "High":     "critical",
            "Medium":   "pending",
            "Low":      "success",
        }.get(severity, "critical")

        ticket_line = (
            f"SOC Incident #{incident.id} has been created.\n"
            f"Category: {incident.category}  |  Severity: {incident.severity}\n"
            f"Our SOC team has been notified and will begin reviewing the incident."
        )
        reply = f"{summary_text}\n\n{ticket_line}"

        action_card = {
            "label": "SECURITY INCIDENT CREATED",
            "detail": (
                f"Incident ID: INC-{incident.id} · "
                f"Category: {incident.category} · "
                f"Severity: {incident.severity} · "
                f"Assigned SOC Analyst: Pending Review · "
                f"Status: Open"
            ),
            "status": card_status,
        }

        return tool_completed(reply, action_card=action_card, memory=memory)