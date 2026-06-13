# recreate_password_resets.py

from database import engine
from models.password_reset import PasswordReset

PasswordReset.__table__.drop(engine, checkfirst=True)
PasswordReset.__table__.create(engine)

print("Password resets table recreated")