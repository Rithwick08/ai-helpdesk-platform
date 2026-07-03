from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from database import Base
from datetime import datetime


class AssistantConversation(Base):
    __tablename__ = "assistant_conversations"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id")
    )

    status = Column(
        String,
        default="Active"
    )

    summary = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    pending_action = Column(
        String,
        nullable=True
    )
    troubleshooting_attempts = Column(Integer, default=0)

    original_problem = Column(String, nullable=True)

    # State-machine workflow state
    workflow_state = Column(
        String,
        default="IDLE",
        nullable=False,
        server_default="IDLE"
    )

    # The pending tool name (e.g. "it_support") held until confirmation
    pending_tool = Column(String, nullable=True)

    # Structured entities collected during COLLECTING_INFORMATION phase
    collected_entities = Column(String, nullable=True)  # JSON-encoded
