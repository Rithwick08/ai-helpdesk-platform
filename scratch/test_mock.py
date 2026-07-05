import asyncio
from unittest.mock import MagicMock
from tools.it_support_tool import ITSupportTool
from agent.workflow_memory import WorkflowMemory
from schemas.assistant import ChatRequest

def main():
    db = MagicMock()
    current_user = MagicMock()
    current_user.name = "Test User"
    current_user.email = "test@example.com"
    current_user.role = "Employee"
    current_user.department = "IT"
    current_user.employee_id = "123"
    
    conversation = MagicMock()
    conversation.original_problem = None
    conversation.pending_action = None
    conversation.troubleshooting_attempts = 0
    conversation.collected_entities = None
    
    memory = WorkflowMemory()
    conversation.collected_entities = memory.to_json()
    
    req = ChatRequest(message="Yes", conversation_id=1)
    
    tool = ITSupportTool()
    
    try:
        res = tool.execute(req, conversation, current_user, db, {})
        print("Success:", res)
    except Exception as e:
        import traceback
        print("Crash:")
        traceback.print_exc()

if __name__ == "__main__":
    main()
