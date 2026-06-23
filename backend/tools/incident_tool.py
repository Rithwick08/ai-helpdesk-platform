from services.ai_service import (
    classify_incident,
    generate_incident_questions,
    continue_security_incident
)
from models.incident import Incident
from models.assistant_message import AssistantMessage


class IncidentTool:

    def execute(
        self,
        request,
        conversation,
        current_user,
        db,
        ai_result
    ):

        # First message
        # First message
        if conversation.pending_action is None:

            analysis = classify_incident(request.message)
            questions = generate_incident_questions(request.message)

            conversation.pending_action = "security_incident"
            conversation.summary = request.message

            db.commit()

            return {
                "status": "waiting",
                "response": f"""
        This appears to be a potential {analysis["category"]} incident.

        Severity: {analysis["severity"]}

        Before I create a security incident, I need a few details.

        1. {questions["questions"][0]}

        2. {questions["questions"][1]}

        3. {questions["questions"][2]}
        """
            }

        # Continue conversation
       # Continue conversation
        if conversation.pending_action == "security_incident":

            history = (
                db.query(AssistantMessage)
                .filter(
                    AssistantMessage.conversation_id == conversation.id
                )
                .order_by(AssistantMessage.created_at)
                .all()
            )

            conversation_text = ""

            for msg in history:
                conversation_text += f"{msg.sender}: {msg.message}\n"

            analysis = classify_incident(conversation.summary)

            result = continue_security_incident(
                conversation.summary,
                conversation_text
            )

            analysis["severity"] = result["severity"]

            incident = Incident(
                title="AI Generated Security Incident",
                description=conversation.summary,
                category=analysis["category"],
                severity=analysis["severity"],
                confidence_score=analysis["confidence"],
                status="Open"
            )

            db.add(incident)
            db.commit()
            db.refresh(incident)

            conversation.pending_action = None
            conversation.summary = None

            db.commit()

            actions = "\n".join(
            f"• {step}" for step in result["containment"]
        )

        return {
            "status": "completed",
            "response": f"""
        {result["response"]}

        Security Incident #{incident.id} has been created.

        Immediate containment actions:

        {actions}
        """
        }