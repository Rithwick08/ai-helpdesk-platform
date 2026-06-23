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

    # Create new conversation if needed
    if request.conversation_id is None:

        conversation = AssistantConversation(
            user_id=current_user.id
        )

        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Continue existing conversation
    else:

        conversation = db.query(
            AssistantConversation
        ).filter(
            AssistantConversation.id == request.conversation_id
        ).first()

        if conversation is None:
            return {
                "error": "Conversation not found"
            }

    # Save user's message
    user_message = AssistantMessage(
        conversation_id=conversation.id,
        sender="user",
        message=request.message
    )

    db.add(user_message)
    db.commit()
    # Load conversation history
    history = (
        db.query(AssistantMessage)
        .filter(
            AssistantMessage.conversation_id == conversation.id
        )
        .order_by(AssistantMessage.created_at)
        .all()
    )

    conversation_history = []

    for msg in history:

        role = "assistant"

        if msg.sender == "user":
            role = "user"

        conversation_history.append(
            {
                "role": role,
                "content": msg.message
            }
        )

    # Get AI response
    ai_result = chat_with_ai(conversation_history)
    print(ai_result)
    agent_result = CyberDeskAgent.run(
    ai_result=ai_result,
    request=request,
    conversation=conversation,
    current_user=current_user,
    db=db
    )

    # Save AI response
    assistant_message = AssistantMessage(
    conversation_id=conversation.id,
    sender="assistant",
    message=agent_result["response"]
    )

    db.add(assistant_message)
    db.commit()
    if agent_result["status"] == "completed":

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

        recommendations = recommend_training(
            conversation_text
        )
        db.query(TrainingRecommendation).filter(
            TrainingRecommendation.user_id == current_user.id,
            TrainingRecommendation.is_active == True
        ).update(
            {
                TrainingRecommendation.is_active: False
            }
        )

        db.commit()
        for topic in recommendations["topics"]:

            db.add(
                TrainingRecommendation(
                    user_id=current_user.id,
                    topic=topic,
                    is_active=True
                )
            )

        db.commit()
    return {
        "conversation_id": conversation.id,
        **agent_result
    }