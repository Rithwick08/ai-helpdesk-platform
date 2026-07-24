"""
deepgram_service.py — Deepgram Speech-to-Text service for CyberShield AI.

Provides a single async entry-point: transcribe_audio().

This module is intentionally stateless — all Deepgram state lives in the
singleton client (deepgram_client.py).  It can be imported and called from:
  • FastAPI route handlers  (voice/stt/routes.py)
  • The future voice pipeline orchestrator  (Deepgram → AI → Sarvam → Twilio)
  • Test scripts

Deepgram SDK v7 call signature used:
    response = await client.listen.v1.media.transcribe_file(
        request=<bytes>,
        model=...,
        language=...,
        smart_format=True,
        punctuate=True,
    )
    transcript = response.results.channels[0].alternatives[0].transcript

Supported audio MIME types
--------------------------
    audio/wav, audio/x-wav, audio/wave
    audio/webm, video/webm
    audio/ogg
    audio/mp4
    audio/mpeg, audio/mp3
    audio/flac, audio/x-flac
    application/octet-stream  (treated as audio/webm fallback)
"""

import logging
import os
from typing import Optional

from fastapi import HTTPException, UploadFile

from voice.stt.deepgram_client import get_deepgram_client

logger = logging.getLogger("cyberdesk.voice.stt.service")

# ── Configuration (overridable via .env) ───────────────────────────────────────
DEEPGRAM_MODEL    = os.getenv("DEEPGRAM_MODEL",    "nova-3")   # latest flagship model
DEEPGRAM_LANGUAGE = os.getenv("DEEPGRAM_LANGUAGE", "en")

# Maximum audio payload accepted before we reject at the service layer (25 MB)
MAX_AUDIO_BYTES: int = 25 * 1024 * 1024

# MIME types we are willing to forward to Deepgram
_SUPPORTED_MIME_TYPES: frozenset[str] = frozenset(
    {
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/webm",
        "video/webm",
        "audio/ogg",
        "audio/mp4",
        "audio/mpeg",
        "audio/mp3",
        "audio/flac",
        "audio/x-flac",
        "application/octet-stream",  # browser fallback
    }
)


# ── Public helpers ─────────────────────────────────────────────────────────────

def is_supported_mime(content_type: str) -> bool:
    """Return True if *content_type* is an accepted audio MIME type."""
    mime = content_type.lower().split(";")[0].strip()
    return mime in _SUPPORTED_MIME_TYPES


def _normalise_mime(content_type: str) -> str:
    """
    Strip parameters (e.g. 'audio/wav; codecs=pcm') and lower-case.

    Falls back to 'audio/webm' for any unrecognised type so that Deepgram
    still attempts decoding rather than failing immediately.
    """
    mime = content_type.lower().split(";")[0].strip()
    return mime if mime in _SUPPORTED_MIME_TYPES else "audio/webm"


# ── Core service function ──────────────────────────────────────────────────────

async def transcribe_audio(audio_file: UploadFile) -> str:
    """
    Transcribe an uploaded audio file using the Deepgram nova-3 model.

    Uses the Deepgram Python SDK v7 ``client.listen.v1.media.transcribe_file()``
    API with raw bytes passed as the ``request`` keyword argument.

    Parameters
    ----------
    audio_file : UploadFile
        A FastAPI ``UploadFile`` instance from a ``multipart/form-data`` request.
        The caller must NOT have already consumed the file stream; this function
        reads it exactly once.

    Returns
    -------
    str
        The transcribed text (never empty — raises on blank results).

    Raises
    ------
    HTTPException 415
        If the MIME type is not in the supported set.
    HTTPException 413
        If the audio payload exceeds MAX_AUDIO_BYTES (25 MB).
    HTTPException 422
        If the upload is empty or Deepgram returns a blank transcript.
    HTTPException 401
        If the Deepgram API key is invalid / rejected.
    HTTPException 503
        On network / connectivity errors reaching Deepgram.
    HTTPException 500
        On any other unexpected transcription failure.
    """

    # ── 1. Validate MIME type ──────────────────────────────────────────────────
    raw_content_type: str = audio_file.content_type or "audio/webm"
    if not is_supported_mime(raw_content_type):
        logger.warning(
            "[STT] Rejected unsupported MIME type: %s | filename=%s",
            raw_content_type,
            audio_file.filename,
        )
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported audio format: '{raw_content_type}'. "
                f"Supported types: {sorted(_SUPPORTED_MIME_TYPES)}"
            ),
        )

    # ── 2. Read bytes ──────────────────────────────────────────────────────────
    try:
        audio_bytes: bytes = await audio_file.read()
    except Exception as exc:
        logger.error("[STT] Failed to read upload stream: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to read uploaded audio.") from exc

    if not audio_bytes:
        logger.warning("[STT] Empty audio payload received (filename=%s)", audio_file.filename)
        raise HTTPException(status_code=422, detail="Uploaded audio file is empty.")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        logger.warning(
            "[STT] Audio payload too large: %d bytes (limit=%d)",
            len(audio_bytes),
            MAX_AUDIO_BYTES,
        )
        raise HTTPException(
            status_code=413,
            detail=f"Audio file too large. Maximum allowed size is {MAX_AUDIO_BYTES // (1024 * 1024)} MB.",
        )

    logger.info(
        "[STT] Transcribing %d bytes | mime=%s | model=%s | lang=%s",
        len(audio_bytes),
        raw_content_type,
        DEEPGRAM_MODEL,
        DEEPGRAM_LANGUAGE,
    )

    # ── 3. Call Deepgram (SDK v7) ──────────────────────────────────────────────
    try:
        client = get_deepgram_client()

        # SDK v7 API: client.listen.v1.media.transcribe_file(request=bytes, **options)
        response = await client.listen.v1.media.transcribe_file(
            request=audio_bytes,
            model=DEEPGRAM_MODEL,
            language=DEEPGRAM_LANGUAGE,
            smart_format=True,   # punctuation + capitalisation
            punctuate=True,
            diarize=False,       # single-speaker voice input
            utterances=False,
        )

    except EnvironmentError as exc:
        # Missing API key — caught from get_deepgram_client()
        logger.error("[STT] Configuration error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    except Exception as exc:
        # ── Detect Deepgram SDK ApiError by status_code ────────────────────────
        status_code: int | None = getattr(exc, "status_code", None)

        if status_code in (401, 403):
            logger.error("[STT] Deepgram API key rejected (HTTP %s): %s", status_code, exc)
            raise HTTPException(
                status_code=401,
                detail="Deepgram API key is invalid or has expired. Check DEEPGRAM_API_KEY.",
            ) from exc

        if status_code == 429:
            logger.warning("[STT] Deepgram rate limit hit.")
            raise HTTPException(
                status_code=429,
                detail="Deepgram rate limit reached. Please try again shortly.",
            ) from exc

        # Fallback: detect network / connectivity issues by message text
        err_str = str(exc).lower()
        if any(kw in err_str for kw in ("connectionerror", "timeout", "network", "connect")):
            logger.error("[STT] Network error reaching Deepgram: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=503,
                detail="Unable to reach Deepgram. Please try again shortly.",
            ) from exc

        logger.error("[STT] Unexpected transcription error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Transcription failed due to an unexpected error.",
        ) from exc

    # ── 4. Extract transcript from SDK v7 response ─────────────────────────────
    # Shape: response.results.channels[0].alternatives[0].transcript
    try:
        transcript: Optional[str] = (
            response.results.channels[0].alternatives[0].transcript
        )
    except (AttributeError, IndexError, TypeError) as exc:
        logger.error("[STT] Unexpected Deepgram response shape: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Received an unexpected response from Deepgram.",
        ) from exc

    if not transcript or not transcript.strip():
        logger.info("[STT] Deepgram returned an empty transcript (silence / noise?).")
        raise HTTPException(
            status_code=422,
            detail="Could not detect speech in the audio. Please try speaking clearly.",
        )

    transcript = transcript.strip()
    logger.info("[STT] Transcription success | chars=%d | preview=%r", len(transcript), transcript[:80])
    return transcript
