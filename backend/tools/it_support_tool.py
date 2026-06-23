from services.ai_service import (
    diagnose_it_issue,
    continue_it_troubleshooting
)

from models.it_ticket import ITTicket
from models.ticket_history import TicketHistory
from models.assistant_message import AssistantMessage


class ITSupportTool:

    def execute(
        self,
        request,
        conversation,
        current_user,
        db,
        ai_result
    ):

        # -------------------------------
        # First interaction
        # -------------------------------
        if conversation.pending_action is None:

            analysis = diagnose_it_issue(
                request.message
            )

            conversation.pending_action = "it_support"

            conversation.summary = request.message

            conversation.original_problem = request.message

            conversation.troubleshooting_attempts = 1

            db.commit()

            return {

                "status": "waiting",

                "response":
f"""
Diagnosis:
{analysis['diagnosis']}

Let's try this first:

{analysis['resolution_steps'][0]}

After trying it, simply tell me what happened.

Examples:

• Didn't work
• Same error
• New error
• Error 691
• Still not working
• It worked
• Escalate
"""

            }

        # -------------------------------
        # Existing troubleshooting
        # -------------------------------

        if conversation.pending_action == "it_support":

            message = request.message.lower().strip()

            # User says issue solved

            if any(
                word in message
                for word in [
                    "worked",
                    "fixed",
                    "resolved",
                    "thanks",
                    "solved"
                ]
            ):

                conversation.pending_action = None
                conversation.summary = None
                conversation.original_problem = None
                conversation.troubleshooting_attempts = 0

                db.commit()

                return {

                    "status": "completed",

                    "response":
                    "Great! I'm glad the issue has been resolved."

                }

            conversation.troubleshooting_attempts += 1

            history = (

                db.query(AssistantMessage)

                .filter(
                    AssistantMessage.conversation_id
                    == conversation.id
                )

                .order_by(
                    AssistantMessage.created_at
                )

                .all()

            )

            conversation_history = ""

            for msg in history:

                conversation_history += (
                    f"{msg.sender}: {msg.message}\n"
                )

            result = continue_it_troubleshooting(

                conversation.original_problem,

                conversation_history

            )

            # User explicitly requested escalation

            if "escalate" in message:

                result["should_escalate"] = True

            # AI decides escalation
            # OR maximum attempts reached

            if (

                result["should_escalate"]

                or

                conversation.troubleshooting_attempts >= 5

            ):

                analysis = diagnose_it_issue(
                    conversation.original_problem
                )

                ticket = ITTicket(

                    title="AI Generated IT Ticket",

                    description=conversation.original_problem,

                    category=analysis["category"],

                    priority=analysis["priority"],

                    diagnosis=analysis["diagnosis"],

                    recommended_fix=analysis["recommended_fix"],

                    resolution_steps="\n".join(
                        analysis["resolution_steps"]
                    ),

                    status="Open"

                )

                db.add(ticket)

                db.commit()

                db.refresh(ticket)

                history = TicketHistory(

                    ticket_id=ticket.id,

                    action="Created by AI Assistant"

                )

                db.add(history)

                db.commit()

                conversation.pending_action = None

                conversation.summary = None

                conversation.original_problem = None

                conversation.troubleshooting_attempts = 0

                db.commit()

                return {

                    "status": "completed",

                    "response":
                    f"""
I've exhausted my troubleshooting options.

An IT ticket has been created automatically.

Ticket ID: {ticket.id}

An IT engineer will contact you shortly.
"""

                }

            db.commit()

            return {

                "status": "waiting",

                "response": result["response"]

            }