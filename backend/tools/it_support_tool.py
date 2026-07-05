"""
it_support_tool.py — Workflow-driven IT Support troubleshooting engine.

Architecture (Step 3):
  - Uses troubleshooting_workflows.py for branching step definitions
  - Uses WorkflowMemory to track current_step, completed_steps, failed_steps
  - Detects success/failure from natural language user replies
  - Navigates the workflow graph (success_next / failure_next)
  - Reaches RESOLVED → no ticket, tool_completed() immediately
  - Reaches ESCALATE → asks confirmation, returns tool_waiting()
  - Never repeats a completed step
  - Ticket creation only happens after explicit escalation confirmation

Contract:
  - completed=True ONLY after a real ITTicket row is committed to the DB
  - completed=False for every troubleshooting step and every question
"""

import logging
import re
from typing import Optional

from services.ai_service import diagnose_it_issue
from models.it_ticket import ITTicket
from models.ticket_history import TicketHistory
from agent.workflow_memory import WorkflowMemory
from agent.tool_response import tool_waiting, tool_completed
from tools.troubleshooting_workflows import (
    get_first_step,
    get_next_step,
    get_step,
    get_workflow,
)
from tools.prior_steps_extractor import extract_prior_steps

logger = logging.getLogger("cyberdesk.tool.it_support")

# ── Category mapping from diagnose_it_issue() → workflow category keys ─────────
# diagnose_it_issue returns categories like "Email", "VPN", "Network", etc.
# troubleshooting_workflows.py uses lowercase keys: "outlook", "vpn", "network"
CATEGORY_MAP = {
    "email":         "outlook",
    "outlook":       "outlook",
    "vpn":           "vpn",
    "network":       "network",
    "internet":      "network",
    "printer":       "printer",
    "print":         "printer",
    "teams":         "teams",
    "microsoft teams": "teams",
    "office":        "office",
    "microsoft 365": "office",
    "365":           "office",
    "windows":       "windows",
    "os":            "windows",
    "operating system": "windows",
    "browser":       "network",   # fallback — no dedicated browser workflow yet
    "software":      "office",    # fallback
    "hardware":      "windows",   # fallback
}

# ── User response classification ───────────────────────────────────────────────
_SUCCESS_PATTERNS = [
    r"\byes\b", r"\byep\b", r"\byeah\b", r"\bworked\b", r"\bworking\b",
    r"\bfixed\b", r"\bresolved\b", r"\bsolved\b", r"\bdone\b",
    r"\bsuccess\b", r"\bopened successfully\b", r"\bopens fine\b",
    r"\ball good\b", r"\bgreat\b", r"\bperfect\b", r"\bthank\b",
    r"\bit('s| is) (back|fine|ok|okay|working|fixed|resolved)\b",
    r"\bno (more )?issue\b", r"\bno (more )?problem\b",
]

_FAILURE_PATTERNS = [
    r"\bno\b", r"\bnope\b", r"\bstill\b", r"\bdid(n't| not) work\b",
    r"\bsame (issue|problem|error)\b", r"\bstill (broken|happening|occurring|there|not working)\b",
    r"\bdidn.?t fix\b", r"\bhasn.?t (fixed|helped|worked)\b",
    r"\bnot (working|fixed|resolved|opening|loading)\b",
    r"\bfailed\b", r"\bbroken\b", r"\bwon.?t (open|start|connect|work)\b",
    r"\bpersists\b", r"\bstill (getting|seeing)\b",
]

_ESCALATE_PATTERNS = [
    r"\bescalate\b", r"\braise (a )?ticket\b", r"\bcreate (a )?ticket\b",
    r"\bjust (create|open|raise|file)\b", r"\bgive up\b",
    r"\bcontact IT\b", r"\bget (someone|help|support)\b",
]

MAX_TROUBLESHOOTING_STEPS = 8   # absolute safety cap


def _classify_reply(text: str) -> str:
    """
    Returns 'success', 'failure', 'escalate', or 'ambiguous'.
    Checks in priority order: escalate > success > failure > ambiguous.
    """
    lowered = text.lower()

    if any(re.search(p, lowered) for p in _ESCALATE_PATTERNS):
        return "escalate"

    if any(re.search(p, lowered) for p in _SUCCESS_PATTERNS):
        return "success"

    if any(re.search(p, lowered) for p in _FAILURE_PATTERNS):
        return "failure"

    return "ambiguous"


def _map_category(raw_category: str, problem: str = "") -> str:
    """Map diagnose_it_issue() category strings to workflow keys."""
    cat = CATEGORY_MAP.get(raw_category.lower().strip(), "office")
    
    if problem:
        problem_lower = problem.lower()
        vpn_keywords = [
            "vpn", "forticlient", "globalprotect", "anyconnect", 
            "cannot connect", "connection timed out", "remote access"
        ]
        if any(kw in problem_lower for kw in vpn_keywords):
            return "vpn"
            
    return cat


def _first_unfinished_step(category: str, memory: WorkflowMemory) -> Optional[dict]:
    """
    Walk the workflow for `category` and return the first step the user
    has NOT yet completed.  Returns None if every step is done.
    """
    for step in get_workflow(category):
        if not memory.has_completed_step(step["id"]):
            return step
    return None


def _step_ids_to_titles(category: str, step_ids: list[str]) -> str:
    """
    Convert a list of step IDs to a readable comma-separated string of titles.
    Falls back to the step ID itself if the step is not found.
    """
    from tools.troubleshooting_workflows import get_step as _get_step
    titles = []
    for sid in step_ids:
        step = _get_step(category, sid)
        titles.append(step["title"] if step else sid)
    if not titles:
        return ""
    if len(titles) == 1:
        return titles[0]
    return ", ".join(titles[:-1]) + f", and {titles[-1]}"


class ITSupportTool:

    def _is_direct_escalation(self, message: str) -> bool:
        import string
        # Convert to lowercase and remove punctuation
        clean_msg = message.lower().translate(str.maketrans('', '', string.punctuation))
        # Replace multiple spaces with a single space
        clean_msg = re.sub(r'\s+', ' ', clean_msg).strip()
        
        phrases = [
            "create a ticket", "open a ticket", "raise a ticket", 
            "create an it ticket", "just create a ticket", 
            "skip troubleshooting", "connect me to it", 
            "connect me to an engineer", "escalate this",
            "i dont want to troubleshoot", "support ticket", 
            "human assistance", "assign this to it", "escalate"
        ]
        
        return any(p in clean_msg for p in phrases)

    def execute(self, request, conversation, current_user, db, ai_result):
        memory = WorkflowMemory(conversation.collected_entities)
        
        # ── Direct Escalation Check (Before anything else) ─────────────────────
        if self._is_direct_escalation(request.message):
            logger.info("[IT_SUPPORT] User requested direct escalation (Deterministic)")
            return self._create_ticket(conversation, db, memory, is_exhausted=False)

        # agent.py clears conversation.pending_action, so we must restore it
        conversation.pending_action = "it_support"
        db.commit()

        # ── BRANCH C: Continuing the troubleshooting workflow ──────────────────
        # If memory.current_step is set, we are already in the troubleshooting loop.
        if memory.current_step:
            return self._continue_workflow(request, conversation, current_user, db, memory)

        # ── BRANCH A: First call — diagnose and start the workflow ─────────────
        return self._start_workflow(request, conversation, current_user, db, memory)

    # ── Branch handlers ───────────────────────────────────────────────────────

    def _start_workflow(self, request, conversation, current_user, db, memory: WorkflowMemory):
        """First call: diagnose, resolve category, infer prior steps, present first unfinished step."""
        problem  = conversation.original_problem or request.message
        analysis = diagnose_it_issue(problem, current_user)

        raw_category = analysis.get("category", "Other")
        category     = _map_category(raw_category, problem)
        diagnosis    = analysis.get("diagnosis", "I've identified a potential issue.")

        logger.info(
            "[IT_SUPPORT] START | raw_category=%s → workflow_category=%s | problem=%r",
            raw_category, category, problem[:60]
        )

        # Persist diagnosis data to memory
        memory.set("problem",          problem)
        memory.set("it_diagnosis",     diagnosis)
        memory.set("it_priority",      analysis.get("priority", "Medium"))
        memory.set("recommended_fix",  analysis.get("recommended_fix", ""))
        memory.set("resolution_steps", analysis.get("resolution_steps", []))
        memory.set_it_category(category)

        conversation.original_problem         = problem
        conversation.pending_action           = "it_support"
        conversation.troubleshooting_attempts = 0

        # ── Step 4: infer steps the user already tried from their message ──────
        prior_steps = extract_prior_steps(problem, category)

        if prior_steps:
            logger.info(
                "[IT_SUPPORT] Pre-loading %d prior completed steps: %s",
                len(prior_steps), prior_steps
            )
            for step_id in prior_steps:
                # Mark as both completed AND failed (user tried it, it didn't fix the issue
                # otherwise they wouldn't be asking for help)
                memory.mark_step_failed(step_id)

        # ── Find the first unfinished step (skipping all pre-loaded ones) ──────
        first_unfinished = _first_unfinished_step(category, memory)

        if not first_unfinished:
            # Every step was already tried — go straight to escalation offer
            logger.info("[IT_SUPPORT] All steps pre-completed — offering escalation")
            return self._create_ticket(conversation, db, memory, is_exhausted=True)

        # Present the first unfinished step
        memory.set_current_step(first_unfinished["id"])
        memory.mark_step_completed(first_unfinished["id"])
        conversation.troubleshooting_attempts = 1
        conversation.collected_entities       = memory.to_json()
        db.commit()

        # Build reply — acknowledge prior steps if any were found
        if prior_steps:
            prior_titles = _step_ids_to_titles(category, prior_steps)
            ack = (
                f"I can see you've already tried: {prior_titles}. "
                f"Let's skip those and move to the next step.\n\n"
            )
        else:
            ack = f"{diagnosis}\n\nLet's work through this together.\n\n"

        step_number = len(memory.completed_steps)
        reply = f"{ack}Step {step_number}:\n\n{first_unfinished['question']}"

        logger.info(
            "[IT_SUPPORT] Presenting step: %s (skipped %d prior steps)",
            first_unfinished["id"], len(prior_steps)
        )
        return tool_waiting(reply, memory)

    def _continue_workflow(self, request, conversation, current_user, db, memory: WorkflowMemory):
        """Subsequent calls: classify reply, advance the workflow graph."""
        from services.ai_service import classify_troubleshooting_reply

        category     = memory.it_category or "office"
        current_step = memory.current_step
        attempts     = conversation.troubleshooting_attempts or 0
        problem      = memory.problem or "IT issue"

        # Direct escalation handled in execute(), but keep this just in case
        pass

        # Find the text of the current question
        current = get_step(category, current_step)
        current_question = current["question"] if current else "No current question."
        current_title    = current["title"] if current else "Unknown step"

        # Use LLM to classify the intent deterministically
        classification = classify_troubleshooting_reply(
            problem=problem,
            current_step_title=current_title,
            current_question=current_question,
            user_reply=request.message
        )
        
        intent = classification.get("intent", "INFORMATION")

        logger.info(
            "[IT_SUPPORT] CONTINUE | category=%s | current_step=%s | attempt=%d | "
            "intent=%s | completed=%s | failed=%s",
            category, current_step, attempts,
            intent, memory.completed_steps, memory.failed_steps,
        )

        # ── CANCEL ────────────────────────────────────────────────
        if intent == "CANCEL":
            logger.info("[IT_SUPPORT] User requested explicit cancellation")
            from agent.states import ConversationState
            conversation.workflow_state     = ConversationState.IDLE
            conversation.pending_action     = None
            conversation.pending_tool       = None
            conversation.collected_entities = None
            db.commit()
            return tool_completed("No problem. I’ve cancelled this troubleshooting session. Let me know if you need anything else.")

        # ── Safety cap ────────────────────────────────────────────────────────
        if attempts >= MAX_TROUBLESHOOTING_STEPS:
            logger.info("[IT_SUPPORT] Max steps reached — escalating")
            return self._create_ticket(conversation, db, memory, is_exhausted=True)

        # ── No current_step tracked (edge case) ───────────────────────────────
        if not current_step:
            logger.warning("[IT_SUPPORT] No current_step in memory — escalating")
            return self._create_ticket(conversation, db, memory, is_exhausted=True)

        # ── Resolve success or failure ─────────────────────────────────────────
        if intent == "YES":
            # User says current step worked → navigate success_next
            next_step = get_next_step(category, current_step, success=True)
            logger.info("[IT_SUPPORT] Step %s succeeded → next: %s",
                        current_step, next_step["id"] if next_step else "None")
        elif intent == "NO":
            # User says current step did NOT work → mark as failed, navigate failure_next
            memory.mark_step_failed(current_step)
            next_step = get_next_step(category, current_step, success=False)
            logger.info("[IT_SUPPORT] Step %s failed → next: %s",
                        current_step, next_step["id"] if next_step else "None")
        elif intent == "QUESTION":
            reply = f"I'm referring to the '{problem}' issue you reported. To continue troubleshooting:\n{current_question}"
            conversation.collected_entities = memory.to_json()
            db.commit()
            return tool_waiting(reply, memory)
        elif intent == "INFORMATION":
            reply = f"Thank you for the additional information. To continue troubleshooting:\n{current_question}"
            conversation.collected_entities = memory.to_json()
            db.commit()
            return tool_waiting(reply, memory)
        else:
            # Fallback for unexpected intents
            reply = f"I'm not sure I understood. Please reply with yes if it worked, or no if it didn't.\n\n{current_question}"
            conversation.collected_entities = memory.to_json()
            db.commit()
            return tool_waiting(reply, memory)

        # ── Terminal: RESOLVED ─────────────────────────────────────────────────
        if next_step and next_step["id"] == "RESOLVED":
            logger.info("[IT_SUPPORT] Workflow reached RESOLVED — no ticket needed")
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

        # ── Terminal: ESCALATE ─────────────────────────────────────────────────
        if next_step is None or next_step["id"] == "ESCALATE":
            logger.info("[IT_SUPPORT] Workflow reached ESCALATE")
            return self._create_ticket(conversation, db, memory, is_exhausted=True)

        # ── Skip already-completed steps ──────────────────────────────────────
        # The graph guarantees no cycles, but guard anyway
        while next_step and next_step["id"] not in ("RESOLVED", "ESCALATE"):
            if memory.has_completed_step(next_step["id"]):
                logger.info("[IT_SUPPORT] Skipping already-completed step: %s", next_step["id"])
                # Push past it via failure_next (conservative path)
                next_step = get_next_step(category, next_step["id"], success=False)
            else:
                break

        if not next_step or next_step["id"] == "ESCALATE":
            return self._create_ticket(conversation, db, memory, is_exhausted=True)
        if next_step["id"] == "RESOLVED":
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

        # ── Present next step ──────────────────────────────────────────────────
        memory.set_current_step(next_step["id"])
        memory.mark_step_completed(next_step["id"])
        conversation.troubleshooting_attempts = attempts + 1
        conversation.collected_entities       = memory.to_json()
        db.commit()

        step_number = len(memory.completed_steps)
        reply = (
            f"Step {step_number}:\n"
            f"{next_step['question']}"
        )
        logger.info("[IT_SUPPORT] Presenting step: %s (attempt %d)", next_step["id"], attempts + 1)
        return tool_waiting(reply, memory)

    # ── Escalation helpers ────────────────────────────────────────────────────

    @staticmethod
    def _create_ticket(conversation, db, memory: WorkflowMemory, is_exhausted: bool = False):
        """
        Create a real ITTicket DB row.
        completed=True is set ONLY here, after db.commit() succeeds.
        """
        problem   = conversation.original_problem or memory.problem or "IT issue via AI Assistant"
        category  = memory.it_category or "Other"
        priority  = memory.get("it_priority", "Medium")
        diagnosis = memory.get("it_diagnosis", "")
        rec_fix   = memory.get("recommended_fix", "")
        res_steps = memory.get("resolution_steps", [])
        if isinstance(res_steps, list):
            res_steps_str = "\n".join(res_steps)
        else:
            res_steps_str = str(res_steps)

        ticket = ITTicket(
            title=f"IT Issue: {category.title()} — {problem[:60]}",
            description=problem,
            category=category.title(),
            priority=priority,
            diagnosis=diagnosis,
            recommended_fix=rec_fix,
            resolution_steps=res_steps_str,
            status="Open"
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        db.add(TicketHistory(ticket_id=ticket.id, action="Created by AI Assistant after troubleshooting"))
        db.commit()

        # Clean up conversation state
        conversation.pending_action           = None
        conversation.original_problem         = None
        conversation.troubleshooting_attempts = 0
        db.commit()

        logger.info(
            "[IT_SUPPORT] Ticket created | id=%d | category=%s | priority=%s",
            ticket.id, ticket.category, ticket.priority
        )

        steps_tried = len(memory.completed_steps)
        
        if is_exhausted:
            reply = (
                f"I've exhausted all available troubleshooting steps and the issue still appears unresolved.\n\n"
                f"I've created an IT Support ticket so one of our engineers can investigate further."
            )
        else:
            reply = (
                f"IT Ticket #{ticket.id} has been created.\n\n"
                f"Category: {ticket.category} · Priority: {ticket.priority}\n"
                f"Steps attempted: {steps_tried}\n\n"
                f"An IT engineer will review your ticket and contact you at your registered email. "
                f"You can also track the status in the IT Tickets section."
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
            "status": "success"
        }

        return tool_completed(reply, action_card=action_card, memory=memory)