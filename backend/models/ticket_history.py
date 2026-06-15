from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime

class TicketHistory(Base):
    __tablename__ = "ticket_history"

    id = Column(Integer, primary_key=True, index=True)

    ticket_id = Column(Integer)

    action = Column(String)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )