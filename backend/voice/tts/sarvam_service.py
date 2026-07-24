"""
sarvam_service.py — Sarvam AI Text-to-Speech service for CyberShield AI.

Provides a single async entry-point: generate_speech().

This module is intentionally stateless — all Sarvam AI state lives in the
singleton client (sarvam_client.py).  It can be imported and called from:
  • FastAPI route handlers  (voice/tts/routes.py)
  • The future voice pipeline orchestrator  (Deepgram → AI → Sarvam → Twilio)
  • Test scripts

Sarvam SDK call signature used:
    response = await client.text_to_speech.convert(
        text=<str>,
        target_language_code=<str>,
        speaker=<str>,
        model=<str>,
        output_audio_codec=<str>,
        speech_sample_rate=<int>,
        enable_preprocessing=True,
    )
    audio_bytes = base64.b64decode(response.audios[0])

Supported language codes
------------------------
    bn-IN   Bengali
    en-IN   English (Indian)  ← default for CyberShield AI
    gu-IN   Gujarati
    hi-IN   Hindi
    kn-IN   Kannada
    ml-IN   Malayalam
    mr-IN   Marathi
    od-IN   Odia
    pa-IN   Punjabi
    ta-IN   Tamil
    te-IN   Telugu

Available speakers (bulbul:v3)
------------------------------
    anushka, abhilash, manisha, vidya, arya, karun, hitesh,
    aditya, ritu, priya, neha, rahul, pooja, rohan, simran,
    kavya, amit, dev, ishita, shreya, ratan, varun, manan,
    sumit, roopa, kabir, aayan, shubh, ashutosh, advait,
    anand, tanya, tarun, sunny, mani, gokul, vijay, shruti,
    suhani, mohit, kavitha, rehan, soham, rupali
"""

import base64
import logging
import os
from typing import Optional

from fastapi import HTTPException

from voice.tts.sarvam_client import get_sarvam_client

logger = logging.getLogger("cyberdesk.voice.tts.service")

# ── Configuration — all overridable via .env ───────────────────────────────────
SARVAM_MODEL        = os.getenv("SARVAM_MODEL",        "bulbul:v3")    # latest model
SARVAM_SPEAKER      = os.getenv("SARVAM_SPEAKER",      "aditya")       # default voice (bulbul:v3 compatible)
SARVAM_LANGUAGE     = os.getenv("SARVAM_LANGUAGE",     "en-IN")        # Indian English
SARVAM_AUDIO_CODEC  = os.getenv("SARVAM_AUDIO_CODEC",  "wav")          # wav | mp3 | opus …
SARVAM_SAMPLE_RATE  = int(os.getenv("SARVAM_SAMPLE_RATE",  "22050"))   # Hz
SARVAM_ENABLE_PREPROCESSING = os.getenv("SARVAM_ENABLE_PREPROCESSING", "true").lower() == "true"

# Maximum input text length accepted before we reject at the service layer
MAX_TEXT_CHARS: int = 1000

# Supported language codes (from SDK TextToSpeechLanguage type)
_SUPPORTED_LANGUAGES: frozenset[str] = frozenset(
    {
        "bn-IN",  # Bengali
        "en-IN",  # English (Indian)
        "gu-IN",  # Gujarati
        "hi-IN",  # Hindi
        "kn-IN",  # Kannada
        "ml-IN",  # Malayalam
        "mr-IN",  # Marathi
        "od-IN",  # Odia
        "pa-IN",  # Punjabi
        "ta-IN",  # Tamil
        "te-IN",  # Telugu
    }
)

# MIME type sent back in the HTTP response for each codec
_CODEC_TO_MIME: dict[str, str] = {
    "wav":     "audio/wav",
    "mp3":     "audio/mpeg",
    "opus":    "audio/opus",
    "flac":    "audio/flac",
    "aac":     "audio/aac",
    "linear16": "audio/l16",
    "mulaw":   "audio/basic",
    "alaw":    "audio/alaw",
}


# ── Public helpers ─────────────────────────────────────────────────────────────

def is_supported_language(language_code: str) -> bool:
    """Return True if *language_code* is a Sarvam-supported BCP-47 code."""
    return language_code.strip() in _SUPPORTED_LANGUAGES


def get_audio_mime_type(codec: str) -> str:
    """Return the MIME type string for the configured *codec*."""
    return _CODEC_TO_MIME.get(codec.lower(), "audio/wav")


# ── Core service function ──────────────────────────────────────────────────────

async def generate_speech(
    text: str,
    *,
    speaker: Optional[str] = None,
    language: Optional[str] = None,
    model: Optional[str] = None,
    audio_codec: Optional[str] = None,
    sample_rate: Optional[int] = None,
) -> tuple[bytes, str]:
    """
    Convert *text* to speech using the Sarvam AI bulbul:v3 model.

    All parameters fall back to the values configured in .env when not
    provided, so callers only need to pass overrides (e.g. for per-user
    language selection).

    Parameters
    ----------
    text : str
        The input text to synthesise.  Must be non-empty and ≤ MAX_TEXT_CHARS.
    speaker : str, optional
        Voice name (e.g. ``"anushka"``, ``"aditya"``).
        Defaults to ``SARVAM_SPEAKER`` env var (``"anushka"``).
    language : str, optional
        BCP-47 language code (e.g. ``"en-IN"``, ``"hi-IN"``).
        Defaults to ``SARVAM_LANGUAGE`` env var (``"en-IN"``).
    model : str, optional
        Sarvam model identifier (e.g. ``"bulbul:v3"``).
        Defaults to ``SARVAM_MODEL`` env var.
    audio_codec : str, optional
        Output codec: ``"wav"``, ``"mp3"``, ``"opus"``, ``"flac"`` …
        Defaults to ``SARVAM_AUDIO_CODEC`` env var (``"wav"``).
    sample_rate : int, optional
        Output sample rate in Hz (e.g. ``8000``, ``16000``, ``22050``).
        Defaults to ``SARVAM_SAMPLE_RATE`` env var (``22050``).

    Returns
    -------
    tuple[bytes, str]
        A 2-tuple of ``(audio_bytes, mime_type)`` where *audio_bytes* is the
        raw decoded audio data and *mime_type* is the correct Content-Type
        string for the HTTP response.

    Raises
    ------
    HTTPException 400
        If *text* is empty or only whitespace.
    HTTPException 413
        If *text* exceeds MAX_TEXT_CHARS characters.
    HTTPException 422
        If *language* is not in the supported set.
    HTTPException 401
        If the Sarvam API key is invalid / rejected.
    HTTPException 429
        If the Sarvam API rate limit is exceeded.
    HTTPException 503
        On network / connectivity errors reaching Sarvam.
    HTTPException 500
        On any other unexpected TTS failure.
    """

    # Resolve effective parameters (caller override → env default)
    effective_speaker      = (speaker      or SARVAM_SPEAKER).strip()
    effective_language     = (language     or SARVAM_LANGUAGE).strip()
    effective_model        = (model        or SARVAM_MODEL).strip()
    effective_codec        = (audio_codec  or SARVAM_AUDIO_CODEC).strip().lower()
    effective_sample_rate  = sample_rate   or SARVAM_SAMPLE_RATE

    # ── 1. Validate text ───────────────────────────────────────────────────────
    if not text or not text.strip():
        logger.warning("[TTS] Empty text received.")
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    if len(text) > MAX_TEXT_CHARS:
        logger.warning("[TTS] Text too long: %d chars (limit=%d)", len(text), MAX_TEXT_CHARS)
        raise HTTPException(
            status_code=413,
            detail=f"Text exceeds the maximum allowed length of {MAX_TEXT_CHARS} characters.",
        )

    # ── 2. Validate language ───────────────────────────────────────────────────
    if not is_supported_language(effective_language):
        logger.warning("[TTS] Unsupported language: %s", effective_language)
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported language code: '{effective_language}'. "
                f"Supported codes: {sorted(_SUPPORTED_LANGUAGES)}"
            ),
        )

    logger.info(
        "[TTS] Generating speech | chars=%d | lang=%s | speaker=%s | model=%s | codec=%s",
        len(text),
        effective_language,
        effective_speaker,
        effective_model,
        effective_codec,
    )

    # ── 3. Call Sarvam AI ──────────────────────────────────────────────────────
    try:
        client = get_sarvam_client()

        response = await client.text_to_speech.convert(
            text=text,
            target_language_code=effective_language,
            speaker=effective_speaker,
            model=effective_model,
            output_audio_codec=effective_codec,
            speech_sample_rate=effective_sample_rate,
            enable_preprocessing=SARVAM_ENABLE_PREPROCESSING,
        )

    except EnvironmentError as exc:
        # Missing API key — raised from get_sarvam_client()
        logger.error("[TTS] Configuration error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    except Exception as exc:
        # ── Map Sarvam SDK ApiError → clean HTTP exceptions ────────────────────
        status_code: int | None = getattr(exc, "status_code", None)

        if status_code in (401, 403):
            logger.error("[TTS] Sarvam API key rejected (HTTP %s): %s", status_code, exc)
            raise HTTPException(
                status_code=401,
                detail="Sarvam API key is invalid or has expired. Check SARVAM_API_KEY.",
            ) from exc

        if status_code == 400:
            logger.warning("[TTS] Sarvam bad request (HTTP 400): %s", exc)
            raise HTTPException(
                status_code=400,
                detail=f"Sarvam rejected the request: {getattr(exc, 'body', str(exc))}",
            ) from exc

        if status_code == 422:
            logger.warning("[TTS] Sarvam unprocessable entity (HTTP 422): %s", exc)
            raise HTTPException(
                status_code=422,
                detail=f"Sarvam could not process the request: {getattr(exc, 'body', str(exc))}",
            ) from exc

        if status_code == 429:
            logger.warning("[TTS] Sarvam rate limit hit.")
            raise HTTPException(
                status_code=429,
                detail="Sarvam AI rate limit reached. Please try again shortly.",
            ) from exc

        if status_code == 503 or status_code == 502:
            logger.error("[TTS] Sarvam service unavailable (HTTP %s): %s", status_code, exc)
            raise HTTPException(
                status_code=503,
                detail="Sarvam AI is temporarily unavailable. Please try again shortly.",
            ) from exc

        # Fallback: detect network / connectivity issues by message text
        err_str = str(exc).lower()
        if any(kw in err_str for kw in ("connectionerror", "timeout", "network", "connect")):
            logger.error("[TTS] Network error reaching Sarvam: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=503,
                detail="Unable to reach Sarvam AI. Please try again shortly.",
            ) from exc

        logger.error("[TTS] Unexpected TTS error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Speech generation failed due to an unexpected error.",
        ) from exc

    # ── 4. Decode base64 audio from response ───────────────────────────────────
    # Response shape: response.audios → List[str] (base64-encoded audio)
    try:
        if not response.audios or not response.audios[0]:
            raise ValueError("Sarvam returned an empty audios list.")
        audio_b64: str = response.audios[0]
        audio_bytes: bytes = base64.b64decode(audio_b64)
    except Exception as exc:
        logger.error("[TTS] Failed to decode Sarvam audio response: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Received an unexpected or empty audio response from Sarvam AI.",
        ) from exc

    if not audio_bytes:
        logger.error("[TTS] Decoded audio is empty — zero bytes from Sarvam.")
        raise HTTPException(
            status_code=500,
            detail="Sarvam AI returned an empty audio payload.",
        )

    mime_type = get_audio_mime_type(effective_codec)
    logger.info(
        "[TTS] Speech generated | bytes=%d | mime=%s | request_id=%s",
        len(audio_bytes),
        mime_type,
        getattr(response, "request_id", "n/a"),
    )

    return audio_bytes, mime_type
