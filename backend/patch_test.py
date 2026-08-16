import re

with open("test_ai_routing.py", "r") as f:
    content = f.read()

new_test = """
def test_e2e_password_reset_db_persistence(db_session):
    \"\"\"Test that a password reset confirmation actually persists to the database\"\"\"
    client = TestClient(app)
    
    response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    res1 = client.post("/assistant/chat", headers=headers, json={"message": "I forgot my password."})
    conv_id = res1.json().get("conversation_id")
    
    res2 = client.post("/assistant/chat", headers=headers, json={"message": "Windows login", "conversation_id": conv_id})
    
    # Check count before
    from models.password_reset import PasswordReset
    count_before = db_session.query(PasswordReset).count()
    
    res3 = client.post("/assistant/chat", headers=headers, json={"message": "Yes", "conversation_id": conv_id})
    assert "Password reset request created" in res3.json().get("response")
    
    # Verify persistence
    count_after = db_session.query(PasswordReset).count()
    assert count_after == count_before + 1
    
    # Verify attributes
    latest = db_session.query(PasswordReset).order_by(PasswordReset.id.desc()).first()
    assert latest.status == "Pending Approval"
    assert latest.identity_verified == "Yes"
    assert latest.account_type == "Windows login"
"""

if "test_e2e_password_reset_db_persistence" not in content:
    with open("test_ai_routing.py", "a") as f:
        f.write(new_test)
