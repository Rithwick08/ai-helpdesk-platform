from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth.dependencies import require_roles

from models.training_video import TrainingVideo
from schemas.training_video import (
    TrainingVideoCreate,
    TrainingVideoUpdate
)

router = APIRouter(
    tags=["Training Videos"],
    dependencies=[
        Depends(require_roles(["admin"]))
    ]
)


@router.get("/training-videos")
def get_training_videos(
    db: Session = Depends(get_db)
):
    return db.query(TrainingVideo).all()


@router.post("/training-videos")
def create_training_video(
    video: TrainingVideoCreate,
    db: Session = Depends(get_db)
):

    new_video = TrainingVideo(
        title=video.title,
        topic=video.topic,
        youtube_url=video.youtube_url,
        description=video.description
    )

    db.add(new_video)
    db.commit()
    db.refresh(new_video)

    return new_video


@router.put("/training-videos/{video_id}")
def update_training_video(
    video_id: int,
    video: TrainingVideoUpdate,
    db: Session = Depends(get_db)
):

    training_video = db.query(
        TrainingVideo
    ).filter(
        TrainingVideo.id == video_id
    ).first()

    if not training_video:
        return {
            "message": "Video not found"
        }

    training_video.title = video.title
    training_video.topic = video.topic
    training_video.youtube_url = video.youtube_url
    training_video.description = video.description
    training_video.is_active = video.is_active

    db.commit()
    db.refresh(training_video)

    return training_video


@router.delete("/training-videos/{video_id}")
def delete_training_video(
    video_id: int,
    db: Session = Depends(get_db)
):

    training_video = db.query(
        TrainingVideo
    ).filter(
        TrainingVideo.id == video_id
    ).first()

    if not training_video:
        return {
            "message": "Video not found"
        }

    db.delete(training_video)
    db.commit()

    return {
        "message": "Training video deleted"
    }