from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from database import Base


class TrainingProgress(Base):
    __tablename__ = "training_progress"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    video_id = Column(
        Integer,
        ForeignKey("training_videos.id"),
        nullable=False
    )

    progress_percentage = Column(
        Integer,
        default=0
    )

    completed = Column(
        Boolean,
        default=False
    )

    last_watched = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )