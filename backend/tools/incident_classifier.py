"""
incident_classifier.py — Security incident category classifier.

Classifies a user's natural-language message into a specific
security incident type.

Supported categories
--------------------
    phishing, malware, ransomware, account_compromise, suspicious_login,
    data_loss, usb_device, insider_threat, device_theft, unknown

Strategy
--------
1. LLM (llama-3.1-8b-instant, temperature=0) — primary
2. Keyword matching — fallback if LLM fails or returns invalid JSON

Side effects: NONE
  - No DB access
  - No incident creation
  - No tool execution
  - No state mutation
  - Importable and testable independently

Usage
-----
    from tools.incident_classifier import classify_incident

    result = classify_incident("I got a suspicious email asking for my password")
    # → {"category": "phishing", "confidence": 0.97}
"""

import json
import logging
import re

from services.ai_client import client
from config.ai_config import CLASSIFICATION_MODEL

logger = logging.getLogger("cyberdesk.incident_classifier")

# ── Supported categories ───────────────────────────────────────────────────────
CATEGORIES = [
    "phishing",
    "malware",
    "ransomware",
    "account_compromise",
    "suspicious_login",
    "data_loss",
    "usb_device",
    "insider_threat",
    "device_theft",
    "unknown",
]

# ── Severity map (informational — returned alongside category) ─────────────────
CATEGORY_SEVERITY: dict[str, str] = {
    "phishing":          "Medium",
    "malware":           "High",
    "ransomware":        "Critical",
    "account_compromise":"Critical",
    "suspicious_login":  "High",
    "data_loss":         "High",
    "usb_device":        "Medium",
    "insider_threat":    "Critical",
    "device_theft":      "High",
    "unknown":           "Low",
}

# ── LLM prompt ────────────────────────────────────────────────────────────────
_SYSTEM = """\
You are a cybersecurity incident classifier for an enterprise SOC team.

Your ONLY job: read the employee's report and classify it into exactly ONE category.

Supported categories:
- phishing           → suspicious email, fake link, credential-harvesting email,
                       email asking for passwords or MFA codes
- malware            → virus, trojan, spyware, worm, suspicious executable,
                       antivirus alert, infected file
- ransomware         → files encrypted, ransom note, cannot open files,
                       files renamed with strange extension
- account_compromise → account hacked, someone else logged in, unauthorized access,
                       unknown activity on my account, credentials stolen
- suspicious_login   → login from unknown location/IP/country, unusual sign-in alert,
                       login alert from a device I don't recognise
- data_loss          → accidentally deleted, shared wrong file, data sent to wrong person,
                       accidental data exposure, lost data
- usb_device         → found USB, unknown USB plugged in, USB device left behind,
                       suspicious storage device
- insider_threat     → colleague accessing data they shouldn't, suspicious internal user,
                       employee leaking data, suspicious coworker activity
- device_theft       → laptop stolen, phone stolen, device lost, missing equipment
- unknown            → cannot determine from message

Return ONLY valid JSON. No explanation, no markdown fences, no extra text.
{"category": "<one of the above>", "confidence": <float 0.0–1.0>}"""

_USER_TEMPLATE = 'Employee report: "{message}"'


# ── Keyword fallback ──────────────────────────────────────────────────────────
_KEYWORD_MAP: dict[str, list[str]] = {
    "phishing": [
        "phishing", "suspicious email", "suspicious link", "fake email",
        "credential harvesting", "email asking for password", "email asking for mfa",
        "clicked a link", "suspicious attachment", "spoofed email", "spear phishing",
        "vishing", "smishing", "whaling", "pretexting email", "password via email",
    ],
    "malware": [
        "virus", "malware", "trojan", "spyware", "worm", "keylogger",
        "antivirus alert", "antivirus detected", "infected", "suspicious file",
        "suspicious program", "suspicious process", "strange popup", "adware",
        "rootkit", "backdoor", "infected attachment",
    ],
    "ransomware": [
        "ransomware", "encrypted files", "files encrypted", "ransom note",
        "ransom demand", "cannot open files", "files renamed", "strange extension",
        "pay bitcoin", "pay ransom", "all files locked", "decryption key",
    ],
    "account_compromise": [
        "account hacked", "account compromised", "account breached",
        "someone logged into my account", "unauthorized access", "unknown login",
        "password changed without", "someone else logged in", "account taken over",
        "credentials stolen", "account takeover", "hacked account",
    ],
    "suspicious_login": [
        "suspicious login", "unusual login", "login from unknown",
        "login alert", "sign-in from", "sign in from unknown",
        "unfamiliar device", "unknown location login", "strange country",
        "unrecognised device", "unexpected login",
    ],
    "data_loss": [
        "data loss", "lost data", "accidentally deleted", "deleted files",
        "shared wrong file", "sent to wrong person", "accidental disclosure",
        "data leaked", "exposed data", "data exposure", "sensitive data sent",
        "email sent wrong", "wrong recipient",
    ],
    "usb_device": [
        "usb", "usb drive", "usb stick", "thumb drive", "flash drive",
        "unknown usb", "suspicious usb", "found usb", "plugged in usb",
        "storage device", "external drive found",
    ],
    "insider_threat": [
        "insider threat", "insider", "colleague accessing", "coworker accessing",
        "employee leaking", "suspicious colleague", "employee data theft",
        "internal threat", "data stolen by employee", "suspicious insider",
        "unauthorized internal", "coworker suspicious",
    ],
    "device_theft": [
        "laptop stolen", "phone stolen", "device stolen", "computer stolen",
        "tablet stolen", "device missing", "laptop lost", "lost laptop",
        "lost device", "missing device", "missing laptop", "stolen equipment",
    ],
}


# ── LLM path ──────────────────────────────────────────────────────────────────

def _llm_classify(message: str) -> dict | None:
    """
    Ask the LLM to classify the incident type.
    Returns a validated dict or None on failure.
    """
    try:
        response = client.chat(
            model=CLASSIFICATION_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": _USER_TEMPLATE.format(message=message)},
            ],
            temperature=0.0,
        )

        raw = response.choices[0].message.content.strip()

        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = re.sub(r"```[a-z]*", "", raw).replace("```", "").strip()

        data = json.loads(raw)

        category   = str(data.get("category", "unknown")).lower().strip()
        confidence = float(data.get("confidence", 0.0))

        # Reject categories the model invented
        if category not in CATEGORIES:
            logger.warning(
                "[INCIDENT_CLASSIFIER] LLM returned unsupported category %r — using 'unknown'",
                category,
            )
            category = "unknown"

        confidence = max(0.0, min(1.0, confidence))  # clamp to [0, 1]

        logger.info(
            "[INCIDENT_CLASSIFIER] LLM → category=%s confidence=%.2f",
            category, confidence,
        )
        return {"category": category, "confidence": confidence}

    except json.JSONDecodeError as exc:
        logger.warning("[INCIDENT_CLASSIFIER] LLM returned invalid JSON: %s", exc)
        return None
    except Exception as exc:
        logger.warning("[INCIDENT_CLASSIFIER] LLM call failed: %s", exc)
        return None


# ── Keyword fallback ──────────────────────────────────────────────────────────

def _keyword_classify(message: str) -> dict:
    """
    Score each category by keyword hit count.
    Returns the best match, or 'unknown' if nothing matches.
    Confidence is capped at 0.70 to signal this is a fallback result.
    """
    lowered = message.lower()
    scores:  dict[str, int] = {}

    for category, phrases in _KEYWORD_MAP.items():
        hits = sum(1 for phrase in phrases if phrase in lowered)
        if hits:
            scores[category] = hits

    if not scores:
        logger.info("[INCIDENT_CLASSIFIER] Keyword fallback → unknown (no hits)")
        return {"category": "unknown", "confidence": 0.25}

    best_category = max(scores, key=lambda c: scores[c])
    # Confidence heuristic: more hits = higher confidence, cap at 0.70
    best_confidence = min(scores[best_category] / 3.0, 0.70)

    logger.info(
        "[INCIDENT_CLASSIFIER] Keyword fallback → category=%s confidence=%.2f (hits=%d)",
        best_category, best_confidence, scores[best_category],
    )
    return {"category": best_category, "confidence": round(best_confidence, 2)}


# ── Public API ────────────────────────────────────────────────────────────────

def classify_incident(user_message: str) -> dict:
    """
    Classify a security incident report into one of the supported categories.

    Args:
        user_message: The employee's raw report (any length).

    Returns:
        {
            "category":   str,    # one of CATEGORIES
            "confidence": float,  # 0.0 – 1.0
            "severity":   str,    # "Low" | "Medium" | "High" | "Critical"
        }

    Side effects: NONE.
    """
    if not user_message or not user_message.strip():
        return {"category": "unknown", "confidence": 0.0, "severity": "Low"}

    # Truncate very long messages — keeps the LLM prompt lean
    truncated = user_message.strip()[:600]

    # 1. Try LLM
    result = _llm_classify(truncated)

    # 2. Fallback to keywords
    if result is None:
        result = _keyword_classify(truncated)

    # Attach severity from lookup table
    result["severity"] = CATEGORY_SEVERITY.get(result["category"], "Low")

    return result
