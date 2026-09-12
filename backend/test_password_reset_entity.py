import pytest
from fastapi.testclient import TestClient
from app import app
from database import SessionLocal

def test_password_reset_entity_extraction():
    client = TestClient(app)
    
    # Login
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test cases mapping natural language to expected account type
    test_cases = {
        "I cannot connect to my VPN": "VPN",
        "my VPN": "VPN",
        "VPN": "VPN",
        "Microsoft 365": "Microsoft 365",
        "my Microsoft account": "Microsoft 365",
        "my email password": "Email",
        "Windows login": "Windows Login",
        "Something random": "Something random" # Fallback behavior
    }
    
    for user_input, expected_account in test_cases.items():
        # Start new conversation
        res1 = client.post("/assistant/chat", headers=headers, json={"message": "I forgot my password."})
        conv_id = res1.json().get("conversation_id")
        
        # Provide the account type
        res2 = client.post("/assistant/chat", headers=headers, json={"message": user_input, "conversation_id": conv_id})
        
        # Verify the confirmation message contains the expected account type
        response_text = res2.json().get("response", "")
        
        # The expected format is: "I will create a password reset request for your {account_type} account. Shall I go ahead?"
        expected_substring = f"I will create a password reset request for your {expected_account} account"
        assert expected_substring in response_text, f"Failed for '{user_input}'. Expected to find '{expected_substring}' in '{response_text}'"

