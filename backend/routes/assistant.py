import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth.dependencies import get_current_user
from models.training_recommendation import TrainingRecommendation
from models.user import User
from models.assistant_conversation import AssistantConversation
from models.assistant_message import AssistantMessage
from services.ai_service import recommend_training
from schemas.assistant import ChatRequest
from agent.agent import CyberDeskAgent
from agent.assistant_ai import chat_with_ai
from agent.planner import Planner
from agent.workflow_memory import WorkflowMemory
from agent.states import ConversationState

logger = logging.getLogger("cyberdesk.route")

router = APIRouter(
    prefix="/assistant",
    tags=["AI Assistant"]
)


@router.post("/chat")
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ── 1. Resolve or create conversation ─────────────────────────────────────
    if request.conversation_id is None:
        conversation = AssistantConversation(user_id=current_user.id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    else:
        conversation = db.query(AssistantConversation).filter(
            AssistantConversation.id == request.conversation_id
        ).first()
        if conversation is None:
            return {"error": "Conversation not found"}

    logger.info(
        "[ROUTE] user=%s | conv=%s | state=%s | message=%r",
        current_user.email,
        conversation.id,
        getattr(conversation, "workflow_state", "IDLE"),
        request.message[:80],
    )

    # ── 2. Save user message ───────────────────────────────────────────────────
    db.add(AssistantMessage(
        conversation_id=conversation.id,
        sender="user",
        message=request.message
    ))
    db.commit()

    # ── 3. Planner pre-flight ──────────────────────────────────────────────────
    # Load workflow memory before the planner runs
    memory = WorkflowMemory(conversation.collected_entities)
    planner_decision = Planner.decide(request.message.strip(), conversation, memory)

    # ── 4. Decide whether to call the LLM ─────────────────────────────────────
    # The LLM is SKIPPED for deterministic decisions.
    LLM_REQUIRED_ACTIONS = {"llm"}

    if planner_decision.action in LLM_REQUIRED_ACTIONS:
        # Build conversation history for LLM context
        history_rows = (
            db.query(AssistantMessage)
            .filter(AssistantMessage.conversation_id == conversation.id)
            .order_by(AssistantMessage.created_at)
            .all()
        )
        conversation_history = [
            {"role": "assistant" if m.sender == "assistant" else "user", "content": m.message}
            for m in history_rows
        ]
        ai_result = chat_with_ai(conversation_history, current_user, memory=memory)
        logger.info(
            "[ROUTE] LLM result: state=%s | tool=%s",
            ai_result.get("recommended_state"),
            ai_result.get("recommended_tool"),
        )
    else:
        # Short-circuit — no LLM call needed
        ai_result = None
        logger.info("[ROUTE] LLM skipped — planner action=%s", planner_decision.action)

    # ── 5. Run agent ───────────────────────────────────────────────────────────
    agent_result = CyberDeskAgent.run(
        ai_result=ai_result,
        request=request,
        conversation=conversation,
        current_user=current_user,
        db=db,
    )

    logger.info(
        "[ROUTE] agent_result status=%s | conv=%s | new_state=%s",
        agent_result.get("status"),
        conversation.id,
        getattr(conversation, "workflow_state", "?"),
    )

    # ── 6. Save AI response message ────────────────────────────────────────────
    db.add(AssistantMessage(
        conversation_id=conversation.id,
        sender="assistant",
        message=agent_result.get("response", "")
    ))
    db.commit()

    # ── 7. On completion: generate training recommendations ───────────────────
    if agent_result.get("status") == "completed":
        try:
            history_rows = (
                db.query(AssistantMessage)
                .filter(AssistantMessage.conversation_id == conversation.id)
                .order_by(AssistantMessage.created_at)
                .all()
            )
            conversation_text = "\n".join(f"{m.sender}: {m.message}" for m in history_rows)
            recommendations = recommend_training(conversation_text)

            # Deactivate old recommendations
            db.query(TrainingRecommendation).filter(
                TrainingRecommendation.user_id == current_user.id,
                TrainingRecommendation.is_active == True
            ).update({TrainingRecommendation.is_active: False})
            db.commit()

            for topic in recommendations.get("topics", []):
                db.add(TrainingRecommendation(
                    user_id=current_user.id,
                    topic=topic,
                    is_active=True
                ))
            db.commit()
            logger.info("[ROUTE] training recommendations saved for user=%s", current_user.email)
        except Exception as e:
            logger.warning("[ROUTE] training recommendation failed: %s", e)

    return {
        "conversation_id": conversation.id,
        **agent_result
    }