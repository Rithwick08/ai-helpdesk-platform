from pydantic import BaseModel

class AlertCreate(BaseModel):
    alert_name: str
    alert_data: str