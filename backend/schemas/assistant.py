from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class ChatRequest(BaseModel):
    conversation_id: Optional[int] = None
    message: str
    confirm_action: Optional[bool] = None
    # Populated server-side before passing to tools — not sent by the client
    conversation_history: List[Dict[str, Any]] = []


class ChatResponse(BaseModel):
    conversation_id: int
    ai_response: str
    status: str