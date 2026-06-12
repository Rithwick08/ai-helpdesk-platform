from database import engine, Base
from models.user import User
from models.incident import Incident
from models.alert import Alert
from models.action import Action

Base.metadata.create_all(bind=engine)

print("Tables Created Successfully!")