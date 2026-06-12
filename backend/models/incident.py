from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
from datetime import datetime

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)

    category = Column(String)
    severity = Column(String)
    confidence_score = Column(Float)

    status = Column(String, default="Open")

    created_at = Column(DateTime, default=datetime.utcnow)