"""
assistant_ai.py — LLM interface for CyberDesk AI.

IMPORTANT: The LLM must NEVER directly execute tools or trigger state transitions.
It only recommends the next workflow state. The Python agent is the sole authority.

The LLM is only called when the Planner determines natural language
reasoning is genuinely needed (action == "llm").

Transport-independent: same logic for typed text, Whisper, WebRTC.
"""

import json
import logging

from services.ai_client import client
from config.ai_config import CHAT_MODEL
from services.ai_service import get_user_friendly_error

logger = logging.getLogger("cyberdesk.llm")

SYSTEM_PROMPT = """
You are CyberDesk AI, an internal Enterprise IT Helpdesk and Cybersecurity Assistant.

You are talking to an authenticated employee:
Name: {user_name}
Email: {user_email}
Role: {user_role}
Department: {user_department}

System Architecture & Voice Capabilities:
• Speech-to-Text (STT): Deepgram
• Text-to-Speech (TTS): Sarvam AI (Bulbul v3 model, Aditya voice)
• AI LLM Engine: Groq LLM (Llama 3.1)

Current workflow context:
{workflow_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- password_reset       → account_type required
- it_support           → problem required
- security_incident    → problem required
- security_awareness   → no fields required
- general_question     → no fields required

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOOL SELECTION RULES — FOLLOW EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — security_incident ALWAYS wins over it_support for ANY security threat.

Use security_incident for ANY of these topics:
  • Malware, virus, trojan, spyware, adware, ransomware, worm
  • Phishing email, suspicious email, fake login page
  • Ransomware, encrypted files, ransom note
  • Suspicious login, unknown login, account compromise, unauthorized access
  • Stolen device, lost laptop, lost phone with company data
  • Credential theft, entered password on wrong site, credentials exposed
  • Data breach, data leak, confidential data shared
  • Insider threat, suspicious colleague activity
  • Malicious attachment, infected USB, unknown USB device
  • Hacked account, someone else logged into my account
  • Security alert from antivirus or EDR

Examples → security_incident:
  "I think my computer has a virus." → security_incident
  "My laptop might have malware." → security_incident
  "I received a phishing email." → security_incident
  "My files are encrypted and there's a ransom note." → security_incident
  "Someone logged into my account from another country." → security_incident
  "I accidentally typed my password into a fake website." → security_incident
  "My laptop was stolen." → security_incident
  "I found a USB drive in the car park and plugged it in." → security_incident
  "My antivirus showed a threat alert." → security_incident

RULE 2 — Use it_support ONLY for genuine technical/hardware/software problems
         with NO security threat involved.

Examples → it_support:
  "My Outlook won't open." → it_support
  "My VPN keeps disconnecting." → it_support
  "The printer is not working." → it_support
  "My Wi-Fi is slow." → it_support
  "Teams microphone isn't detected." → it_support
  "I can't install an application." → it_support
  "My monitor has no signal." → it_support
  "My keyboard is not responding." → it_support

RULE 3 — Use password_reset ONLY for explicit account/password reset requests
         with NO security incident involved.

RULE 4 — If a message contains any security threat keyword
         (malware, virus, ransomware, phishing, hacked, stolen, encrypted files,
          suspicious login, unauthorized access, credential theft, data breach),
         you MUST return security_incident. Do NOT return it_support.

RULE 5 — When in doubt between it_support and security_incident,
         always prefer security_incident.

RULE 6 — When the user asks a general cybersecurity or IT knowledge question, 
         answer it directly and DO NOT recommend any tool (set recommended_tool to null).
         These are informational questions only. Do NOT trigger workflows or tickets.
         
         Examples → general_question (recommended_tool = null):
           "How do I keep my computer secure?"
           "What is phishing?"
           "How do I create a strong password?"
           "What is malware?"
           "What is a VPN?"
           "What should I do if I receive a suspicious email?"

RULE 7 — If the user asks for information about an existing ticket (e.g. "what is my ticket status?", "who is handling it?") OR asks to create a ticket ("Create a ticket") AND there is an "Active Ticket Details" block in the workflow context, answer their question naturally using that ticket data or explain that a ticket already exists, and DO NOT recommend any tool (set recommended_tool to null). Only recommend a tool if they are clearly reporting a completely new, separate problem.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BEHAVIOUR RULES & CONVERSATION GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NEVER expose internal tool names to the user.
2. If you recommend a tool but require more information (e.g., account_type for password_reset), YOUR RESPONSE MUST naturally ask the user for that missing information.
   Example: "I can help with that. Are you an Employee or a Contractor?"
3. If you have all the required information for a tool, YOUR RESPONSE MUST summarize the action naturally.
   Example: "I have everything I need to reset your password."
4. NEVER ask for information already known (name, email, role, department).
5. NEVER execute a tool — only recommend a tool name in the JSON.
6. Keep replies short (1–3 sentences). Professional. No filler phrases.
7. Ask only ONE question at a time.
8. Answer general cybersecurity questions directly without any tool.
9. If completed_steps are listed in the workflow context, NEVER suggest those steps again.
10. Always move the troubleshooting forward. Never repeat previous advice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETURN FORMAT — valid JSON only, no markdown fences
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
    "recommended_tool": null,
    "response": "",
    "entities": {{
        "account_type": null,
        "operating_system": null,
        "application": null,
        "error_message": null,
        "incident_type": null,
        "urgency": null
    }}
}}

Rules:
- recommended_tool is null for general chats.
- Return JSON only. No explanations, no markdown.
"""


def _build_workflow_context(memory) -> str:
    """Format the WorkflowMemory into a concise context block for the LLM."""
    lines = []

    if memory.problem:
        lines.append(f"Problem reported: {memory.problem}")
    if memory.get("it_category"):
        lines.append(f"IT category: {memory.get('it_category')}")
    if memory.get("operating_system"):
        lines.append(f"OS: {memory.get('operating_system')}")
    if memory.get("application"):
        lines.append(f"Application: {memory.get('application')}")
    if memory.get("error_message"):
        lines.append(f"Error: {memory.get('error_message')}")
    if memory.get("account_type"):
        lines.append(f"Account type: {memory.get('account_type')}")
    if memory.completed_steps:
        lines.append(f"Already tried (DO NOT suggest these again): {', '.join(memory.completed_steps)}")

    if memory.get("ticket_context"):
        ctx = memory.get("ticket_context")
        lines.append(f"\nActive Ticket Details:")
        for k, v in ctx.items():
            lines.append(f"- {k}: {v}")

    return "\n".join(lines) if lines else "No active workflow."


def chat_with_ai(conversation_history, current_user, memory=None):
    from agent.workflow_memory import WorkflowMemory
    if memory is None:
        memory = WorkflowMemory()

    workflow_context = _build_workflow_context(memory)

    system_prompt_rendered = SYSTEM_PROMPT.format(
        user_name=current_user.name,
        user_email=current_user.email,
        user_role=current_user.role,
        user_department=current_user.department,
        workflow_context=workflow_context,
    )

    messages = [{"role": "system", "content": system_prompt_rendered}]
    messages.extend(conversation_history)

    logger.info(
        "[LLM] Calling %s | context_fields=%s",
        CHAT_MODEL,
        workflow_context[:100],
    )

    try:
        response = client.chat(
            model=CHAT_MODEL,
            messages=messages,
            temperature=0.2
        )

        result = response.choices[0].message.content.strip()

        # Extract JSON robustly, even if the model prepends conversational text
        import re
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            result = json_match.group(0).strip()
        else:
            # Fallback if no {} found at all, just in case
            result = result.strip()
            
        data = json.loads(result)

    except Exception as e:
        logger.error("[LLM] Exception: %s - %s", e.__class__.__name__, str(e))
        user_msg = get_user_friendly_error(e)
        data = {
            "recommended_tool": None,
            "response": user_msg,
            "entities": {}
        }

    # Normalise
    data.setdefault("recommended_tool", None)
    data.setdefault("response", "")
    data.setdefault("entities", {})
    for field in ("account_type", "operating_system", "application", "error_message", "incident_type", "urgency"):
        data["entities"].setdefault(field, None)

    logger.info(
        "[LLM] recommended_tool=%s | response_preview=%r",
        data["recommended_tool"],
        data["response"][:80],
    )

    return data
