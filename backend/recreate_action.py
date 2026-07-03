from database import engine

from models.user import User
from models.training_video import TrainingVideo
from models.training_progress import TrainingProgress

TrainingProgress.__table__.create(
    engine,
    checkfirst=True
)

print("training_progress table created")