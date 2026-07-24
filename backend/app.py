import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.user import router as user_router
from routes.incident import router as incident_router
from routes.alert import router as alert_router
from routes.password_reset import router as password_reset_router
from routes.it_ticket import router as it_ticket_router
from models.ticket_history import TicketHistory
from routes.auth import router as auth_router
from routes.assistant import router as assistant_router
from routes.training import router as training_router
from routes.training_video import (
    router as training_video_router
)
from routes.security_update import (
    router as security_update_router
)
from routes.dashboard import router as dashboard_router
from routes import training_progress
from voice.stt.routes import router as voice_stt_router
from voice.tts.routes import router as voice_tts_router
from voice.pipeline.routes import router as voice_pipeline_router
from voice.telephony.routes import router as telephony_router
from voice.telephony.websocket import router as telephony_ws_router


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:8001", "http://localhost:8002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Transcript",
        "X-Response-Text",
        "X-Conversation-Id",
        "X-Agent-Status",
        "X-Session-Id",
        "X-Turn-Number",
        "Content-Disposition",
    ],
)

app.include_router(alert_router)
app.include_router(user_router)
app.include_router(incident_router)
app.include_router(password_reset_router)
app.include_router(it_ticket_router)
app.include_router(auth_router)
app.include_router(assistant_router)
app.include_router(training_router)
app.include_router(training_video_router)
app.include_router(
    security_update_router
)
app.include_router(dashboard_router)

app.include_router(
    training_progress.router
)
app.include_router(voice_stt_router)
app.include_router(voice_tts_router)
app.include_router(voice_pipeline_router)
app.include_router(telephony_router)
app.include_router(telephony_ws_router)

@app.get("/")
def home():
    return {"message": "Backend Working"}