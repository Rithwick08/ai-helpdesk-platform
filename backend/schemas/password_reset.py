from pydantic import BaseModel

class PasswordResetCreate(BaseModel):
    employee_id: str
    reason: str
class OTPVerify(BaseModel):
    request_id: int
    otp: str