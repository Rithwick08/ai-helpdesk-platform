from pydantic import BaseModel


class TrainingProgressUpdate(BaseModel):
    video_id: int
    progress_percentage: int


class TrainingProgressResponse(BaseModel):
    id: int
    user_id: int
    video_id: int
    progress_percentage: int
    completed: bool

    class Config:
        from_attributes = True