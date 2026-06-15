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
def analyze_password_reset(reason):

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": f"""
Analyze this password reset request.

Reason:
{reason}

Return ONLY valid JSON.

{{
    "priority": "",
    "action": ""
}}

Rules:
- priority must be Low, Medium, or High
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
def diagnose_it_issue(issue):

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": f"""
Analyze this IT support issue.

Issue:
{issue}

Return ONLY valid JSON.

{{
   
    "category": "",
    "priority": "",
    "diagnosis": "",
    "recommended_fix": "",
    "resolution_steps": ""

}}

Provide 3-5 numbered resolution steps..
resolution_steps must be a single string.

Example:

"1. Verify credentials
2. Reset password
3. Restart VPN client
4. Retry connection"

Do NOT return arrays or objects.
"""
            }
        ]
    )

    import json

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(result)

    except Exception as e:
        print("AI JSON Parse Error:", e)
        print(result)

    return {
        "category": "Unknown",
        "priority": "Low",
        "diagnosis": "Unable to analyze issue",
        "recommended_fix": "Manual review required",
        "resolution_steps": "Escalate to IT support"
    }