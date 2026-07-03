import random
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.password_reset import PasswordReset
from schemas.password_reset import (
    PasswordResetCreate,
    OTPVerify
)
from services.ai_service import analyze_password_reset
from auth.dependencies import require_roles, get_current_user
from models.user import User
from schemas.password_reset import PasswordResetStatusUpdate

router = APIRouter()


@router.get("/password-resets")
def get_password_resets(
    current_user: User = Depends(require_roles(["admin", "it", "soc"])),
    db: Session = Depends(get_db)
):
    return db.query(PasswordReset).all()


@router.post("/password-resets")

def create_password_reset(

    request: PasswordResetCreate,

    db: Session = Depends(get_db)

):

    otp = str(random.randint(100000, 999999))

    new_request = PasswordReset(

        employee_id=request.employee_id,

        reason=request.reason,

        otp=otp,

        identity_verified="No",

        status="Pending Verification"

    )

    db.add(new_request)

    db.commit()

    db.refresh(new_request)

    return {

        "message": "OTP Generated",

        "request_id": new_request.id,

        "otp": otp

    }
@router.post("/password-resets/verify")
def verify_otp(
    verify: OTPVerify,
    db: Session = Depends(get_db)
):
    request = db.query(PasswordReset).filter(
        PasswordReset.id == verify.request_id
    ).first()

    if not request:
        return {"message": "Request not found"}

    if request.otp != verify.otp:
        return {"message": "Invalid OTP"}

    request.identity_verified = "Yes"

    analysis = analyze_password_reset(
        request.reason
    )

    request.priority = analysis["priority"]
    request.action_taken = analysis["action"]
    request.status = "Pending Approval"

    db.commit()
    db.refresh(request)

    return {
        "message": "Identity Verified",
        "priority": request.priority,
        "action_taken": request.action_taken,
        "status": request.status
    }
@router.put("/password-resets/{request_id}/approve")
def approve_password_reset(
    request_id: int,
    current_user: User = Depends(require_roles(["admin", "it", "soc"])),
    db: Session = Depends(get_db)
):
    request = db.query(PasswordReset).filter(
        PasswordReset.id == request_id
    ).first()

    if not request:
        return {"message": "Request not found"}

    if request.identity_verified != "Yes":
        return {
            "message": "Identity verification required"
        }

    if request.status == "Completed":
        return {
            "message": "Request already approved"
        }

    request.status = "Completed"

    request.action_taken = "Password Reset Executed"

    db.commit()
    db.refresh(request)

    return {
        "message": "Password reset approved",
        "request_id": request.id,
        "status": request.status,
        "action_taken": request.action_taken
    }

@router.put("/password-resets/{request_id}")
def update_password_reset(
    request_id: int,
    update_data: dict,
    current_user: User = Depends(require_roles(["admin", "it"])),
    db: Session = Depends(get_db)
):
    request = db.query(PasswordReset).filter(PasswordReset.id == request_id).first()
    if not request:
        return {"message": "Request not found"}
    
    if "status" in update_data:
        request.status = update_data["status"]
    
    db.commit()
    db.refresh(request)
    return {"message": "Status updated", "status": request.status}

@router.delete("/password-resets/{request_id}")
def delete_password_reset(
    request_id: int,
    current_user: User = Depends(require_roles(["admin", "it"])),
    db: Session = Depends(get_db)
):
    request = db.query(PasswordReset).filter(PasswordReset.id == request_id).first()
    if not request:
        return {"message": "Request not found"}
    
    db.delete(request)
    db.commit()
    return {"message": "Request deleted"}