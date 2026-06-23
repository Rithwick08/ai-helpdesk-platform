from fastapi import APIRouter
from schemas.training_chat import TrainingChatRequest
from services.ai_service import answer_training_question
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth.dependencies import get_current_user

from models.user import User
from models.training_recommendation import TrainingRecommendation
from models.training_video import TrainingVideo

router = APIRouter(
    tags=["Training"]
)
router = APIRouter(tags=["Training"])

@router.post("/training/chat")
def training_chat(request: TrainingChatRequest):

    return answer_training_question(
        request.video_title,
        request.question
    )
@router.get("/training/recommendations")
def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    recommendations = (
        db.query(TrainingRecommendation)
        .filter(
            TrainingRecommendation.user_id == current_user.id,
            TrainingRecommendation.is_active == True
        )
        .all()
    )

    videos = []

    for recommendation in recommendations:

        matched = (
            db.query(TrainingVideo)
            .filter(
                TrainingVideo.topic == recommendation.topic,
                TrainingVideo.is_active == True
            )
            .all()
        )

        videos.extend(matched)

    return videos