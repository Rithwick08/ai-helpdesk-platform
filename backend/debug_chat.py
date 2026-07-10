import requests

# 1. Login
response = requests.post(
    "http://localhost:8000/auth/login",
    json={"email": "employee@cybershield.ai", "password": "password123"}
)
token = response.json().get("access_token")

# 2. Try to hit the chat endpoint with some conversation ID to see if it fails.
# Let's find the max conversation_id first
from database import SessionLocal
from models.assistant_conversation import AssistantConversation
db = SessionLocal()
last_conv = db.query(AssistantConversation).order_by(AssistantConversation.id.desc()).first()
conv_id = last_conv.id if last_conv else None

print(f"Testing with conv_id={conv_id}")

res = requests.post(
    "http://localhost:8000/assistant/chat",
    headers={"Authorization": f"Bearer {token}"},
    json={"message": "What is phishing?", "conversation_id": conv_id}
)
print("STATUS:", res.status_code)
if res.status_code == 500:
    print("Failed with 500!")
else:
    print("BODY:", res.text)
