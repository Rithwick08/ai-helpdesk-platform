
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
def diagnose_it_issue(issue, current_user):

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"""
You are a Senior Enterprise IT Support Engineer.
The user logging this issue is {current_user.name} (Email: {current_user.email}, Role: {current_user.role}, Dept: {current_user.department}).

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

- diagnosis should be one short concise sentence explaining the likely cause.

- recommended_fix should summarize the best solution concisely.

- resolution_steps MUST be an array of exactly 3 steps. Each step must be a concise, professional sentence (e.g. "Are you receiving an error message?", or "Please check if your VPN client is updated."). Do NOT ask for information you already know about the user (e.g. role, department). Start with the least invasive fix or clarification question.

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

def continue_it_troubleshooting(problem, conversation_history, current_user):

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "system",
                "content": f"""
You are a Senior IT Support Engineer for our company.

The user is {current_user.name} (Email: {current_user.email}, Role: {current_user.role}, Dept: {current_user.department}).

The user has already tried previous troubleshooting steps. Read the conversation carefully.

Rules:
1. DO NOT repeat any previous solution or question.
2. If another troubleshooting step exists, provide ONLY ONE new concise step or clarification question.
3. Keep your response to 1-2 short sentences. Be professional, confident, and concise. Avoid generic phrases like "I understand" or "I'd be happy to help".
4. NEVER ask for information you already know about the user (e.g. their department or role).
5. If no further troubleshooting is possible, return should_escalate=true.

Return ONLY JSON.

{{
    "response": "",
    "resolved": false,
    "should_escalate": false
}}
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

def classify_troubleshooting_reply(problem, current_step_title, current_question, user_reply):

    try:
        response = client.chat(
            model=REASONING_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""
You are an intent classifier for an IT Support workflow.

Original Issue: "{problem}"
Current Step: "{current_step_title}"
Current Question: "{current_question}"

User Reply:
"{user_reply}"

Classify the user's reply intent into EXACTLY ONE of the following:

- YES: The user explicitly confirmed the problem is resolved, or the step succeeded, or they provided information that directly implies success (e.g., "Google opens now").
- NO: The user explicitly stated the problem still exists, or the step failed, or they provided information that directly implies failure (e.g., "Still not working").
- QUESTION: The user is asking for clarification about the current step or issue.
- INFORMATION: The user is providing additional details or context rather than answering the yes/no question.
- CANCEL: The user explicitly wants to cancel or stop the troubleshooting workflow (e.g., "cancel", "stop", "never mind").

Return ONLY valid JSON. Do not return explanations, confidence scores, reasoning, or any additional fields.

{{
    "intent": ""
}}
"""
                }
            ],
            temperature=0.0
        )

        result = response.choices[0].message.content.strip()

        if result.startswith("```json"):
            result = result.replace("```json", "").replace("```", "").strip()

        return json.loads(result)
    except Exception as e:
        print("AI JSON Parse Error (classify_reply):", e)
        # Fallback
        return {"intent": "INFORMATION"}

def generate_incident_questions(description, current_user):

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"""
You are a Senior SOC Analyst.

A user reported the following cybersecurity incident:

{description}

The user reporting this is {current_user.name} (Email: {current_user.email}, Role: {current_user.role}, Dept: {current_user.department}).

Ask exactly ONE most important follow-up question needed before creating a security incident.
Do NOT ask for information you already know about the user.
Do not ask multiple questions. Make it concise and professional.

Return ONLY valid JSON.

{{
    "question": ""
}}
"""
            }
        ]
    )

    result = response.choices[0].message.content.strip()

    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    return json.loads(result)
def continue_security_incident(problem, conversation_history, current_user):

    response = client.chat(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "system",
                "content": f"""
You are a Senior SOC Analyst.

The employee has answered follow-up questions.
The user reporting this is {current_user.name} (Email: {current_user.email}, Role: {current_user.role}, Dept: {current_user.department}).

Read the ENTIRE conversation.

Determine:

- Has the incident become more severe?
- Should the incident be created?
- What immediate containment actions should the employee perform?
- Your response should be a professional, confident 1-2 sentence statement avoiding generic chatbot filler.

Return ONLY JSON.

{{
    "severity": "",
    "response": "",
    "containment": [
        "",
        "",
        ""
    ],
    "create_incident": true
}}
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

