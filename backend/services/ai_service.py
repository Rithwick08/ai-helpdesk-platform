
from dotenv import load_dotenv
import os
import json
from config.ai_config import (
    CHAT_MODEL,
    REASONING_MODEL,
    CLASSIFICATION_MODEL,
)
load_dotenv()
from services.ai_client import client

def classify_incident(description):

    response = client.chat(
        model=CLASSIFICATION_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"""
You are a Senior SOC Analyst.

Analyze the cybersecurity incident below.

Description:
{description}

Choose ONLY one category from:

- Phishing
- Malware
- Ransomware
- Data Breach
- Account Compromise
- Insider Threat
- Device Loss
- Unauthorized Access
- Denial of Service
- Network Attack
- Suspicious Email
- Web Attack
- Social Engineering
- User Error
- Other

Severity must be one of:

- Low
- Medium
- High
- Critical

Examples:

Input:
I clicked a phishing link.
Output:
Category: Phishing
Severity: High

Input:
I entered my password into a fake Microsoft login page.
Output:
Category: Account Compromise
Severity: High

Input:
My files are encrypted.
Output:
Category: Ransomware
Severity: Critical

Input:
My laptop was stolen.
Output:
Category: Device Loss
Severity: High

Input:
Windows Defender detected a Trojan.
Output:
Category: Malware
Severity: High

Input:
I received a suspicious email.
Output:
Category: Suspicious Email
Severity: Medium

Return ONLY JSON.

{{
    "category": "",
    "severity": "",
    "confidence": 0
}}

Rules:

- confidence must be an integer from 1 to 10
- Return JSON only
- Never explain your answer
"""
            }
        ]
    )
    result = response.choices[0].message.content.strip()
    return json.loads(result)

def analyze_alert(alert_data):

    response = client.chat(
        model=REASONING_MODEL,
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

    response = client.chat(
        model=REASONING_MODEL,
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

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"""
You are a Senior Enterprise IT Support Engineer.

Analyze the following IT issue.

Issue:
{issue}

Return ONLY valid JSON.

{{
    "category": "",
    "priority": "",
    "diagnosis": "",
    "recommended_fix": "",
    "resolution_steps": [
        "",
        "",
        ""
    ],
    "should_escalate": false
}}

Rules:

- category should be one of:
  VPN
  Network
  Windows
  Email
  Microsoft 365
  Printer
  Hardware
  Software
  Security
  Other

- priority must be Low, Medium, High or Critical.

- diagnosis should be one sentence.

- recommended_fix should summarize the best solution.

- resolution_steps MUST be an array of 3 to 5 steps.

- Start with the least invasive fix.

- Escalate only if the issue obviously requires a human technician.

Return JSON only.
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
    "category": "Other",
    "priority": "Low",
    "diagnosis": "Unable to analyze the issue.",
    "recommended_fix": "Escalate to IT support.",
    "resolution_steps": [
        "Collect additional information.",
        "Restart the affected application.",
        "Escalate to IT support."
    ],
    "should_escalate": True
}

def continue_it_troubleshooting(problem, conversation_history):

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "system",
                "content": """
You are a Senior IT Support Engineer.

The user has already tried previous troubleshooting steps.

Read the conversation carefully.

DO NOT repeat any previous solution.

If another troubleshooting step exists, provide ONLY ONE new step.

If no further troubleshooting is possible, return should_escalate=true.

Return ONLY JSON.

{
    "response": "",
    "resolved": false,
    "should_escalate": false
}
"""
            },
            {
                "role": "user",
                "content": f"""
Original Problem:
{problem}

Conversation:
{conversation_history}
"""
            }
        ],
        temperature=0.2
    )

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    return json.loads(result)
def generate_incident_questions(description):

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"""
You are a Senior SOC Analyst.

A user reported the following cybersecurity incident:

{description}

Ask the 3 most important follow-up questions needed before creating a security incident.

The questions should depend on the incident.

Examples:

Phishing:
- Did you enter your password?
- Did you download any attachment?
- Is MFA enabled?

Malware:
- Is the device still powered on?
- Has antivirus detected anything?
- Are other devices affected?

Lost Laptop:
- Was disk encryption enabled?
- Was it a company device?
- Has it been reported to security?

Return ONLY valid JSON.

{{
    "questions": [
        "",
        "",
        ""
    ]
}}
"""
            }
        ]
    )

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    return json.loads(result)
def continue_security_incident(problem, conversation_history):

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "system",
                "content": """
You are a Senior SOC Analyst.

The employee has answered follow-up questions.

Read the ENTIRE conversation.

Determine:

- Has the incident become more severe?
- Should the incident be created?
- What immediate containment actions should the employee perform?

Return ONLY JSON.

{
    "severity": "",
    "response": "",
    "containment": [
        "",
        "",
        ""
    ],
    "create_incident": true
}
"""
            },
            {
                "role": "user",
                "content": f"""
Original Incident:
{problem}

Conversation:
{conversation_history}
"""
            }
        ],
        temperature=0.2
    )

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    return json.loads(result)
def recommend_training(conversation):

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"""
You are a Cybersecurity Awareness Expert.

Read the completed conversation.

Recommend 3 cybersecurity training topics.

Return ONLY JSON.

{{
    "topics":[
        "",
        "",
        ""
    ]
}}

Conversation:

{conversation}
"""
            }
        ]
    )

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    return json.loads(result)
def answer_training_question(video_title, user_question):

    response = client.chat(
        model=CHAT_MODEL,
        messages=[
            {
                "role": "system",
                "content": f"""
You are a cybersecurity trainer.

The user is watching this training video:

{video_title}

Answer only questions related to this topic.

Keep answers concise and educational.
"""
            },
            {
                "role": "user",
                "content": user_question
            }
        ],
        temperature=0.3
    )

    return {
        "answer": response.choices[0].message.content
    }