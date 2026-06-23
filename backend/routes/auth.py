from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.user import UserCreate, UserLogin
from auth.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    new_user = User(

        employee_id=user.employee_id,
        name=user.name,
        email=user.email,

        hashed_password=hash_password(
            user.password
        ),

        department=user.department,

        role=user.role

    )

    db.add(new_user)

    db.commit()

    db.refresh(new_user)

    return {

        "message": "User Registered",

        "user_id": new_user.id

    }

@router.post("/login")
def login(
    credentials: UserLogin,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.email == credentials.email
    ).first()

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        credentials.password,
        user.hashed_password
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(

        {
            "sub": user.email,
            "role": user.role,
            "id": user.id
        }

    )

    return {

        "access_token": token,

        "token_type": "bearer",

        "user": {

            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role

        }

    }

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "employee_id": current_user.employee_id,
        "name": current_user.name,
        "email": current_user.email,
        "department": current_user.department,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at
    }