from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Boolean
)
from datetime import datetime

from database import Base


class TrainingRecommendation(Base):

    __tablename__ = "training_recommendations"

    id = Column(Integer, primary_key=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id")
    )

    topic = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )