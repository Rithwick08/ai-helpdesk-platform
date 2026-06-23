from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    employee_id: str
    name: str
    email: EmailStr
    password: str
    department: str
    role: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    employee_id: str
    name: str
    email: EmailStr
    department: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True