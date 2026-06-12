from pydantic import BaseModel

class ActionCreate(BaseModel):
    action_name: str