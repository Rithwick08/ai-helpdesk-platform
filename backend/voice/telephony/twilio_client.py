"""
twilio_client.py — Singleton Twilio client factory and signature validator.

Reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WEBHOOK_URL
from backend/.env via python-dotenv.

Provides request signature validation for security.
"""

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# ── Load .env from backend root (two levels up) ───────────────────────────────
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

logger = logging.getLogger("cyberdesk.voice.telephony.client")

# ── Environment Variables ──────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "").strip()
TWILIO_WEBHOOK_URL = os.getenv("TWILIO_WEBHOOK_URL", "").strip()

# Enable/disable signature validation (useful in local dev with ngrok)
TWILIO_VALIDATE_SIGNATURE = os.getenv("TWILIO_VALIDATE_SIGNATURE", "false").lower() == "true"

# ── Module Singleton ───────────────────────────────────────────────────────────
_twilio_client = None


def get_twilio_client():
    """
    Return (or lazily initialise) the shared Twilio REST Client singleton.

    Raises
    ------
    EnvironmentError
        If TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing/placeholder.
    RuntimeError
        If the twilio package is not installed.
    """
    global _twilio_client

    if _twilio_client is not None:
        return _twilio_client

    if not TWILIO_ACCOUNT_SID or TWILIO_ACCOUNT_SID == "your_twilio_account_sid_here":
        raise EnvironmentError(
            "TWILIO_ACCOUNT_SID is not set. "
            "Add it to backend/.env and restart the server."
        )

    if not TWILIO_AUTH_TOKEN or TWILIO_AUTH_TOKEN == "your_twilio_auth_token_here":
        raise EnvironmentError(
            "TWILIO_AUTH_TOKEN is not set. "
            "Add it to backend/.env and restart the server."
        )

    try:
        from twilio.rest import Client  # noqa: import-outside-toplevel
    except ImportError as exc:
        raise RuntimeError(
            "twilio package is not installed. Run: pip install twilio"
        ) from exc

    _twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    logger.info("[TWILIO] Client initialised successfully (Account SID: %s***)", TWILIO_ACCOUNT_SID[:6])
    return _twilio_client


def validate_twilio_signature(url: str, params: dict, signature: str) -> bool:
    """
    Validate that an incoming POST request was genuinely sent by Twilio.

    Parameters
    ----------
    url : str
        The full URL of the requested endpoint (e.g. https://xyz.ngrok-free.app/telephony/incoming).
    params : dict
        Dictionary of POST parameters received in the request body.
    signature : str
        The X-Twilio-Signature header value.

    Returns
    -------
    bool
        True if valid or if TWILIO_VALIDATE_SIGNATURE is False (dev override).
    """
    if not TWILIO_VALIDATE_SIGNATURE:
        logger.debug("[TWILIO] Signature validation is disabled (TWILIO_VALIDATE_SIGNATURE=false)")
        return True

    if not signature:
        logger.warning("[TWILIO] Signature validation failed: Missing X-Twilio-Signature header.")
        return False

    if not TWILIO_AUTH_TOKEN:
        logger.error("[TWILIO] Cannot validate signature: TWILIO_AUTH_TOKEN is not configured.")
        return False

    try:
        from twilio.request_validator import RequestValidator  # noqa: import-outside-toplevel

        validator = RequestValidator(TWILIO_AUTH_TOKEN)

        # 1. Primary check against incoming request URL
        if validator.validate(url, params, signature):
            return True

        # 2. Check against configured TWILIO_WEBHOOK_URL (handles ngrok / reverse proxy overrides)
        if TWILIO_WEBHOOK_URL and TWILIO_WEBHOOK_URL != url:
            if validator.validate(TWILIO_WEBHOOK_URL, params, signature):
                return True

        # 3. Check with forced HTTPS if incoming URL scheme was http:// (reverse proxy SSL termination)
        if url.startswith("http://"):
            https_url = "https://" + url[7:]
            if validator.validate(https_url, params, signature):
                return True

        logger.warning(
            "[TWILIO] Signature validation failed for URL=%s | signature=%s",
            url,
            signature[:10] + "...",
        )
        return False

    except Exception as exc:
        logger.error("[TWILIO] Error validating Twilio signature: %s", exc, exc_info=True)
        return False
