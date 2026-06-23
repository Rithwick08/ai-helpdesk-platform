from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.security_update import SecurityUpdate
from schemas.security_update import SecurityUpdateCreate

from auth.dependencies import require_roles

router = APIRouter(
    tags=["Security Updates"]
)
@router.post(
    "/security-updates",
    dependencies=[
        Depends(require_roles(["admin"]))
    ]
)
def create_update(
    update: SecurityUpdateCreate,
    db: Session = Depends(get_db)
):

    new_update = SecurityUpdate(
        title=update.title,
        message=update.message,
        priority=update.priority
    )

    db.add(new_update)
    db.commit()
    db.refresh(new_update)

    return new_update
@router.get("/security-updates")
def get_updates(
    db: Session = Depends(get_db)
):

    return (
        db.query(SecurityUpdate)
        .order_by(SecurityUpdate.created_at.desc())
        .all()
    )
@router.delete(
    "/security-updates/{update_id}",
    dependencies=[
        Depends(require_roles(["admin"]))
    ]
)
def delete_update(
    update_id: int,
    db: Session = Depends(get_db)
):

    update = (
        db.query(SecurityUpdate)
        .filter(SecurityUpdate.id == update_id)
        .first()
    )

    if not update:
        return {
            "message": "Not found"
        }

    db.delete(update)
    db.commit()

    return {
        "message": "Deleted"
    }