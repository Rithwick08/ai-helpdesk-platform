from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.user import User
from models.incident import Incident
from models.it_ticket import ITTicket
from models.password_reset import PasswordReset
from models.training_video import TrainingVideo
from models.security_update import SecurityUpdate
from database import get_db
from sqlalchemy import func

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)
@router.get("/summary")
def dashboard_summary(
    db: Session = Depends(get_db)
):
    total_users = db.query(User).count()

    employees = db.query(User).filter(
        User.role == "employee"
    ).count()

    admins = db.query(User).filter(
        User.role == "admin"
    ).count()

    it_staff = db.query(User).filter(
        User.role == "it_support"
    ).count()

    soc_staff = db.query(User).filter(
        User.role == "soc"
    ).count()

    open_incidents = db.query(Incident).filter(
        Incident.status == "Open"
    ).count()

    resolved_incidents = db.query(Incident).filter(
        Incident.status == "Resolved"
    ).count()

    open_tickets = db.query(ITTicket).filter(
        ITTicket.status != "Closed"
    ).count()

    resolved_tickets = db.query(ITTicket).filter(
        ITTicket.status == "Closed"
    ).count()

    password_requests = db.query(
        PasswordReset
    ).count()

    training_videos = db.query(
        TrainingVideo
    ).count()

    security_updates = db.query(
        SecurityUpdate
    ).count()

    return {
        "total_users": total_users,
        "employees": employees,
        "admins": admins,
        "it_staff": it_staff,
        "soc_staff": soc_staff,

        "open_incidents": open_incidents,
        "resolved_incidents": resolved_incidents,

        "open_tickets": open_tickets,
        "resolved_tickets": resolved_tickets,

        "password_requests": password_requests,

        "training_videos": training_videos,

        "security_updates": security_updates
    }
@router.get("/activity")
def dashboard_activity(
    db: Session = Depends(get_db)
):

    activities = []

    # Recent Security Incidents
    incidents = (
        db.query(Incident)
        .order_by(Incident.created_at.desc())
        .limit(5)
        .all()
    )

    for incident in incidents:
        activities.append({
            "type": "incident",
            "icon": "shield",
            "title": incident.title,
            "description": f"{incident.severity} • {incident.status}",
            "created_at": incident.created_at
        })

    # Recent IT Tickets
    tickets = (
        db.query(ITTicket)
        .order_by(ITTicket.created_at.desc())
        .limit(5)
        .all()
    )

    for ticket in tickets:
        activities.append({
            "type": "ticket",
            "icon": "wrench",
            "title": ticket.title,
            "description": f"{ticket.priority} • {ticket.status}",
            "created_at": ticket.created_at
        })

    # Recent Password Reset Requests
    resets = (
        db.query(PasswordReset)
        .order_by(PasswordReset.created_at.desc())
        .limit(5)
        .all()
    )

    for reset in resets:
        activities.append({
            "type": "password_reset",
            "icon": "key",
            "title": "Password Reset Request",
            "description": reset.account_type,
            "created_at": reset.created_at
        })

    # Recent Security Updates
    updates = (
        db.query(SecurityUpdate)
        .order_by(SecurityUpdate.created_at.desc())
        .limit(5)
        .all()
    )

    for update in updates:
        activities.append({
            "type": "security_update",
            "icon": "bell",
            "title": update.title,
            "description": update.priority,
            "created_at": update.created_at
        })

    # Sort newest first
    activities.sort(
        key=lambda x: x["created_at"],
        reverse=True
    )

    return activities[:10]
@router.get("/charts")
def dashboard_charts(
    db: Session = Depends(get_db)
):

    incident_severity = (
        db.query(
            Incident.severity,
            func.count(Incident.id)
        )
        .group_by(Incident.severity)
        .all()
    )

    ticket_categories = (
        db.query(
            ITTicket.category,
            func.count(ITTicket.id)
        )
        .group_by(ITTicket.category)
        .all()
    )

    user_roles = (
        db.query(
            User.role,
            func.count(User.id)
        )
        .group_by(User.role)
        .all()
    )

    return {
        "incident_severity": [
            {
                "name": severity,
                "value": count
            }
            for severity, count in incident_severity
        ],

        "ticket_categories": [
            {
                "name": category,
                "value": count
            }
            for category, count in ticket_categories
        ],

        "user_roles": [
            {
                "name": role,
                "value": count
            }
            for role, count in user_roles
        ]
    }