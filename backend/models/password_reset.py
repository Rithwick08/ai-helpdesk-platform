from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime

class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(String)
    reason = Column(String)
    otp = Column(String)
    identity_verified = Column(String, default="No")
    priority = Column(String)
    action_taken = Column(String)

    status = Column(String, default="Pending")

    created_at = Column(DateTime, default=datetime.utcnow)
    account_type = Column(String)