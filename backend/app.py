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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alert_router)
app.include_router(user_router)
app.include_router(incident_router)
app.include_router(password_reset_router)
app.include_router(it_ticket_router)
app.include_router(auth_router)
app.include_router(assistant_router)

@app.get("/")
def home():
    return {"message": "Backend Working"}