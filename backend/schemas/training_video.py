from pydantic import BaseModel


class TrainingVideoCreate(BaseModel):

    title: str

    topic: str

    youtube_url: str

    description: str


class TrainingVideoUpdate(BaseModel):

    title: str

    topic: str

    youtube_url: str

    description: str

    is_active: bool