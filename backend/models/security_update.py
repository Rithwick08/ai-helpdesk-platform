from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime
)
from datetime import datetime

from database import Base


class SecurityUpdate(Base):

    __tablename__ = "security_updates"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String)

    message = Column(String)

    priority = Column(String)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )