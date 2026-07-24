"""
sarvam_client.py — Singleton AsyncSarvamAI client factory for CyberShield AI.

Reads SARVAM_API_KEY from the backend/.env file via python-dotenv.
All other modules in the voice/tts package should obtain the client
exclusively through get_sarvam_client() to ensure a single instance
is shared for the application lifetime.

Usage
-----
    from voice.tts.sarvam_client import get_sarvam_client

    client = get_sarvam_client()          # returns the singleton
    response = await client.text_to_speech.convert(
        text="...",
        target_language_code="en-IN",
        speaker="anushka",
        model="bulbul:v3",
    )
    audio_bytes = base64.b64decode(response.audios[0])

Environment Variables
---------------------
    SARVAM_API_KEY  (required)
        Your Sarvam AI API subscription key.  Never commit the value;
        keep it in backend/.env.

    SARVAM_BASE_URL  (optional)
        Override the default Sarvam API base URL.
        Default: https://api.sarvam.ai
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# ── Load .env from the backend root (two levels up from this file) ─────────────
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

logger = logging.getLogger("cyberdesk.voice.tts.client")

# ── Module-level singleton ─────────────────────────────────────────────────────
_sarvam_client = None


def get_sarvam_client():
    """
    Return (or lazily initialise) the shared AsyncSarvamAI singleton.

    The client is constructed once and reused for every TTS request,
    which avoids repeated authentication overhead and leverages the
    SDK's internal connection pooling.

    Raises
    ------
    EnvironmentError
        If SARVAM_API_KEY is missing or blank.
    RuntimeError
        If the sarvamai package is not installed.

    Returns
    -------
    AsyncSarvamAI
        The application-wide Sarvam AI async client.
    """
    global _sarvam_client

    if _sarvam_client is not None:
        return _sarvam_client

    # ── Validate API key ───────────────────────────────────────────────────────
    api_key = os.getenv("SARVAM_API_KEY", "").strip()
    if not api_key:
        raise EnvironmentError(
            "SARVAM_API_KEY is not set. "
            "Add it to backend/.env and restart the server."
        )

    # ── Import guard — gives a clear message if the package is missing ─────────
    try:
        from sarvamai import AsyncSarvamAI  # noqa: import-outside-toplevel
    except ImportError as exc:
        raise RuntimeError(
            "sarvamai is not installed. "
            "Run: pip install sarvamai"
        ) from exc

    # ── Optional base URL override ─────────────────────────────────────────────
    base_url = os.getenv("SARVAM_BASE_URL", "").strip() or None

    # ── Construct and cache the singleton ─────────────────────────────────────
    kwargs: dict = {"api_subscription_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url

    _sarvam_client = AsyncSarvamAI(**kwargs)
    logger.info("[SARVAM] AsyncSarvamAI client initialised successfully.")
    return _sarvam_client
