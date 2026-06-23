from services.ai_client import client
import json
from config.ai_config import (
    CHAT_MODEL,
    CLASSIFICATION_MODEL
)

SYSTEM_PROMPT = """
You are CyberDesk AI, an enterprise IT Helpdesk and Cybersecurity assistant.

Your task is to understand the employee's request and extract useful information.

Return ONLY valid JSON.

{
    "intent": "",
    "confidence": 0,
    "response": "",
    "entities": {
        "account_type": null,
        "operating_system": null,
        "incident_type": null,
        "urgency": null
    },
    "can_autoresolve": true,
    "should_escalate": false
}

Valid intents:
- password_reset
- it_support
- security_incident
- security_awareness
- general_question

Valid account types:
- Windows Login
- VPN
- Microsoft 365
- Email
- GitHub
- Other

Rules:
- Return JSON only.
- No markdown.
- No explanations.
- confidence must be between 1 and 10.
- If an entity is unknown, return null.
- Extract entities whenever possible.
"""
def chat_with_ai(conversation_history):

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    messages.extend(conversation_history)

    response = client.chat(
        model=CHAT_MODEL,
        messages=messages,
        temperature=0.3
    )

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()
    data = json.loads(result)

    data.setdefault("entities", {})
    data["entities"].setdefault("account_type", None)
    data["entities"].setdefault("operating_system", None)
    data["entities"].setdefault("incident_type", None)
    data["entities"].setdefault("urgency", None)

    return data

def classify_confirmation(text):

    response = client.chat(
        model=CLASSIFICATION_MODEL,
        messages=[
            {
                "role": "system",
                "content": """
Determine whether the user is confirming or rejecting a request.

Return ONLY JSON.

{
    "confirmation": true
}

or

{
    "confirmation": false
}
"""
            },
            {
                "role": "user",
                "content": text
            }
        ],
        temperature=0
    )

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    return json.loads(result)["confirmation"]