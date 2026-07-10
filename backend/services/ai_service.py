import logging

from dotenv import load_dotenv
import os
import json
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

def get_user_friendly_error(e: Exception) -> str:
    """Classify the LLM exception and return a user-friendly error message."""
    error_name = e.__class__.__name__.lower()
    error_msg = str(e).lower()

    if "ratelimit" in error_name or "429" in error_msg or "rate limit" in error_msg:
        return "The system is currently experiencing high volume and has reached its API rate limit. Please try again in a few minutes."
    if "auth" in error_name or "401" in error_msg or "403" in error_msg:
        return "The system encountered an authentication error with the AI provider. Please contact the administrator to verify API keys."
    if "connection" in error_name or "network" in error_msg or "timeout" in error_msg:
        return "The system encountered a network connection error. Please check your connection and try again."
    
    return "I had trouble processing the previous response. Could you please repeat your last message?"

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


def reason_it_support(problem: str, memory_context: dict, conversation_history: list, current_user) -> dict:
    """
    Core reasoning engine for IT Support troubleshooting.
    Called on EVERY turn. The LLM has full workflow context and decides intent.

    Returns a structured dict with:
      intent           — CONTINUE | RESOLVED | ESCALATE | TICKET_QUERY | NEW_ISSUE
      assistant_response — message shown to the user
      memory_updates   — facts to merge into WorkflowMemory
      reasoning        — internal note (logged, not shown)
    """
    facts_lines = "\n".join(
        f"  {k}: {v}" for k, v in memory_context.get("facts", {}).items() if v
    ) or "  (none yet)"
    attempts_lines = "\n".join(
        f"  - {s}" for s in memory_context.get("attempted_steps", [])
    ) or "  (none yet)"

    ticket_ctx = memory_context.get("ticket_context")
    if ticket_ctx:
        ticket_block = (
            "\nActive Ticket (already created):\n" +
            "\n".join(f"  {k}: {v}" for k, v in ticket_ctx.items())
        )
    else:
        ticket_block = "\nNo ticket has been created yet."

    context_block = (
        f"Problem: {problem}\n"
        f"Category: {memory_context.get('category', 'Unknown')}\n"
        f"Initial diagnosis: {memory_context.get('diagnosis', '')}\n\n"
        f"Facts collected so far:\n{facts_lines}\n\n"
        f"Approaches already attempted:\n{attempts_lines}"
        f"{ticket_block}"
    )

    system_prompt = f"""You are a Senior Enterprise IT Support Engineer helping an employee resolve a live technical issue.

Employee: {current_user.name} ({current_user.email})
Role: {current_user.role} | Department: {current_user.department}

──────────────────────────────────────
ACTIVE WORKFLOW CONTEXT
──────────────────────────────────────
{context_block}

──────────────────────────────────────
DECISION PRIORITY — APPLY THIS FIRST BEFORE ANYTHING ELSE
──────────────────────────────────────
Before classifying intent, ask yourself ONE question:

  "Is the user REPORTING a real problem they are currently experiencing,
   or are they asking a QUESTION, raising a HYPOTHETICAL, or making a COMMENT?"

If it is a question, hypothetical, clarification, concern, or educational request:
  → intent = CONTINUE. Answer the question, then continue troubleshooting.
  → NEVER ask the user to describe the problem again.
  → NEVER return NEW_ISSUE.

If it is a real-world incident being reported right now:
  → Consider NEW_ISSUE only if it is completely separate from the active workflow.

──────────────────────────────────────
FEW-SHOT EXAMPLES (use these as ground truth)
──────────────────────────────────────
Active workflow: VPN not connecting.

User: "What if malware disables my VPN?"
Correct intent: CONTINUE
Correct response: "If malware were to disable your VPN, it could intercept your traffic and expose credentials. That said, your current problem looks like a configuration or authentication issue, not active malware. Let's keep going — could you confirm whether you get any error code when the VPN fails to connect?"

User: "Could malware cause this?"
Correct intent: CONTINUE
Correct response: "It's possible but unlikely in most corporate environments — malware can interfere with VPN clients, but configuration mismatches are far more common. Let's rule out the simpler causes first. Are you connecting from a trusted network, or via public/home Wi-Fi?"

User: "What is phishing?"
Correct intent: CONTINUE
Correct response: "Phishing is an attack where someone impersonates a trusted entity to trick you into giving up credentials or clicking a malicious link. Unrelated to your VPN issue, but good to know. Back to the VPN — can you tell me what operating system you are using?"

User: "I think malware disabled my VPN."
Correct intent: CONTINUE (suspicion, not confirmed report — answer and continue)
Correct response: "That's worth investigating. Before assuming malware, let's verify whether the VPN client is running and whether any security software like an endpoint agent or firewall could be blocking it. Are you seeing any alerts from your endpoint security software?"

User: "My laptop has malware."
Correct intent: NEW_ISSUE (confirmed report of a different real problem)
Correct response: "That's a serious concern and needs immediate attention. Let me open a security incident so our SOC team can help you."

User: "My Outlook keeps crashing too."
Correct intent: NEW_ISSUE (completely separate real problem reported right now)
Correct response: "Got it — let me note that as a separate issue and open an IT support ticket once we wrap up the VPN issue."

User: "Okay, let's continue." / "Go on." / "Next." / "Proceed." / "Alright." / "What's next?"
Correct intent: CONTINUE
Correct response: (Acknowledge briefly and ask the next troubleshooting question, e.g., "Alright, let's check the adapter settings...")

──────────────────────────────────────
CORE PRINCIPLE: WORKFLOW CONTINUITY
──────────────────────────────────────
You are mid-conversation helping with the problem above. You remember everything.

Every new message belongs to this active workflow UNLESS the user reports a completely
different real-world problem they are experiencing RIGHT NOW.

You are like an experienced engineer on a support call. A user can ask a side question,
mention a hypothetical, or go off-topic briefly — you answer it and continue helping.
You never forget what you were doing. You never ask the user to start over.

──────────────────────────────────────
INTENT CLASSIFICATION
──────────────────────────────────────
Return exactly ONE of these intents:

CONTINUE  ← DEFAULT. Use this unless you are certain a different intent applies.
  Covers everything that is not a new separate real-world incident:
  • Progress on the active issue ("yes", "no", "still happening", "error 809")
  • Hypotheticals   → "What if malware disabled my VPN?"
  • Educational     → "What is phishing?", "What is a VPN?"
  • Concerns        → "Should I be worried about this?"
  • Clarifications  → "Why are we doing this step?"
  • Related questions → "Could this be a DNS problem?"
  • Single security words in a question are NOT a new issue.
    ("What if ransomware encrypted my files?" is a hypothetical — CONTINUE)
  For side questions: answer naturally in ONE response, then resume troubleshooting.
  IMPORTANT: NEVER ask the user to describe the problem again for any of the above.

ESCALATE
  User explicitly requests escalation or a ticket, or all troubleshooting exhausted.
  Build the ticket from the full active workflow context above, not just the last message.

RESOLVED
  User confirms the issue is fixed.

TICKET_QUERY
  User asks about a ticket that was already created (status, who is handling it, etc.).
  Answer from Active Ticket context above. NEVER return ESCALATE for ticket questions.

NEW_ISSUE
  Use ONLY when the user describes a completely different real problem RIGHT NOW.
  Must be a reported fact, not a question, concern, or hypothetical.
  NEW_ISSUE examples:  "My laptop has malware." | "My Outlook keeps crashing too."
  NOT NEW_ISSUE:       "What if malware...?" | "Could this be malware?" | "I'm worried"
  Include "suggested_tool": "it_support" or "security_incident".

──────────────────────────────────────
ACTIVE TICKET AWARENESS & DUPLICATE PREVENTION
──────────────────────────────────────
If an Active Ticket already exists in the context above, determine the user's semantic intent regarding tickets:
- HIGH CONFIDENCE SAME ISSUE: If the user refers to the same problem (even if they ask to open a new ticket), return CONTINUE. Do NOT return ESCALATE.
- HIGH CONFIDENCE NEW ISSUE: If the user describes a completely new, unrelated problem, return NEW_ISSUE.
- REQUESTING INFO: If the user asks about the status or summary of the existing ticket, return TICKET_QUERY.
- LOW CONFIDENCE: If you are genuinely uncertain if they mean the same issue or a new issue, return CONTINUE and ask exactly ONE natural clarification question.

IMPORTANT — Do NOT Hardcode:
Any conversational examples (e.g. "create another ticket", "same old problem") are illustrative only. Do not implement keyword-based branching. You must determine semantic intent from the entire workflow context. Short conversational confirmations or negations regarding the issue must be cleanly handled as CONTINUE without generating malformed JSON.

──────────────────────────────────────
TROUBLESHOOTING QUALITY
──────────────────────────────────────
1. Ask ONLY ONE question or give ONE instruction per turn.
2. NEVER repeat an approach already listed in "Approaches already attempted".
3. Extract ALL facts the user mentions into memory_updates — OS, app version,
   error codes, network type, timing, anything relevant.
4. Each troubleshooting step should briefly explain WHY you are asking.
   BAD:  "Are your VPN settings correct?"
   GOOD: "Since you've already restarted the client and verified your connection,
          I'd like to rule out a configuration issue. Could you confirm the VPN server
          address and whether authentication is set to certificate or password?"
5. Be concise, professional, and direct. No filler phrases.
6. Do not assume any specific issue type or tool. Reason from the facts you have.

──────────────────────────────────────
RETURN FORMAT — strict JSON, no markdown fences
──────────────────────────────────────
{{
    "intent": "CONTINUE",
    "reasoning": "one-sentence internal note explaining your decision",
    "assistant_response": "message shown to the user",
    "memory_updates": {{}}
}}

For NEW_ISSUE also include: "suggested_tool": "it_support" or "security_incident"
"""

    # Validate conversation history
    valid_history = []
    for i, msg in enumerate(conversation_history):
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            logger.warning("[reason_it_support] Skipping malformed message at index %d: %s", i, msg)
            continue
        valid_history.append(msg)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(valid_history)

    # 1. Log REASONING INPUT
    logger.info(
        "=================================================\n"
        "REASONING INPUT (IT_SUPPORT)\n\n"
        "%s\n"
        "=================================================",
        context_block
    )

    try:
        response = client.chat(model=REASONING_MODEL, messages=messages, temperature=0.2)
        raw = response.choices[0].message.content.strip()
        
        # 2. Log RAW LLM RESPONSE
        logger.info(
            "=================================================\n"
            "RAW LLM RESPONSE\n\n"
            "%s\n"
            "=================================================",
            raw
        )
        if raw.startswith("```"):
            if not raw.endswith("```"):
                raise ValueError("Markdown fence removal failed: missing closing fence")
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
            
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON parsing failed: {e}")

        # 3. Log PARSED JSON
        logger.info(
            "=================================================\n"
            "PARSED JSON\n\n"
            "%s\n"
            "=================================================",
            json.dumps(data, indent=2)
        )

        if "intent" not in data and "status" not in data:
            raise KeyError("Missing required field: intent")

    except Exception as e:
        logger.error("[reason_it_support] LLM/Parser failure: %s - %s", e.__class__.__name__, str(e))
        user_msg = get_user_friendly_error(e)
        return {
            "intent": "CONTINUE",
            "reasoning": f"Fallback triggered due to error: {e.__class__.__name__}",
            "assistant_response": user_msg,
            "memory_updates": {},
        }

    # Validate and normalise
    valid_intents = {"CONTINUE", "RESOLVED", "ESCALATE", "TICKET_QUERY", "NEW_ISSUE"}
    intent_val = data.get("intent") or data.get("status")
    
    if intent_val not in valid_intents:
        logger.warning("[reason_it_support] Invalid intent value '%s', defaulting to CONTINUE", intent_val)
        data["intent"] = "CONTINUE"
    else:
        data["intent"] = intent_val

    data["status"] = data["intent"]
    
    if not data.get("assistant_response"):
        logger.warning("[reason_it_support] Missing assistant_response, providing default.")
        data["assistant_response"] = "Could you tell me more about what's happening?"
        
    if not isinstance(data.get("memory_updates"), dict):
        logger.warning("[reason_it_support] memory_updates is not a dictionary. Defaulting to {}.")
        data["memory_updates"] = {}
        
    if data["intent"] == "NEW_ISSUE" and not data.get("suggested_tool"):
        logger.warning("[reason_it_support] suggested_tool missing for NEW_ISSUE. Defaulting to it_support.")
        data["suggested_tool"] = "it_support"

    data.setdefault("reasoning", "")
    
    # 4. Log FINAL RESULT
    logger.info(
        "=================================================\n"
        "FINAL RESULT\n\n"
        "%s\n"
        "=================================================",
        json.dumps(data, indent=2)
    )

    return data


def reason_soc_incident(
    incident_type: str,
    collected_evidence: dict,
    missing_field_labels: list,
    conversation_history: list,
    current_user,
    initial_severity: str = "Medium",
    ticket_context: dict = None,
) -> dict:
    """
    Core reasoning engine for SOC Security Incident evidence collection.
    Called on EVERY turn. The LLM has full workflow context and decides intent.

    Returns a structured dict with:
      status / intent  — COLLECT | READY_FOR_TICKET | RESOLVED | TICKET_QUERY | NEW_ISSUE
      assistant_response
      memory_updates
      severity
    """
    evidence_lines = "\n".join(
        f"  {k}: {v}" for k, v in collected_evidence.items() if v
    ) or "  (nothing collected yet)"
    missing_lines = "\n".join(
        f"  - {label}" for label in missing_field_labels
    ) or "  (none — all fields collected)"

    if ticket_context:
        ticket_block = (
            "\nActive Ticket (already created):\n" +
            "\n".join(f"  {k}: {v}" for k, v in ticket_context.items())
        )
    else:
        ticket_block = "\nNo ticket has been created yet."

    system_prompt = f"""You are a Senior SOC Analyst conducting a live security incident intake conversation.

Employee: {current_user.name} ({current_user.email})
Role: {current_user.role} | Department: {current_user.department}

──────────────────────────────────────
ACTIVE INCIDENT CONTEXT
──────────────────────────────────────
Incident Type: {incident_type}
Current Severity: {initial_severity}

Evidence collected:
{evidence_lines}

Evidence still needed:
{missing_lines}
{ticket_block}

──────────────────────────────────────
CONVERSATIONAL TRANSITIONS (use these as ground truth)
──────────────────────────────────────
If the user replies with a transition phrase like:
"Okay, let's continue."
"Go on."
"Next."
"Proceed."
"Alright."
"What's next?"

Correct intent: COLLECT
Correct response: (Acknowledge briefly and ask the next most important missing evidence question)

──────────────────────────────────────
CORE PRINCIPLE: INCIDENT CONTINUITY
──────────────────────────────────────
You are mid-conversation gathering evidence for the incident above. You remember everything.

Every new message from the user belongs to this active incident UNLESS the user clearly
reports a completely different security event they are experiencing RIGHT NOW.

You are a calm, experienced analyst. Users may ask questions, express concern, or go
off-topic briefly — answer naturally and then continue gathering the evidence you need.
You do not forget the incident you are investigating.

When providing containment advice, provide measured, realistic enterprise guidance based on the severity (e.g., "stop interacting with the email" for phishing vs "disconnect from the network" for ransomware). Do not give extreme advice like "do not use your laptop" for low-severity events.

──────────────────────────────────────
INTENT CLASSIFICATION
──────────────────────────────────────
Return exactly ONE of these statuses:

COLLECT
  Use for ANYTHING that is not a completed evidence set, no-ticket decision, or new incident:
  • User is providing information or answering your questions
  • User asks general security questions ("What is ransomware?", "How does phishing work?")
  • User asks hypothetical questions ("Could this spread to other devices?", "What if they
    already have my password?", "Should I be worried?")
  • User expresses concern or asks for reassurance
  • Security terminology appears inside a question, not as a newly reported event
  • User reports a secondary security incident that may be related to the current one (e.g., ransomware after a phishing email). In this case, ask a brief clarification question like: "This appears to be a new security incident that may be related. Would you like me to create a separate incident, or link it to your existing one?"
  After answering a side question, ask the next most important missing evidence question.

READY_FOR_TICKET
  Use when you have gathered sufficient evidence to begin a SOC investigation.
  The objective is NOT to collect every possible field. Evidence quality > quantity.
  If high-value evidence (e.g., sender, clicked link, entered credentials, attachment opened, timeline) is already collected, conclude that enough information exists and return READY_FOR_TICKET.
  Do not continue asking progressively lower-value questions simply because they remain unanswered.
  CRITICAL: Do NOT return READY_FOR_TICKET on the very first message unless the user provides an exhaustively complete report. The default intent is COLLECT.

RESOLVED
  Use when the user explicitly says they do NOT want a ticket created, or the event
  turned out to be a false alarm they confirmed themselves.

TICKET_QUERY
  Use when the user asks about a ticket that was ALREADY CREATED.
  Examples: "What is my incident ticket for?", "What did you log?", "Who is investigating?",
  "What is the status?", "Summarize what you reported."
  Answer using the Active Ticket details above.
  NEVER create another ticket. NEVER return READY_FOR_TICKET for these questions.

NEW_ISSUE
  Use ONLY when the user explicitly confirms they want to create a new, separate ticket for a different problem, or describes a completely unrelated problem.
  If the user reports a potentially related secondary incident (like ransomware on top of phishing), use COLLECT first to ask if they want to link it or create a new ticket.
  Examples that are NEW_ISSUE:
  • "Yes, please create a separate incident for the ransomware." (confirmed separate)
  • "I have a different problem — my laptop screen went black." (unrelated IT issue)
  Examples that are NOT NEW_ISSUE (use COLLECT):
  • "What if ransomware is already on my machine?" (hypothetical)
  • "Could this be related to a phishing attack?" (question about current incident)
  • "What is credential theft?" (educational question)
  • "Should I change all my passwords?" (action question about current incident)
  Include "suggested_tool": "it_support" or "security_incident" when returning NEW_ISSUE.

──────────────────────────────────────
ACTIVE TICKET AWARENESS & DUPLICATE PREVENTION
──────────────────────────────────────
If an Active Ticket already exists in the context above, determine the user's semantic intent regarding tickets:
- HIGH CONFIDENCE SAME ISSUE: If the user refers to the same incident (even if they ask to open a new ticket), return COLLECT. Do NOT return READY_FOR_TICKET.
- HIGH CONFIDENCE NEW ISSUE: If the user describes a completely new, unrelated problem, return NEW_ISSUE.
- REQUESTING INFO: If the user asks about the status or summary of the existing ticket, return TICKET_QUERY.
- LOW CONFIDENCE: If you are genuinely uncertain if they mean the same incident or a new incident, return COLLECT and ask exactly ONE natural clarification question.

IMPORTANT — Do NOT Hardcode:
Any conversational examples (e.g. "create another ticket", "same old problem") are illustrative only. Do not implement keyword-based branching. You must determine semantic intent from the entire workflow context. Short conversational confirmations or negations regarding the incident must be cleanly handled as COLLECT without generating malformed JSON.

──────────────────────────────────────
EVIDENCE COLLECTION LOGIC QUALITY
──────────────────────────────────────
1. Continuously reason over evidence already collected, evidence still missing, and evidence that is now unnecessary. Educational questions and side conversations must never reset your evidence gathering strategy.
2. Extract ALL facts from the user's message — even if they answer multiple fields at once.
   Use the exact field keys from "Evidence still needed" as keys in memory_updates.
3. Handle Unavailable Evidence: If a user says "I deleted the email", "I don't remember", or "The device is gone", treat this as valid evidence! Do not ask for it again. Store a fact (e.g., "email_deleted: true", "sender_available: false") in memory_updates to acknowledge it and move on.
4. Rank Missing Evidence by Investigative Value:
   - High value: credentials entered, attachment executed, malware symptoms, sender, timeline.
   - Medium value: recipient, subject.
   - Low value: exact URL, exact filename, message wording.
   If lower-value evidence is unavailable, continue without it.
5. Ask ONLY ONE question per turn — the single highest-value missing piece of evidence.
6. Briefly explain WHY you need the next piece of information.
   BAD:  "When did this happen?"
   GOOD: "To assess whether containment is urgent, could you tell me approximately when you first noticed this?"
7. Update severity based on what you learn. Severity can increase or decrease.
8. Be calm, professional, and reassuring. The user may be stressed.

──────────────────────────────────────
RETURN FORMAT — strict JSON, no markdown fences
──────────────────────────────────────
{{
    "intent": "COLLECT",
    "reasoning": "one-sentence internal note explaining your decision",
    "assistant_response": "message shown to the user",
    "memory_updates": {{}},
    "severity": "HIGH"
}}

For NEW_ISSUE also include: "suggested_tool": "it_support" or "security_incident"
"""

    # Validate conversation history
    valid_history = []
    for i, msg in enumerate(conversation_history):
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            logger.warning("[reason_soc_incident] Skipping malformed message at index %d: %s", i, msg)
            continue
        valid_history.append(msg)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(valid_history)

    # 1. Log REASONING INPUT
    context_block = f"Incident Type: {incident_type}\nSeverity: {initial_severity}\nEvidence:\n{evidence_lines}\nMissing:\n{missing_lines}\nTicket:\n{ticket_block}"
    logger.info(
        "=================================================\n"
        "REASONING INPUT (SOC_INCIDENT)\n\n"
        "%s\n"
        "=================================================",
        context_block
    )

    try:
        response = client.chat(model=REASONING_MODEL, messages=messages, temperature=0.2)
        raw = response.choices[0].message.content.strip()
        
        # 2. Log RAW LLM RESPONSE
        logger.info(
            "=================================================\n"
            "RAW LLM RESPONSE\n\n"
            "%s\n"
            "=================================================",
            raw
        )
        
        if raw.startswith("```"):
            if not raw.endswith("```"):
                raise ValueError("Markdown fence removal failed: missing closing fence")
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
            
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON parsing failed: {e}")

        # 3. Log PARSED JSON
        logger.info(
            "=================================================\n"
            "PARSED JSON\n\n"
            "%s\n"
            "=================================================",
            json.dumps(data, indent=2)
        )

        if "intent" not in data and "status" not in data:
            raise KeyError("Missing required field: intent")

    except Exception as e:
        logger.error("[reason_soc_incident] LLM/Parser failure: %s - %s", e.__class__.__name__, str(e))
        user_msg = get_user_friendly_error(e)
        return {
            "intent": "COLLECT",
            "assistant_response": user_msg,
            "memory_updates": {},
            "severity": initial_severity.upper() if isinstance(initial_severity, str) else "MEDIUM",
        }


    # Normalise: LLM returns 'intent'; legacy code may return 'status'. Accept both.
    valid_intents = {"COLLECT", "READY_FOR_TICKET", "RESOLVED", "TICKET_QUERY", "NEW_ISSUE"}
    resolved_intent = data.get("intent") or data.get("status")
    
    if resolved_intent not in valid_intents:
        logger.warning("[reason_soc_incident] Invalid intent value '%s', defaulting to COLLECT", resolved_intent)
        resolved_intent = "COLLECT"
        
    data["intent"] = resolved_intent
    data["status"] = resolved_intent
    
    if not data.get("assistant_response"):
        logger.warning("[reason_soc_incident] Missing assistant_response, providing default.")
        data["assistant_response"] = "Could you provide more details?"
        
    if not isinstance(data.get("memory_updates"), dict):
        logger.warning("[reason_soc_incident] memory_updates is not a dictionary. Defaulting to {}.")
        data["memory_updates"] = {}
        
    if data["intent"] == "NEW_ISSUE" and not data.get("suggested_tool"):
        logger.warning("[reason_soc_incident] suggested_tool missing for NEW_ISSUE. Defaulting to security_incident.")
        data["suggested_tool"] = "security_incident"

    sev = str(data.get("severity", initial_severity)).upper()
    if sev not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        logger.warning("[reason_soc_incident] Invalid severity '%s', defaulting to %s", sev, initial_severity.upper())
        sev = initial_severity.upper()
    data["severity"] = sev

    # 4. Log FINAL RESULT
    logger.info(
        "=================================================\n"
        "FINAL RESULT\n\n"
        "%s\n"
        "=================================================",
        json.dumps(data, indent=2)
    )

    return data


def generate_ticket_description(problem: str, facts: dict, attempted: list, history: list, current_user) -> str:
    """Generates a rich, multi-line summary of the ticket context using the LLM."""
    history_lines = "\n".join(f"{msg['role'].upper()}: {msg['content']}" for msg in history)
    facts_lines = "\n".join(f"- {k}: {v}" for k, v in facts.items())
    attempted_lines = "\n".join(f"- {s}" for s in attempted)
    
    prompt = f"""You are an expert IT Helpdesk coordinator writing a ticket description.
Please write a clear, concise, and highly professional ticket description based on the following context.
Do not use markdown formatting (no bold/italics), just use clean line breaks and bullet points.
Include the original problem, the facts extracted, and a summary of the troubleshooting steps that were attempted.

Employee: {current_user.name} ({current_user.email})

Original Problem: {problem}

Extracted Facts:
{facts_lines if facts_lines else "- None"}

Troubleshooting Attempted:
{attempted_lines if attempted_lines else "- None"}

Conversation History (for context):
{history_lines}

YOUR OUTPUT MUST BE EXACTLY THE FINAL TICKET DESCRIPTION TEXT. NO INTRODUCTIONS.
"""
    try:
        response = client.chat(
            model=REASONING_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[generate_ticket_description] error: {e}")
        # Deterministic fallback
        return f"Problem: {problem}\n\nFacts:\n{facts_lines}\n\nAttempted:\n{attempted_lines}"

