from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime
)
from datetime import datetime
from database import Base


class TrainingVideo(Base):

    __tablename__ = "training_videos"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String)

    topic = Column(String)

    youtube_url = Column(String)

    description = Column(String)

    is_active = Column(Boolean, default=True)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )