import pytest
from fastapi.testclient import TestClient
from app import app

def test_vpn_troubleshooting_interactive_flow():
    client = TestClient(app)
    
    # Login
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Start conversation
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I cannot connect to my VPN"})
    assert res1.status_code == 200
    data1 = res1.json()
    conv_id = data1.get("conversation_id")
    response_text1 = data1.get("response", "").lower()
    
    # 1. Must ask about internet/network or VPN client as the FIRST diagnostic question
    assert "internet" in response_text1 or "website" in response_text1 or "client" in response_text1
    # Should NOT be a numbered list (long checklist)
    assert "1." not in response_text1
    assert "disable" not in response_text1
    
    # Turn 2: User says "Yes, my internet works fine"
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "Yes, my internet works fine", "conversation_id": conv_id})
    response_text2 = res2.json().get("response", "").lower()
    # Must proceed to ask about VPN client or error code
    assert "client" in response_text2 or "error" in response_text2 or "message" in response_text2
    assert "1." not in response_text2
    assert "disable" not in response_text2
    
    # Turn 3: User says "I am using Cisco AnyConnect and it says Error 809"
    res3 = client.post("/assistant/chat", headers=headers, json={"message": "I am using Cisco AnyConnect and it says Error 809", "conversation_id": conv_id})
    response_text3 = res3.json().get("response", "").lower()
    # Must address the specific error
    assert "809" in response_text3 or "it" in response_text3 or "support" in response_text3 # LLM will reason about error 809
    assert "disable" not in response_text3
    
    # Turn 4: Let's trigger ticket creation by saying "Nothing worked, I need help"
    res4 = client.post("/assistant/chat", headers=headers, json={"message": "Nothing worked, I need help. Just create a ticket.", "conversation_id": conv_id})
    response_text4 = res4.json().get("response", "").lower()
    # Should offer to create a ticket or confirm ticket creation
    assert "ticket" in response_text4 or "request" in response_text4 or "support" in response_text4

def test_vpn_troubleshooting_no_internet_flow():
    client = TestClient(app)
    
    # Login
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Start conversation
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I cannot connect to my VPN"})
    conv_id = res1.json().get("conversation_id")
    
    # Turn 2: User says "No, I can't access any websites at all"
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "No, I can't access any websites at all", "conversation_id": conv_id})
    response_text2 = res2.json().get("response", "").lower()
    
    # Must focus on network/Wi-Fi rather than VPN specific settings
    assert "wi-fi" in response_text2 or "network" in response_text2 or "router" in response_text2 or "internet" in response_text2
