import pytest
from fastapi.testclient import TestClient
from app import app
from database import SessionLocal
from agent.states import ConversationState

def test_e2e_password_reset_yeah():
    client = TestClient(app)
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I forgot my password."})
    conv_id = res1.json().get("conversation_id")
    
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "Windows login", "conversation_id": conv_id})
    print("res2:", res2.json())
    
    res3 = client.post("/assistant/chat", headers=headers, json={"message": "Yeah", "conversation_id": conv_id})
    print("res3:", res3.json())
    assert "Password reset request created" in res3.json().get("response")

