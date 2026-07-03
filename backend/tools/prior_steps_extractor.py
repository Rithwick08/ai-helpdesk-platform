"""
prior_steps_extractor.py — Infer troubleshooting steps the user already completed.

Given:
  - The user's initial message
  - The workflow category (e.g. "outlook", "vpn")
  - The available step IDs for that category

Returns:
  A list of step IDs the user has already tried.

Primary strategy : LLM (Groq, temperature=0, small model)
Fallback strategy: keyword matching against step titles/questions

This module is intentionally side-effect-free:
  - No DB access
  - No state mutation
  - No tool execution
  - No planner integration
  - Can be imported and tested independently
"""

import json
import logging
import re
from typing import Optional

from services.ai_client import client
from config.ai_config import CLASSIFICATION_MODEL
from tools.troubleshooting_workflows import get_workflow

logger = logging.getLogger("cyberdesk.prior_steps")

# ── System prompt sent to the LLM ─────────────────────────────────────────────
_SYSTEM = """\
You are an IT helpdesk assistant reading a user's initial problem report.

Your task: identify which troubleshooting steps the user has ALREADY ATTEMPTED
based on their message.

You will be given:
  1. The user's message
  2. A list of step IDs and their plain-English descriptions

Return ONLY a JSON array of step IDs the user has already tried.
Return [] if no steps have been attempted yet.
Return ONLY valid JSON — no explanation, no markdown, no extra text.

Examples:
  User: "I already restarted Outlook and tried Safe Mode."
  Steps available: restart_outlook, safe_mode, disable_addins, repair_office
  → ["restart_outlook", "safe_mode"]

  User: "I tried reinstalling the VPN client."
  Steps available: internet_check, restart_vpn_client, credential_check, reinstall_vpn
  → ["reinstall_vpn"]

  User: "My Outlook keeps crashing."
  Steps available: restart_outlook, safe_mode, disable_addins
  → []
"""

_USER_TEMPLATE = """\
User message: "{message}"

Available step IDs and descriptions:
{steps_list}

Return a JSON array of step IDs the user has already attempted.\
"""


# ── Keyword fallback table: maps step_id → phrases that indicate it was tried ──
# These phrases are matched case-insensitively against the user message.
_STEP_KEYWORDS: dict[str, list[str]] = {
    # Outlook
    "restart_outlook":   ["restart outlook", "restarted outlook", "closed outlook",
                          "reopened outlook", "close outlook"],
    "safe_mode":         ["safe mode", "/safe", "outlook safe"],
    "disable_addins":    ["disable add-in", "disabled add-in", "removed add-in",
                          "unchecked add-in", "add-in disabled"],
    "repair_office":     ["repair office", "repaired office", "office repair",
                          "quick repair", "online repair"],
    "new_profile":       ["new profile", "created profile", "new outlook profile"],
    "update_office":     ["updated office", "update office", "office update"],
    # VPN
    "internet_check":    ["checked internet", "internet works", "internet is working",
                          "internet fine", "internet connection is fine"],
    "restart_vpn_client": ["restart vpn", "restarted vpn", "reconnect vpn",
                           "disconnected vpn", "closed vpn"],
    "credential_check":  ["re-entered", "re entered credentials", "new credentials",
                          "signed out vpn", "signed back in vpn"],
    "gateway_ping":      ["ping", "pinged gateway", "ping vpn"],
    "vpn_logs":          ["checked logs", "vpn logs", "error code"],
    "network_adapter_reset": ["reset adapter", "disabled adapter", "network adapter",
                              "disable enable adapter"],
    "reinstall_vpn":     ["reinstall vpn", "reinstalled vpn", "uninstall vpn",
                          "fresh install vpn"],
    # Network
    "other_devices":     ["other device", "other devices", "same network"],
    "restart_adapter":   ["restart adapter", "restarted adapter", "disabled adapter"],
    "ipconfig_renew":    ["ipconfig", "renew ip", "release renew"],
    "dns_flush":         ["flush dns", "flushed dns", "ipconfig /flushdns"],
    "winsock_reset":     ["winsock", "netsh winsock"],
    # Printer
    "online_check":      ["printer online", "checked printer", "printer status"],
    "paper_jam_check":   ["paper jam", "checked jam", "no jam", "no toner"],
    "test_print":        ["test print", "test page", "printed test"],
    "restart_spooler":   ["print spooler", "restarted spooler", "spooler restart",
                          "services.msc"],
    "remove_add_printer": ["removed printer", "re-added printer", "readded printer"],
    "reinstall_driver":  ["reinstall driver", "reinstalled driver", "new driver",
                          "downloaded driver"],
    # Teams
    "restart_teams":     ["restart teams", "restarted teams", "quit teams"],
    "sign_out_in":       ["signed out teams", "sign out teams", "logged out teams"],
    "clear_cache":       ["clear teams cache", "cleared cache", "deleted cache",
                          "appdata teams"],
    "network_check":     ["checked internet", "internet fine", "browser works"],
    "update_teams":      ["update teams", "updated teams", "teams update"],
    "reinstall_teams":   ["reinstall teams", "reinstalled teams", "uninstall teams"],
    # Office
    "restart_app":       ["restart app", "restarted app", "closed app", "reopened"],
    "online_repair":     ["online repair", "full repair"],
    # Windows
    "restart_pc":        ["restart pc", "restarted pc", "rebooted", "reboot",
                          "restart computer", "restarted computer"],
    "windows_update":    ["windows update", "updated windows", "install updates"],
    "sfc_scan":          ["sfc /scannow", "sfc scan", "system file checker"],
    "dism_repair":       ["dism", "cleanup-image", "restorehealth"],
    "system_restore":    ["system restore", "restore point", "rollback windows"],
}


def _build_steps_list(category: str) -> str:
    """Build a human-readable list of step_id: description pairs for the LLM."""
    steps = get_workflow(category)
    lines = []
    for step in steps:
        lines.append(f"  {step['id']}: {step['title']}")
    return "\n".join(lines) if lines else "  (no steps)"


def _llm_extract(message: str, category: str, step_ids: list[str]) -> Optional[list[str]]:
    """
    Ask the LLM which step IDs the user already attempted.
    Returns a validated list[str] or None on failure.
    """
    steps_list = _build_steps_list(category)

    try:
        response = client.chat(
            model=CLASSIFICATION_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": _USER_TEMPLATE.format(
                    message=message,
                    steps_list=steps_list,
                )},
            ],
            temperature=0.0,
        )

        raw = response.choices[0].message.content.strip()

        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = re.sub(r"```[a-z]*", "", raw).replace("```", "").strip()

        data = json.loads(raw)

        if not isinstance(data, list):
            logger.warning("[PRIOR_STEPS] LLM returned non-list: %r", data)
            return None

        # Validate: keep only IDs that actually exist in the workflow
        valid = [s for s in data if isinstance(s, str) and s in step_ids]

        logger.info(
            "[PRIOR_STEPS] LLM extracted %d prior steps for category=%s: %s",
            len(valid), category, valid
        )
        return valid

    except json.JSONDecodeError as exc:
        logger.warning("[PRIOR_STEPS] LLM returned invalid JSON: %s", exc)
        return None
    except Exception as exc:
        logger.warning("[PRIOR_STEPS] LLM call failed: %s", exc)
        return None


def _keyword_extract(message: str, step_ids: list[str]) -> list[str]:
    """
    Keyword-based fallback.
    Checks each step_id's known phrases against the lowercased user message.
    """
    lowered = message.lower()
    found   = []

    for step_id in step_ids:
        phrases = _STEP_KEYWORDS.get(step_id, [])
        if any(phrase in lowered for phrase in phrases):
            found.append(step_id)

    logger.info(
        "[PRIOR_STEPS] Keyword fallback found %d prior steps: %s",
        len(found), found
    )
    return found


def extract_prior_steps(user_message: str, category: str) -> list[str]:
    """
    Infer which workflow step IDs the user has already attempted,
    based on their initial problem description.

    Strategy:
      1. Try LLM (fast, temperature=0, validates against known step IDs)
      2. Fallback to keyword matching if LLM fails

    Args:
        user_message: The user's raw first message.
        category:     The resolved workflow category (e.g. "outlook", "vpn").

    Returns:
        A list of step IDs (possibly empty) that the user has already tried.
        These should be pre-loaded into WorkflowMemory as completed + failed.

    Side effects: NONE.
    """
    if not user_message or not user_message.strip():
        return []

    # Build the valid step ID list for this category
    steps    = get_workflow(category)
    step_ids = [s["id"] for s in steps]

    if not step_ids:
        return []

    # Short-circuit: if the message doesn't contain any hint of past attempts,
    # skip the LLM call entirely to save latency.
    PAST_ATTEMPT_SIGNALS = [
        "already", "tried", "attempted", "done", "did", "i've", "i have",
        "restarted", "reinstalled", "repaired", "disabled", "ran", "run",
        "checked", "rebooted", "updated", "uninstalled", "cleared",
        "removed", "flushed", "reset", "restored", "scanned",
    ]
    lowered = user_message.lower()
    has_prior_hint = any(signal in lowered for signal in PAST_ATTEMPT_SIGNALS)

    if not has_prior_hint:
        logger.info("[PRIOR_STEPS] No prior-attempt signals — skipping extraction")
        return []

    # 1. Try LLM
    result = _llm_extract(user_message, category, step_ids)

    # 2. Fallback to keywords
    if result is None:
        result = _keyword_extract(user_message, step_ids)

    return result
