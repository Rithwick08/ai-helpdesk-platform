from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)

    alert_name = Column(String)
    alert_data = Column(String)

    threat_type = Column(String)
    severity = Column(String)
    recommended_action = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)