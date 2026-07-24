"""
deepgram_client.py — Singleton AsyncDeepgramClient factory for CyberShield AI.

Reads DEEPGRAM_API_KEY from the backend/.env file via python-dotenv.
All other modules in the voice/stt package should obtain the client
exclusively through get_deepgram_client() to ensure a single instance
is shared for the application lifetime.

Usage
-----
    from voice.stt.deepgram_client import get_deepgram_client

    client = get_deepgram_client()          # returns the singleton
    response = await client.listen.v1.rest.v1.transcribe_file(...)

Environment Variables
---------------------
    DEEPGRAM_API_KEY  (required)
        Your Deepgram project API key.  Never commit the value; keep it in .env.
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# ── Load .env from the backend root (two levels up from this file) ─────────────
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

logger = logging.getLogger("cyberdesk.voice.stt.client")

# ── Module-level singleton ─────────────────────────────────────────────────────
_deepgram_client = None


def get_deepgram_client():
    """
    Return (or lazily initialise) the shared AsyncDeepgramClient singleton.

    The client is constructed once and reused for every transcription request,
    which avoids repeated authentication round-trips and keeps connection
    pooling efficient.

    Raises
    ------
    EnvironmentError
        If DEEPGRAM_API_KEY is missing or blank.
    RuntimeError
        If the deepgram-sdk package is not installed.

    Returns
    -------
    AsyncDeepgramClient
        The application-wide Deepgram async client.
    """
    global _deepgram_client

    if _deepgram_client is not None:
        return _deepgram_client

    # ── Validate API key ───────────────────────────────────────────────────────
    api_key = os.getenv("DEEPGRAM_API_KEY", "").strip()
    if not api_key:
        raise EnvironmentError(
            "DEEPGRAM_API_KEY is not set. "
            "Add it to backend/.env and restart the server."
        )

    # ── Import guard — gives a clear message if the package is missing ─────────
    try:
        from deepgram import AsyncDeepgramClient  # noqa: import-outside-toplevel
    except ImportError as exc:
        raise RuntimeError(
            "deepgram-sdk is not installed. "
            "Run: pip install deepgram-sdk"
        ) from exc

    # ── Construct and cache the singleton ─────────────────────────────────────
    _deepgram_client = AsyncDeepgramClient(api_key=api_key)
    logger.info("[DEEPGRAM] AsyncDeepgramClient initialised successfully.")
    return _deepgram_client
