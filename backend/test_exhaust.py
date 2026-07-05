import sys
import os
sys.path.append(os.path.abspath("."))

from database import SessionLocal
from models.user import User
from models.assistant_conversation import AssistantConversation
from tools.it_support_tool import ITSupportTool
from agent.workflow_memory import WorkflowMemory
from schemas.assistant import ChatRequest

db = SessionLocal()
user = db.query(User).first()

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
memory.set_current_step("vpn_reinstall")  # The very last step

tool = ITSupportTool()
request = ChatRequest(message="no, that didn't work either")
print("Testing Exhaustion...")
res = tool._continue_workflow(request, conv, user, db, memory)
print("Response:", res)
