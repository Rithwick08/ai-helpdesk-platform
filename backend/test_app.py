from fastapi.testclient import TestClient
from app import app
from database import SessionLocal
from models.assistant_conversation import AssistantConversation

db = SessionLocal()
last_conv = db.query(AssistantConversation).order_by(AssistantConversation.id.desc()).first()
conv_id = last_conv.id if last_conv else None

client = TestClient(app)

response = client.post("/auth/login", json={"email": "employee@cybershield.ai", "password": "password123"})
token = response.json().get("access_token")

res = client.post(
    "/assistant/chat",
    headers={"Authorization": f"Bearer {token}"},
    json={"message": "What if malware disables my VPN?", "conversation_id": conv_id}
)

print("STATUS:", res.status_code)
print("BODY:", res.text)
