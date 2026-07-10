"""
password_reset_tool.py — Password Reset request creation.

Contract:
  - completed=True ONLY after a real PasswordReset row has been committed
  - If account_type is missing, returns waiting with a specific question
  - Never returns a generic response
"""
import logging

from models.password_reset import PasswordReset
from agent.workflow_memory import WorkflowMemory
from agent.tool_response import tool_waiting, tool_completed

logger = logging.getLogger("cyberdesk.tool.password_reset")

KNOWN_ACCOUNT_TYPES = [
    "Windows Login", "VPN", "Microsoft 365", "Email",
    "Company Portal", "Azure AD", "Other"
]


class PasswordResetTool:

    def execute(self, request, conversation, current_user, db, ai_result):
        memory = WorkflowMemory(conversation.collected_entities)
        entities = ai_result.get("entities", {}) if ai_result else {}

        # Resolve account_type from multiple sources (priority order)
        account_type = (
            entities.get("account_type")
            or memory.account_type
            or conversation.summary
        )

        phase = memory.get("pr.phase")

        # ── Missing account_type: ask for it ──────────────────────────────────
        if not account_type:
            memory.set("pr.phase", "collecting")
            conversation.collected_entities = memory.to_json()
            db.commit()
            logger.info("[PASSWORD_RESET] Waiting for account type")
            return tool_waiting(
                "Which account needs a password reset?\n\n"
                "• Windows Login\n• VPN\n• Microsoft 365\n• Email\n• Other",
                memory
            )

        # ── Collect account_type from follow-up message ───────────────────────
        if phase == "collecting":
            account_type = request.message.strip() or "company account"
            memory.set("account_type", account_type)
            # Proceed to confirmation below
        
        # ── Handle Confirmation Phase ──────────────────────────────────────────
        if phase == "awaiting_confirmation":
            msg = request.message.strip().lower()
            
            # Note: Planner might have already classified this, but we parse here 
            # to fulfill the internal confirmation contract.
            confirm_words = ["yes", "yes.", "yes please", "sure", "okay", "proceed"]
            cancel_words = ["no", "cancel", "stop", "never mind"]
            
            if msg in cancel_words:
                memory.set("pr.phase", None)
                conversation.collected_entities = memory.to_json()
                db.commit()
                return {"status": "cancelled", "response": "Password reset cancelled."}
                
            if msg not in confirm_words:
                return {
                    "status": "waiting_confirmation",
                    "response": f"I didn't quite catch that. Shall I create a password reset request for your {account_type} account?"
                }
            
            # User confirmed, fall through to creation
        else:
            # First time hitting confirmation phase
            memory.set("pr.phase", "awaiting_confirmation")
            conversation.collected_entities = memory.to_json()
            db.commit()
            logger.info("[PASSWORD_RESET] Asking for confirmation")
            return {
                "status": "waiting_confirmation",
                "response": f"I will create a password reset request for your {account_type} account. Shall I go ahead?",
            }

        # ── Create the real reset record (after confirmation) ─────────────────
        reset = PasswordReset(
            employee_id=current_user.employee_id,
            account_type=account_type,
            reason="Requested via AI Assistant",
            priority="Medium",
            action_taken="Pending",
            status="Pending"
        )
        db.add(reset)
        db.commit()
        db.refresh(reset)

        conversation.pending_action = None
        conversation.summary        = None
        memory.set("pr.phase", None)
        conversation.collected_entities = memory.to_json()
        db.commit()

        logger.info(
            "[PASSWORD_RESET] Created | id=%d | account=%s | employee=%s",
            reset.id, account_type, current_user.email
        )

        reply = (
            f"Password reset request created for your {account_type} account.\n\n"
            f"Request ID: PR-{reset.id}\n"
            f"An OTP will be sent to your registered device — it expires in 15 minutes.\n"
            f"If you don't receive it within 2 minutes, check your spam folder."
        )

        action_card = {
            "label":  "PASSWORD RESET INITIATED",
            "detail": (
                f"Request ID: PR-{reset.id} · "
                f"Account: {account_type} · "
                f"OTP sent to registered device · "
                f"Expires in 15 minutes · "
                f"Status: Pending Verification"
            ),
            "status": "pending"
        }

        return tool_completed(reply, action_card=action_card, memory=memory)