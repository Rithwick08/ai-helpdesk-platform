from pydantic import BaseModel

class UserCreate(BaseModel):
    employee_id: str
    name: str
    email: str
    department: str
    role: str