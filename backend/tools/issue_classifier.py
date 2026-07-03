"""
issue_classifier.py — LLM-powered IT issue category classifier.

Purpose
-------
Predict the category of a user's IT or security problem from their
natural-language message.  This module is intentionally side-effect-free:
  - Does NOT execute any tool
  - Does NOT create tickets, incidents, or password resets
  - Does NOT mutate workflow state or conversation state
  - Can be imported and called independently of any other agent component

Usage
-----
    from tools.issue_classifier import classify_issue

    result = classify_issue("My Outlook keeps crashing when I open an email")
    # → {"category": "outlook", "confidence": 0.94}

Supported categories
--------------------
    outlook, vpn, network, printer, teams, office, windows,
    browser, password_reset, security, unknown
"""

import json
import logging
import re

from services.ai_client import client
from config.ai_config import CLASSIFICATION_MODEL

logger = logging.getLogger("cyberdesk.classifier")

# ── Supported categories ───────────────────────────────────────────────────────
CATEGORIES = [
    "outlook",
    "vpn",
    "network",
    "printer",
    "teams",
    "office",
    "windows",
    "browser",
    "password_reset",
    "security",
    "unknown",
]

# ── LLM prompt ─────────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """You are an IT issue classifier for an enterprise IT helpdesk.

Your ONLY job is to read the user's message and classify it into ONE category.

Supported categories:
- outlook       → Microsoft Outlook email client issues (sync, crash, calendar, attachments)
- vpn           → VPN connection, authentication, slow VPN, disconnects
- network       → Internet, Wi-Fi, LAN, DNS, slow connection (not VPN-specific)
- printer       → Printing, printer not found, paper jam, driver issues
- teams         → Microsoft Teams issues (calls, chat, meetings, screen share)
- office        → Microsoft Office apps other than Outlook/Teams (Word, Excel, PowerPoint, OneNote)
- windows       → Windows OS issues (BSOD, slow PC, Windows Update, permissions, startup)
- browser       → Chrome, Edge, Firefox, Safari issues
- password_reset → Forgotten or expired password, account lockout, MFA issues
- security      → Virus, malware, phishing email, suspicious activity, data breach
- unknown       → Cannot determine from the message

Return ONLY valid JSON. No explanation, no markdown, no extra text.

{"category": "<one of the categories above>", "confidence": <float between 0.0 and 1.0>}"""

_USER_TEMPLATE = 'User message: "{message}"'


# ── Keyword fallback table (used when LLM fails) ───────────────────────────────
_KEYWORD_MAP = {
    "outlook":        ["outlook", "email client", "ost file", "pst file", "calendar sync",
                       "outlook crash", "emails not loading", "mailbox"],
    "vpn":            ["vpn", "virtual private network", "cisco anyconnect", "globalprotect",
                       "pulse secure", "forticlient", "openvpn", "vpn disconnect"],
    "network":        ["internet", "wifi", "wi-fi", "network", "ethernet", "dns",
                       "no connection", "can't connect", "slow internet", "lan"],
    "printer":        ["print", "printer", "paper jam", "toner", "scanner", "driver",
                       "print spooler"],
    "teams":          ["teams", "microsoft teams", "teams call", "teams meeting",
                       "teams crash", "teams not loading"],
    "office":         ["word", "excel", "powerpoint", "onenote", "access", "office",
                       "microsoft 365", "office crash", "activation", "license"],
    "windows":        ["windows", "bsod", "blue screen", "windows update", "startup",
                       "boot", "slow computer", "task manager", "registry", "permission"],
    "browser":        ["chrome", "firefox", "edge", "safari", "browser", "webpage",
                       "website not loading", "extension"],
    "password_reset": ["password", "forgot password", "reset password", "account locked",
                       "lockout", "mfa", "two-factor", "authenticator", "expired password"],
    "security":       ["virus", "malware", "ransomware", "phishing", "suspicious",
                       "hacked", "breach", "spam", "trojan", "spyware"],
}


def _llm_classify(message: str) -> dict | None:
    """
    Ask the LLM to classify the issue.
    Returns a validated dict or None if the LLM call fails or returns bad JSON.
    """
    try:
        response = client.chat(
            model=CLASSIFICATION_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": _USER_TEMPLATE.format(message=message)},
            ],
            temperature=0.0,   # deterministic
        )

        raw = response.choices[0].message.content.strip()

        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = re.sub(r"```[a-z]*", "", raw).replace("```", "").strip()

        data = json.loads(raw)

        category   = str(data.get("category", "unknown")).lower().strip()
        confidence = float(data.get("confidence", 0.0))

        # Validate category is one we support
        if category not in CATEGORIES:
            logger.warning("[CLASSIFIER] LLM returned unknown category %r — using 'unknown'", category)
            category = "unknown"

        # Clamp confidence to [0, 1]
        confidence = max(0.0, min(1.0, confidence))

        logger.info("[CLASSIFIER] LLM → category=%s confidence=%.2f", category, confidence)
        return {"category": category, "confidence": confidence}

    except json.JSONDecodeError as exc:
        logger.warning("[CLASSIFIER] LLM returned invalid JSON: %s", exc)
        return None
    except Exception as exc:
        logger.warning("[CLASSIFIER] LLM call failed: %s", exc)
        return None


def _keyword_classify(message: str) -> dict:
    """
    Lightweight keyword-matching fallback.
    Scores each category by how many keywords are found in the message.
    Returns the best match, or 'unknown' if nothing matches.
    """
    lowered = message.lower()
    scores: dict[str, int] = {}

    for category, keywords in _KEYWORD_MAP.items():
        hit_count = sum(1 for kw in keywords if kw in lowered)
        if hit_count:
            scores[category] = hit_count

    if not scores:
        logger.info("[CLASSIFIER] Keyword fallback → unknown")
        return {"category": "unknown", "confidence": 0.3}

    best_category = max(scores, key=lambda c: scores[c])
    # Confidence heuristic: more keyword hits = higher confidence (capped at 0.75)
    best_score    = min(scores[best_category] / 3.0, 0.75)

    logger.info(
        "[CLASSIFIER] Keyword fallback → category=%s confidence=%.2f (hits=%d)",
        best_category, best_score, scores[best_category]
    )
    return {"category": best_category, "confidence": round(best_score, 2)}


def classify_issue(user_message: str) -> dict:
    """
    Classify a user's IT/security issue into one of the supported categories.

    Strategy:
      1. Try the LLM (fast, small model, temperature=0)
      2. If the LLM fails or returns bad JSON, fall back to keyword matching

    Args:
        user_message: The raw user message (any length).

    Returns:
        {
            "category":   str,    # one of CATEGORIES
            "confidence": float,  # 0.0 – 1.0
        }

    Side effects: NONE — this function is purely predictive.
    """
    if not user_message or not user_message.strip():
        return {"category": "unknown", "confidence": 0.0}

    # Truncate very long messages to keep the LLM prompt lean
    truncated = user_message.strip()[:500]

    # 1. Try LLM
    result = _llm_classify(truncated)

    # 2. Fallback to keywords
    if result is None:
        result = _keyword_classify(truncated)

    return result
