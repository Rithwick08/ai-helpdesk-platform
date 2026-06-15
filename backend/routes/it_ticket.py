from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import json
from models.ticket_history import TicketHistory
from database import get_db
from models.it_ticket import ITTicket
from schemas.it_ticket import (
    ITTicketCreate,
    TicketFeedback
)
from services.ai_service import diagnose_it_issue

router = APIRouter()

@router.get("/it-tickets")
def get_it_tickets(
    db: Session = Depends(get_db)
):
    return db.query(ITTicket).all()

@router.post("/it-tickets")
def create_it_ticket(
    ticket: ITTicketCreate,
    db: Session = Depends(get_db)
):
    analysis = diagnose_it_issue(
        ticket.description
    )

    resolution_steps = str(
        analysis["resolution_steps"]
    )
    new_ticket = ITTicket(

        title=ticket.title,

        description=ticket.description,

        category=analysis["category"],

        priority=analysis["priority"],

        diagnosis=analysis["diagnosis"],
        recommended_fix=analysis["recommended_fix"],

        resolution_steps=resolution_steps,

        status="In Progress"

    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    history = TicketHistory(
    ticket_id=new_ticket.id,
    action="Ticket Created"
)

    db.add(history)
    db.commit()

    return {
        "message": "IT Ticket Created",
        "id": new_ticket.id,
        "category": new_ticket.category,
        "priority": new_ticket.priority,
        "diagnosis": new_ticket.diagnosis,
        "recommended_fix": new_ticket.recommended_fix,
        "resolution_steps": new_ticket.resolution_steps
    }
@router.put("/it-tickets/{ticket_id}/resolve")
def resolve_ticket(
    ticket_id: int,
    db: Session = Depends(get_db)
):
    ticket = db.query(ITTicket).filter(
        ITTicket.id == ticket_id
    ).first()

    if not ticket:
        return {
            "message": "Ticket not found"
        }

    ticket.status = "Resolved"

    db.commit()
    db.refresh(ticket)

    return {
        "message": "Ticket resolved",
        "ticket_id": ticket.id,
        "status": ticket.status
    }
@router.put("/it-tickets/{ticket_id}/escalate")
def escalate_ticket(
    ticket_id: int,
    db: Session = Depends(get_db)
):
    ticket = db.query(ITTicket).filter(
        ITTicket.id == ticket_id
    ).first()

    if not ticket:
        return {
            "message": "Ticket not found"
        }

    ticket.status = "Escalated"

    db.commit()
    db.refresh(ticket)

    return {
        "message": "Ticket escalated",
        "ticket_id": ticket.id,
        "status": ticket.status
    }
@router.put("/it-tickets/{ticket_id}/feedback")
def ticket_feedback(
    ticket_id: int,
    feedback: TicketFeedback,
    db: Session = Depends(get_db)
):
    ticket = db.query(ITTicket).filter(
        ITTicket.id == ticket_id
    ).first()

    if not ticket:
        return {
            "message": "Ticket not found"
        }

    if ticket.status == "Closed":
        return {
            "message": "Closed tickets cannot be modified"
        }

    if feedback.resolved:
        ticket.status = "Resolved"
        history = TicketHistory(
        ticket_id=ticket.id,
        action="User Marked Issue Resolved"
    )
        db.add(history)
    else:
        ticket.status = "Escalated"
        history = TicketHistory(
        ticket_id=ticket.id,
        action="User Reported Issue Not Fixed"
    )

        db.add(history)
    db.commit()
    db.refresh(ticket)

    return {
        "ticket_id": ticket.id,
        "status": ticket.status
    }
@router.put("/it-tickets/{ticket_id}/close")
def close_ticket(
    ticket_id: int,
    db: Session = Depends(get_db)
):
    ticket = db.query(ITTicket).filter(
        ITTicket.id == ticket_id
    ).first()

    if not ticket:
        return {
            "message": "Ticket not found"
        }

    if ticket.status != "Resolved":
        return {
            "message": "Only resolved tickets can be closed"
        }

    ticket.status = "Closed"
    history = TicketHistory(
    ticket_id=ticket.id,
    action="Ticket Closed"
    )

    db.add(history)
    db.commit()
    db.refresh(ticket)

    return {
        "message": "Ticket closed",
        "ticket_id": ticket.id,
        "status": ticket.status
    }
@router.get("/ticket-history/{ticket_id}")
def get_ticket_history(
    ticket_id: int,
    db: Session = Depends(get_db)
):
    return db.query(
        TicketHistory
    ).filter(
        TicketHistory.ticket_id == ticket_id
    ).all()