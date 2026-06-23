from pydantic import BaseModel

class ITTicketCreate(BaseModel):
    title: str
    description: str
class TicketFeedback(BaseModel):

    resolved: bool
class ITTicketCreate(BaseModel):
    title: str
    description: str