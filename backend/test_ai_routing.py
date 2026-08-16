import pytest
from fastapi.testclient import TestClient
from app import app
from database import SessionLocal
from agent.planner import Planner
from agent.workflow_memory import WorkflowMemory
from agent.states import ConversationState

def test_password_reset_routing_from_idle():
    """Test that password reset phrases trigger the tool directly."""
    memory = WorkflowMemory()
    
    class MockConversation:
        workflow_state = ConversationState.IDLE
        pending_action = None
        pending_tool = None
        original_problem = None
        
    conv = MockConversation()
    
    phrases = [
        "I forgot my password.",
        "I need to reset my password.",
        "Can you reset my password?",
        "Create a ticket for password reset."
    ]
    
    for phrase in phrases:
        decision = Planner.decide(phrase, conv, memory)
        assert decision.action == "tool_loop", f"Failed on: {phrase}"
        assert decision.tool_name == "password_reset", f"Failed on: {phrase}"
        assert decision.memory.problem == phrase, f"Failed on: {phrase}"


def test_password_phrase_false_positives():
    """Test that unrelated messages with the word password do not trigger the tool."""
    memory = WorkflowMemory()
    
    class MockConversation:
        workflow_state = ConversationState.IDLE
        pending_action = None
        pending_tool = None
        original_problem = None
        
    conv = MockConversation()
    
    phrases = [
        "My password manager is broken.",
        "How do I create a strong password?",
        "Is password123 safe?",
    ]
    
    for phrase in phrases:
        decision = Planner.decide(phrase, conv, memory)
        assert decision.action == "llm", f"Should defer to LLM: {phrase}"


def test_e2e_password_reset_switch():
    """Test the exact multi-turn sequence for password reset breakout and persistence."""
    client = TestClient(app)
    
    # Login
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Start a new conversation about VPN
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I'm having trouble connecting to the VPN."})
    assert res1.status_code == 200
    conv_id = res1.json().get("conversation_id")
    
    # Verify we are in IT support loop
    db = SessionLocal()
    from models.assistant_conversation import AssistantConversation
    conv = db.query(AssistantConversation).filter(AssistantConversation.id == conv_id).first()
    assert conv.pending_action == "it_support"
    db.close()
    
    # 2. Breakout with password reset
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "I forgot my password.", "conversation_id": conv_id})
    assert res2.status_code == 200
    
    # Verify pending action changed to password_reset_waiting
    db = SessionLocal()
    conv = db.query(AssistantConversation).filter(AssistantConversation.id == conv_id).first()
    assert conv.pending_action == "password_reset_waiting"
    db.close()
    
    # 3. Follow up in the password reset loop
    res3 = client.post("/assistant/chat", headers=headers, json={"message": "Generate a password reset ticket.", "conversation_id": conv_id})
    assert res3.status_code == 200
    
    # Verify we stayed in password reset (it should ask for confirmation because account_type is 'company account' or from message)
    db = SessionLocal()
    conv = db.query(AssistantConversation).filter(AssistantConversation.id == conv_id).first()
    # It should still be in the loop (either awaiting confirmation or password_reset_waiting)
    assert conv.pending_action == "password_reset_waiting"
    db.close()


def test_e2e_password_reset_completion():
    """Test a full password reset flow: I forgot my password -> Employee -> Yes"""
    client = TestClient(app)
    
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Start
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I forgot my password."})
    assert res1.status_code == 200
    conv_id = res1.json().get("conversation_id")
    
    # 2. Provide account type
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "Employee", "conversation_id": conv_id})
    assert res2.status_code == 200
    
    # 3. Confirm
    res3 = client.post("/assistant/chat", headers=headers, json={"message": "Yes", "conversation_id": conv_id})
    assert res3.status_code == 200
    assert "Password reset request created" in res3.json().get("response")
    
    # Verify loop is completed
    db = SessionLocal()
    from models.assistant_conversation import AssistantConversation
    conv = db.query(AssistantConversation).filter(AssistantConversation.id == conv_id).first()
    assert conv.pending_action is None
    assert conv.workflow_state == ConversationState.COMPLETED
    db.close()

def test_e2e_password_reset_self_interruption_and_state_persistence():
    """Test VPN -> Password Reset -> Repeat password reset phrase"""
    client = TestClient(app)
    
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Start VPN
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I'm having trouble connecting to the VPN."})
    assert res1.status_code == 200
    conv_id = res1.json().get("conversation_id")
    
    # Verify VPN state
    db = SessionLocal()
    from models.assistant_conversation import AssistantConversation
    conv = db.query(AssistantConversation).filter(AssistantConversation.id == conv_id).first()
    assert conv.pending_action == "it_support"
    db.close()
    
    # 2. Breakout with password reset
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "I forgot my password.", "conversation_id": conv_id})
    assert res2.status_code == 200
    
    # Verify new state is persisted and old state is cleared
    db = SessionLocal()
    conv = db.query(AssistantConversation).filter(AssistantConversation.id == conv_id).first()
    assert conv.pending_action == "password_reset_waiting"
    assert "it.phase" not in conv.collected_entities
    db.close()
    
    # 3. User repeats themselves (self-interruption test)
    res3 = client.post("/assistant/chat", headers=headers, json={"message": "I want to reset my password. Please create a ticket.", "conversation_id": conv_id})
    assert res3.status_code == 200
    
    # Verify we progressed in the password reset workflow (it should ask for confirmation)
    assert "Shall I go ahead" in res3.json().get("response")
    
    db = SessionLocal()
    conv = db.query(AssistantConversation).filter(AssistantConversation.id == conv_id).first()
    assert conv.pending_action == "password_reset_waiting"
    assert conv.workflow_state == ConversationState.AWAITING_CONFIRMATION
    # Ensure it's not IT support
    assert "it.phase" not in conv.collected_entities
    db.close()

def test_e2e_password_reset_yeah_confirmation():
    """Test a full password reset flow with 'Yeah' confirmation"""
    client = TestClient(app)
    
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I forgot my password."})
    conv_id = res1.json().get("conversation_id")
    
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "Windows login", "conversation_id": conv_id})
    
    res3 = client.post("/assistant/chat", headers=headers, json={"message": "Yeah", "conversation_id": conv_id})
    assert "Password reset request created" in res3.json().get("response")


def test_e2e_password_reset_db_persistence():
    """Test that a password reset confirmation actually persists to the database"""
    client = TestClient(app)
    
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I forgot my password."})
    conv_id = res1.json().get("conversation_id")
    
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "Windows login", "conversation_id": conv_id})
    
    # Check count before
    from database import SessionLocal
    from models.password_reset import PasswordReset
    
    db_session = SessionLocal()
    count_before = db_session.query(PasswordReset).count()
    
    res3 = client.post("/assistant/chat", headers=headers, json={"message": "Yes", "conversation_id": conv_id})
    assert "Password reset request created" in res3.json().get("response")
    
    # Verify persistence
    count_after = db_session.query(PasswordReset).count()
    assert count_after == count_before + 1
    
    # Verify attributes
    latest = db_session.query(PasswordReset).order_by(PasswordReset.id.desc()).first()
    assert latest.status == "Pending"
    assert latest.account_type == "Windows login"
    
    db_session.close()
