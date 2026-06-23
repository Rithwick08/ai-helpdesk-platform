from pydantic import BaseModel

class ChatRequest(BaseModel):
    conversation_id: int | None = None
    message: str

    confirm_action: bool | None = None


class ChatResponse(BaseModel):
    conversation_id: int
    ai_response: str
    status: str