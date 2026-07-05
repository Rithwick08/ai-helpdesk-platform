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

logger = logging.getLogger("cyberdesk.llm")

SYSTEM_PROMPT = """
You are CyberDesk AI, an internal Enterprise IT Helpdesk and Cybersecurity Assistant.

You are talking to an authenticated employee:
Name: {user_name}
Email: {user_email}
Role: {user_role}
Department: {user_department}

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

    response = client.chat(
        model=CHAT_MODEL,
        messages=messages,
        temperature=0.2
    )

    result = response.choices[0].message.content.strip()

    # Strip accidental markdown fences
    if result.startswith("```"):
        parts = result.split("```")
        result = parts[1] if len(parts) > 1 else result
        if result.startswith("json"):
            result = result[4:]
        result = result.strip()

    try:
        data = json.loads(result)
    except json.JSONDecodeError:
        logger.warning("[LLM] JSON parse error — raw output: %s", result[:200])
        data = {
            "recommended_tool": None,
            "response": result,
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
