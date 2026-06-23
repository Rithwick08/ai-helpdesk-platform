from database import engine

from models.user import User
from models.training_recommendation import TrainingRecommendation

TrainingRecommendation.__table__.create(
    engine,
    checkfirst=True
)

print("TrainingRecommendation table created.")