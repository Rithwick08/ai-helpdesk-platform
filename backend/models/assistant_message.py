from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from database import Base
from datetime import datetime


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id = Column(Integer, primary_key=True, index=True)

    conversation_id = Column(
        Integer,
        ForeignKey("assistant_conversations.id")
    )

    sender = Column(String)
    message = Column(String)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )