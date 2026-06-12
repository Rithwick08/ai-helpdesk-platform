from groq import Groq
from dotenv import load_dotenv
import os
import json

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

def classify_incident(description):

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": f"""
Classify this cybersecurity incident.

Description:
{description}

Return ONLY valid JSON.
No markdown.

No explanation.

No notes.

No extra text.

{{
    "category": "",
    "severity": "",
    "confidence": 0
}}

Rules:
- confidence must be an integer from 1 to 10
- severity must be Low, Medium, High, or Critical
- no explanations
"""
            }
        ]
    )
    result = response.choices[0].message.content.strip()
    return json.loads(result)

def analyze_alert(alert_data):

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": f"""
Analyze this security alert.

Alert:
{alert_data}

Return ONLY valid JSON.

{{
    "threat_type": "",
    "severity": "",
    "recommended_action": ""
}}

Rules:
- severity must be Low, Medium, High, or Critical
- no explanations
"""
            }
        ]
    )

    import json

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    return json.loads(result)