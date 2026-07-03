from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.training_progress import TrainingProgress
from schemas.training_progress import TrainingProgressUpdate

router = APIRouter(
    prefix="/training-progress",
    tags=["Training Progress"]
)
@router.post("/")
def update_progress(
    data: TrainingProgressUpdate,
    db: Session = Depends(get_db)
):
    progress = (
        db.query(TrainingProgress)
        .filter(
            TrainingProgress.user_id == 1,
            TrainingProgress.video_id == data.video_id
        )
        .first()
    )

    if not progress:

        progress = TrainingProgress(
            user_id=1,
            video_id=data.video_id,
            progress_percentage=data.progress_percentage,
            completed=data.progress_percentage >= 100
        )

        db.add(progress)

    else:

        progress.progress_percentage = data.progress_percentage
        progress.completed = data.progress_percentage >= 100

    db.commit()

    return {
        "message": "Progress updated"
    }
@router.get("/")
def get_my_progress(
    db: Session = Depends(get_db)
):
    return (
        db.query(TrainingProgress)
        .filter(
            TrainingProgress.user_id == 1
        )
        .all()
    )