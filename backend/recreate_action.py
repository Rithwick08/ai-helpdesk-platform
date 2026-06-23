from database import engine

from models.security_update import SecurityUpdate

SecurityUpdate.__table__.create(
    engine,
    checkfirst=True
)

print("Security Updates table created!")