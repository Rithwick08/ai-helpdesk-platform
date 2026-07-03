from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.user import UserCreate

router = APIRouter()

@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@router.post("/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):

    new_user = User(
        employee_id=user.employee_id,
        name=user.name,
        email=user.email,
        department=user.department,
        role=user.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User Created",
        "id": new_user.id
    }
from auth.dependencies import get_current_user
from models.incident import Incident
from models.it_ticket import ITTicket
from models.password_reset import PasswordReset
from models.training_video import TrainingVideo

@router.get("/my-activity")
def get_my_activity(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Incidents (mocking user association since model doesn't have it)
    incidents_reported = db.query(Incident).count()
    tickets_created = db.query(ITTicket).filter(ITTicket.created_by == current_user.id).count()
    password_resets = db.query(PasswordReset).filter(PasswordReset.employee_id == current_user.employee_id).count()
    training_recommendations = db.query(TrainingVideo).count()

    recent_activity = []

    incidents = db.query(Incident).order_by(Incident.created_at.desc()).limit(5).all()
    for inc in incidents:
        recent_activity.append({
            "type": "incident",
            "title": f"Reported Incident: {inc.title}",
            "date": inc.created_at.isoformat()
        })
        
    tickets = db.query(ITTicket).filter(ITTicket.created_by == current_user.id).order_by(ITTicket.created_at.desc()).limit(5).all()
    for tkt in tickets:
        recent_activity.append({
            "type": "ticket",
            "title": f"Created Ticket: {tkt.title}",
            "date": tkt.created_at.isoformat()
        })
        
    resets = db.query(PasswordReset).filter(PasswordReset.employee_id == current_user.employee_id).order_by(PasswordReset.created_at.desc()).limit(5).all()
    for rst in resets:
        recent_activity.append({
            "type": "reset",
            "title": f"Password Reset: {rst.account_type}",
            "date": rst.created_at.isoformat()
        })

    recent_activity.sort(key=lambda x: x["date"], reverse=True)
    recent_activity = recent_activity[:10]

    return {
        "incidents_reported": incidents_reported,
        "tickets_created": tickets_created,
        "password_resets": password_resets,
        "training_recommendations": training_recommendations,
        "recent_activity": recent_activity
    }
