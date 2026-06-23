from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.incident import Incident
from schemas.incident import IncidentCreate, IncidentStatusUpdate
from services.ai_service import classify_incident
from auth.dependencies import require_roles
from models.user import User

from fastapi import APIRouter, Depends


router = APIRouter(
    tags=["SOC Alerts"],
    dependencies=[
        Depends(require_roles(["admin", "soc_analyst"]))
    ]
)
@router.get("/incidents")
def get_incidents(
    current_user: User = Depends(
        require_roles(["admin", "soc_analyst"])
    ),
    db: Session = Depends(get_db)
):
    return db.query(Incident).all()

@router.post("/incidents")
@router.get("/incidents")
def get_incidents(
    current_user: User = Depends(
        require_roles(["admin", "soc_analyst"])
    ),
    db: Session = Depends(get_db)
):
    analysis = classify_incident(
        incident.description
    )

    new_incident = Incident(
        title=incident.title,
        description=incident.description,
        category=analysis["category"],
        severity=analysis["severity"],
        confidence_score=analysis["confidence"]
    )

    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)

    return {
        "message": "Incident Created",
        "id": new_incident.id
    }
@router.get("/incidents/{incident_id}")
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    incident = db.query(Incident).filter(
        Incident.id == incident_id
    ).first()

    if not incident:
        return {"message": "Incident not found"}

    return incident
@router.put("/incidents/{incident_id}")
def update_incident_status(
    incident_id: int,
    status_update: IncidentStatusUpdate,
    db: Session = Depends(get_db)
):
    incident = db.query(Incident).filter(
        Incident.id == incident_id
    ).first()

    if not incident:
        return {"message": "Incident not found"}

    incident.status = status_update.status

    db.commit()
    db.refresh(incident)

    return {
        "message": "Status Updated",
        "status": incident.status
    }
@router.delete("/incidents/{incident_id}")
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    incident = db.query(Incident).filter(
        Incident.id == incident_id
    ).first()

    if not incident:
        return {"message": "Incident not found"}

    db.delete(incident)
    db.commit()

    return {"message": "Incident deleted"}