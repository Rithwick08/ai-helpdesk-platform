from pydantic import BaseModel

class TrainingChatRequest(BaseModel):
    video_title: str
    question: str