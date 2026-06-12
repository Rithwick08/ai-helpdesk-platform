from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime

class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True)

    alert_id = Column(Integer)
    incident_id = Column(Integer)

    action_name = Column(String)
    action_status = Column(String)
    action_output = Column(String)
    executed_at = Column(DateTime, default=datetime.utcnow)