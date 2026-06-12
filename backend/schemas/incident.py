from pydantic import BaseModel
from typing import Literal

class IncidentCreate(BaseModel):
    title: str
    description: str
class IncidentStatusUpdate(BaseModel):
    status: Literal["Open", "In Progress", "Resolved", "Closed"]