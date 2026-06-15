from database import engine
from models.it_ticket import ITTicket

ITTicket.__table__.drop(engine, checkfirst=True)
ITTicket.__table__.create(engine)

print("IT tickets table recreated")