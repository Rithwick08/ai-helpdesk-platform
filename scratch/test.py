import asyncio
import json
from database import SessionLocal
from models.user import User
from models.assistant_conversation import AssistantConversation
from agent.tools.it_support_tool import ITSupportTool
from agent.workflow_memory import WorkflowMemory
from schemas.assistant import ChatRequest

async def main():
    db = SessionLocal()
    user = db.query(User).first()
    conv = AssistantConversation(user_id=user.id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    
    memory = WorkflowMemory()
    conv.collected_entities = memory.to_json()
    
    req = ChatRequest(message="My VPN is not connecting.", conversation_id=conv.id)
    
    tool = ITSupportTool()
    
    try:
        res = tool.execute(req, conv, user, db, {})
        print(res)
    except Exception as e:
        import traceback
        traceback.print_exc()
        
    db.close()

if __name__ == "__main__":
    asyncio.run(main())
