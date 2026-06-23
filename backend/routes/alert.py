from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.alert import Alert
from models.incident import Incident
from models.action import Action
from schemas.alert import AlertCreate
from services.ai_service import analyze_alert
from auth.dependencies import require_roles
from models.user import User

from fastapi import APIRouter, Depends

from auth.dependencies import require_roles

router = APIRouter(
    tags=["SOC Alerts"],
    dependencies=[
        Depends(require_roles(["admin", "soc_analyst"]))
    ]
)

@router.get("/alerts")
def get_alerts(
    db: Session = Depends(get_db)
):
    ...
    return db.query(Alert).all()

@router.post("/alerts")
def create_alert(
    alert: AlertCreate,
    db: Session = Depends(get_db)
):
    ...
    analysis = analyze_alert(
        alert.alert_data
    )

    new_alert = Alert(
        alert_name=alert.alert_name,
        alert_data=alert.alert_data,
        threat_type=analysis["threat_type"],
        severity=analysis["severity"],
        recommended_action=analysis["recommended_action"]
    )

    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)

    if analysis["severity"] in ["High", "Critical"]:

        new_incident = Incident(
            title=f"Auto Generated: {alert.alert_name}",
            description=alert.alert_data,
            category=analysis["threat_type"],
            severity=analysis["severity"],
            confidence_score=10,
            status="Open"
        )

        db.add(new_incident)
        db.commit()
        db.refresh(new_incident)

        actions = [
            "Create Incident",
            "Notify SOC Team",
            "Generate Report"
        ]

        output_map = {
            "Create Incident":
                f"Incident #{new_incident.id} created",

            "Notify SOC Team":
                "SOC notification generated",

            "Generate Report":
                f"Threat report generated for {analysis['threat_type']}"
        }

        for action in actions:

            new_action = Action(
                alert_id=new_alert.id,
                incident_id=new_incident.id,
                action_name=action,
                action_status="Completed",
                action_output=output_map[action]
            )

            db.add(new_action)

        db.commit()

    return {
        "message": "Alert Created",
        "id": new_alert.id,
        "severity": analysis["severity"]
    }


@router.post("/alerts")
def create_alert(
    alert: AlertCreate,
    db: Session = Depends(get_db)
):
    ...
    return db.query(Action).all()
@router.get("/actions/{incident_id}")
def get_actions_by_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    return db.query(Action).filter(
        Action.incident_id == incident_id
    ).all()