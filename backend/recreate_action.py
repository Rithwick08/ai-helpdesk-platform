from database import engine
from models.action import Action

Action.__table__.drop(engine, checkfirst=True)
Action.__table__.create(engine)

print("Actions table recreated")