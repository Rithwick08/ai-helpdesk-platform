from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime
from sqlalchemy import ForeignKey

class ITTicket(Base):
    __tablename__ = "it_tickets"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String)
    description = Column(String)

    category = Column(String)
    priority = Column(String)
    diagnosis = Column(String)
    recommended_fix = Column(String)
    resolution_steps = Column(String)
    status = Column(String, default="Open")
    created_by = Column(
    Integer,
    ForeignKey("users.id")
    )

    assigned_to = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    created_at = Column(DateTime, default=datetime.utcnow)