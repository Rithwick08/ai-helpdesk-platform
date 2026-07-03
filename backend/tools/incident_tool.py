"""
incident_tool.py — Workflow-driven Security Incident response engine.

Architecture (Step 3):
  - Uses incident_classifier.py to determine the incident type
  - Uses incident_workflows.py for ordered, branching response steps
  - Uses WorkflowMemory to track current_incident_step, completed_incident_steps,
    failed_incident_steps, incident_severity
  - Detects yes/no from natural language replies
  - Prioritises action_required steps before asking next question
  - RESOLVED → no incident created, tool_completed() immediately
  - ESCALATE → asks user permission, returns tool_waiting()
  - Incident created ONLY after explicit confirmation via Planner

Contract:
  - completed=True ONLY after a real Incident row is committed to the DB
  - completed=False for every response step, question, and waiting state
  - Never repeats a completed incident-response step
  - Never accuses anyone (enforced via factual Insider Threat workflow)
"""

import logging
import re
from typing import Optional

from models.incident import Incident
from agent.workflow_memory import WorkflowMemory
from agent.tool_response import tool_waiting, tool_completed
from tools.incident_classifier import classify_incident
from tools.incident_workflows import (
    get_first_step,
    get_next_step,
    get_step,
    get_workflow,
)

logger = logging.getLogger("cyberdesk.tool.incident")

MAX_INCIDENT_STEPS = 10   # absolute safety cap

# ── Reply classifier — mirrors it_support_tool._classify_reply ───────────────
# ── Ambiguous guard — checked FIRST before yes/no to avoid misclassification ──
_AMBIGUOUS_PHRASES = [
    "not sure", "not certain", "maybe", "i think", "possibly", "probably",
    "not really", "kind of", "sort of", "i don't know", "i'm not sure",
]

# yes patterns — confirmed action or affirmative response
_YES_PATTERNS = [
    r"\byes\b", r"\byep\b", r"\byeah\b",
    r"\byes,?\s*i\s*(did|have|do|clicked|entered|opened|ran)\b",
    r"\bi\s+(did|clicked|entered|opened|ran|downloaded|plugged|inserted|executed)\b",
    r"\bit\s+(happened|launched|opened|ran|executed)\b",
    r"\bconfirm\b", r"\baffirmative\b", r"\bcorrect\b", r"\bthat.?s right\b",
    r"\bdone\b", r"\bfinished\b", r"\bexternal\b",
]

# no patterns — denial or negative response
_NO_PATTERNS = [
    r"\bnope\b",
    r"\bdidn.?t\b", r"\bdid\s*n.?t\b",
    r"\bhadn.?t\b", r"\bhaven.?t\b",
    r"\bi\s+did\s*n.?t\b", r"\bi\s+have\s*n.?t\b",
    r"\bnever\b", r"\bneither\b", r"\binternal\b",
    r"\bi\s+don.?t\b", r"\bonly\s+found\b", r"\bjust\s+found\b",
    r"^no[,\.!]?$",          # standalone "no" — anchored to avoid matching "I know"
    r"\bno,\s+i\b",          # "no, I ..."
    r"\bno\s+(i|we|it|they)\b",   # "no I did" / "no it didn't"
]


def _classify_reply(text: str) -> str:
    """
    Returns 'yes', 'no', or 'ambiguous'.
    Priority: ambiguous guard → no → yes → ambiguous fallback
    Checking 'no' before 'yes' prevents "no I did not" from matching the
    'did' pattern in _YES_PATTERNS.
    """
    lowered = text.lower().strip()

    # 1. Common ambiguous phrases win immediately
    if any(phrase in lowered for phrase in _AMBIGUOUS_PHRASES):
        return "ambiguous"

    # 2. No patterns (checked before yes to catch "no I did ...")
    if any(re.search(p, lowered) for p in _NO_PATTERNS):
        return "no"

    # 3. Yes patterns
    if any(re.search(p, lowered) for p in _YES_PATTERNS):
        return "yes"

    return "ambiguous"


class IncidentTool:

    def execute(self, request, conversation, current_user, db, ai_result):
        memory = WorkflowMemory(conversation.collected_entities)

        # ── BRANCH A: First call — classify and start workflow ─────────────────
        if conversation.pending_action is None:
            return self._start_workflow(request, conversation, db, memory)

        # ── BRANCH B: Escalation confirmed — create incident ───────────────────
        if conversation.pending_action == "incident_escalate_confirm":
            return self._create_incident(conversation, db, memory)

        # ── BRANCH C: Continuing the incident-response workflow ────────────────
        if conversation.pending_action == "security_incident":
            return self._continue_workflow(request, conversation, db, memory)

        # Fallback (should not reach here)
        logger.warning("[INCIDENT] Unexpected pending_action=%s", conversation.pending_action)
        return tool_waiting(
            "I'm continuing to document your security concern. Can you describe what happened?",
            memory
        )

    # ── Branch handlers ───────────────────────────────────────────────────────

    def _start_workflow(self, request, conversation, db, memory: WorkflowMemory):
        """First call: classify incident, load workflow, present first step."""
        problem    = conversation.original_problem or request.message
        classified = classify_incident(problem)

        category = classified.get("category", "unknown")
        severity = classified.get("severity", "Medium")

        logger.info(
            "[INCIDENT] START | category=%s | severity=%s | confidence=%.2f",
            category, severity, classified.get("confidence", 0)
        )

        # Persist to memory
        memory.set("problem", problem)
        memory.set_incident_category(category)
        memory.set_incident_severity(severity)

        conversation.original_problem = problem
        conversation.pending_action   = "security_incident"
        conversation.summary          = problem

        # Load the first workflow step
        first_step = get_first_step(category)

        if not first_step:
            # No workflow for this category — straight to escalation
            logger.info("[INCIDENT] No workflow for category=%s — offering escalation", category)
            memory.set_current_incident_step("ESCALATE")
            conversation.collected_entities = memory.to_json()
            db.commit()
            return self._ask_to_escalate(conversation, db, memory)

        # Determine severity label for the opening message
        severity_emoji = {
            "Critical": "🔴 CRITICAL",
            "High":     "🟠 HIGH",
            "Medium":   "🟡 MEDIUM",
            "Low":      "🟢 LOW",
        }.get(severity, severity)

        memory.set_current_incident_step(first_step["id"])
        memory.mark_incident_step_completed(first_step["id"])
        conversation.collected_entities = memory.to_json()
        db.commit()

        # Build opening message — prepend any immediate action if required
        action_prefix = _format_action(first_step)
        reply = (
            f"I've identified this as a potential **{category.replace('_', ' ').title()}** "
            f"incident (Severity: {severity_emoji}).\n\n"
            f"I need to ask you a few questions to assess the situation.\n\n"
            f"{action_prefix}"
            f"{first_step['question']}"
        )

        logger.info("[INCIDENT] Presenting step: %s", first_step["id"])
        return tool_waiting(reply, memory)

    def _continue_workflow(self, request, conversation, db, memory: WorkflowMemory):
        """Subsequent calls: classify reply, navigate the workflow graph."""
        category     = memory.incident_category or "unknown"
        current_step = memory.current_incident_step
        attempts     = len(memory.completed_incident_steps)
        reply_class  = _classify_reply(request.message)

        logger.info(
            "[INCIDENT] CONTINUE | category=%s | step=%s | attempt=%d | "
            "reply=%s | completed=%s",
            category, current_step, attempts,
            reply_class, memory.completed_incident_steps,
        )

        # ── Safety cap ────────────────────────────────────────────────────────
        if attempts >= MAX_INCIDENT_STEPS:
            logger.info("[INCIDENT] Max steps reached — escalating")
            return self._ask_to_escalate(conversation, db, memory)

        # ── No current step (edge case) ───────────────────────────────────────
        if not current_step:
            logger.warning("[INCIDENT] No current_incident_step — escalating")
            return self._ask_to_escalate(conversation, db, memory)

        # ── Resolve yes / no / ambiguous ──────────────────────────────────────
        if reply_class == "yes":
            next_step = get_next_step(category, current_step, success=True)
            logger.info("[INCIDENT] Step %s → yes → next: %s",
                        current_step, next_step["id"] if next_step else "None")
        elif reply_class == "no":
            memory.mark_incident_step_failed(current_step)
            next_step = get_next_step(category, current_step, success=False)
            logger.info("[INCIDENT] Step %s → no → next: %s",
                        current_step, next_step["id"] if next_step else "None")
        else:
            # Ambiguous — re-ask with a yes/no prompt
            current = get_step(category, current_step)
            question = current["question"] if current else "Please answer yes or no."
            reply = (
                f"I didn't quite catch that. Could you answer yes or no?\n\n"
                f"To remind you: {question}"
            )
            conversation.collected_entities = memory.to_json()
            db.commit()
            return tool_waiting(reply, memory)

        # ── Terminal: RESOLVED ─────────────────────────────────────────────────
        if next_step and next_step["id"] == "RESOLVED":
            logger.info("[INCIDENT] Workflow reached RESOLVED — no incident needed")
            conversation.pending_action           = None
            conversation.original_problem         = None
            conversation.summary                  = None
            conversation.collected_entities       = None
            db.commit()
            return tool_completed(
                "Good news — based on your answers, this does not require a formal security "
                "incident to be logged. No incident has been created.\n\n"
                "Please follow any remaining steps I mentioned and contact the security team "
                "if you notice anything else unusual."
            )

        # ── Terminal: ESCALATE ─────────────────────────────────────────────────
        if next_step is None or next_step["id"] == "ESCALATE":
            logger.info("[INCIDENT] Workflow reached ESCALATE")
            return self._ask_to_escalate(conversation, db, memory)

        # ── Skip already-completed steps (guard against graph cycles) ─────────
        while next_step and next_step["id"] not in ("RESOLVED", "ESCALATE"):
            if memory.has_completed_incident_step(next_step["id"]):
                logger.info("[INCIDENT] Skipping already-completed step: %s", next_step["id"])
                next_step = get_next_step(category, next_step["id"], success=False)
            else:
                break

        if not next_step or next_step["id"] == "ESCALATE":
            return self._ask_to_escalate(conversation, db, memory)
        if next_step["id"] == "RESOLVED":
            conversation.pending_action     = None
            conversation.original_problem   = None
            conversation.summary            = None
            conversation.collected_entities = None
            db.commit()
            return tool_completed(
                "Based on your answers, no formal security incident needs to be logged. "
                "No incident has been created. Let me know if anything else concerns you."
            )

        # ── Present next step ──────────────────────────────────────────────────
        memory.set_current_incident_step(next_step["id"])
        memory.mark_incident_step_completed(next_step["id"])
        conversation.collected_entities = memory.to_json()
        db.commit()

        # Prepend immediate action instruction if this step has one
        action_prefix = _format_action(next_step)
        step_num      = len(memory.completed_incident_steps)
        reply = f"{action_prefix}Question {step_num}: {next_step['question']}"

        logger.info("[INCIDENT] Presenting step: %s (attempt %d)", next_step["id"], attempts + 1)
        return tool_waiting(reply, memory)

    # ── Escalation helpers ────────────────────────────────────────────────────

    @staticmethod
    def _ask_to_escalate(conversation, db, memory: WorkflowMemory):
        """
        Ask user for permission before creating a formal incident.
        Returns tool_waiting() — Planner intercepts the yes/confirm.
        """
        category = (memory.incident_category or "security").replace("_", " ").title()
        severity = memory.incident_severity or "Medium"
        steps    = len(memory.completed_incident_steps)

        summary = (
            f"I've collected enough information about this {category} incident "
            f"(Severity: {severity}).\n\n"
            f"Would you like me to submit a formal Security Incident report to the SOC team?"
        )

        conversation.pending_action     = "incident_escalate_confirm"
        conversation.collected_entities = memory.to_json()
        db.commit()

        logger.info(
            "[INCIDENT] Asking escalation confirmation | category=%s | severity=%s | steps=%d",
            category, severity, steps
        )
        return tool_waiting(summary, memory)

    @staticmethod
    def _create_incident(conversation, db, memory: WorkflowMemory):
        """
        Create a real Incident DB row.
        completed=True ONLY here, after db.commit() succeeds.
        """
        problem   = conversation.original_problem or memory.problem or "Security incident via AI Assistant"
        category  = memory.incident_category or "unknown"
        severity  = memory.incident_severity or "Medium"
        steps     = len(memory.completed_incident_steps)
        confidence = memory.get("confidence", 0) or 0

        incident = Incident(
            title=f"Security Incident: {category.replace('_', ' ').title()} — {problem[:60]}",
            description=problem,
            category=category.replace("_", " ").title(),
            severity=severity,
            confidence_score=confidence,
            status="Open"
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)

        # Clean up conversation state
        conversation.pending_action     = None
        conversation.original_problem   = None
        conversation.summary            = None
        conversation.collected_entities = None
        db.commit()

        logger.info(
            "[INCIDENT] Created | id=%d | category=%s | severity=%s",
            incident.id, incident.category, incident.severity
        )

        # Build containment summary from completed steps
        containment_note = (
            f"Our SOC team has been notified and will review the incident. "
            f"Please do not take any further action on the affected device or account "
            f"until you hear from them."
        )

        reply = (
            f"Security Incident #{incident.id} has been submitted to the SOC team.\n\n"
            f"Category: {incident.category} · Severity: {incident.severity}\n"
            f"Response steps documented: {steps}\n\n"
            f"{containment_note}"
        )

        # Severity drives the action card status colour
        card_status = {
            "Critical": "critical",
            "High":     "critical",
            "Medium":   "pending",
            "Low":      "success",
        }.get(severity, "critical")

        action_card = {
            "label":  "SECURITY INCIDENT CREATED",
            "detail": (
                f"Incident ID: INC-{incident.id} · "
                f"Category: {incident.category} · "
                f"Severity: {incident.severity} · "
                f"Assigned SOC Analyst: Pending Review · "
                f"Status: Open"
            ),
            "status": card_status
        }

        return tool_completed(reply, action_card=action_card, memory=memory)


# ── Module-level helpers ──────────────────────────────────────────────────────

def _format_action(step: dict) -> str:
    """
    If a step has an action_required instruction, format it as a prominent
    callout that the user must act on BEFORE answering the question.
    Returns an empty string if no action is required.
    """
    action = step.get("action_required")
    if not action:
        return ""
    return f"⚠️ **IMMEDIATE ACTION REQUIRED:** {action}\n\n"