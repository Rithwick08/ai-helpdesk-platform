from pydantic import BaseModel


class SecurityUpdateCreate(BaseModel):

    title: str

    message: str

    priority: str