import sys
import os
sys.path.append(os.path.abspath("."))

from database import SessionLocal
from models.user import User
from models.assistant_conversation import AssistantConversation
from models.assistant_message import AssistantMessage
from tools.it_support_tool import ITSupportTool
from agent.workflow_memory import WorkflowMemory
from schemas.assistant import ChatRequest

db = SessionLocal()
# Grab any user
user = db.query(User).first()
if not user:
    print("No user found")
    sys.exit(0)

# Create mock conversation
conv = AssistantConversation(
    user_id=user.id,
    original_problem="VPN not connecting",
    pending_action="it_support",
    troubleshooting_attempts=0
)
db.add(conv)
db.commit()

memory = WorkflowMemory()
memory.set_it_category("vpn")
memory.set_current_step("vpn_restart")
memory.set("problem", "VPN not connecting")

tool = ITSupportTool()

request = ChatRequest(message="create a ticket")
print("Testing Escalate Check...")
res = tool._continue_workflow(request, conv, user, db, memory)
print("Response:", res)
