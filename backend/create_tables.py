from database import engine, Base
from models.user import User
from models.incident import Incident
from models.alert import Alert
from models.action import Action
from models.password_reset import PasswordReset
from models.it_ticket import ITTicket
from models.ticket_history import TicketHistory

Base.metadata.create_all(bind=engine)

print("Tables Created Successfully!")