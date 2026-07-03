"""
transcribe.py — POST /assistant/transcribe

Accepts a multipart/form-data audio upload, transcribes it with Whisper,
and returns the plain text transcript.

This endpoint sits beside the existing /assistant/chat endpoint and is
transport-independent — the frontend MediaRecorder POSTs here, then
immediately sends the transcript to /assistant/chat as a normal text message.

Request
-------
POST /assistant/transcribe
Content-Type: multipart/form-data

Form fields:
    audio   (file, required)   — the recorded audio blob

Response (200 OK)
-----------------
{
    "transcript": "My Outlook won't open"
}

Response (422 / 500) on failure
--------------------------------
{
    "transcript": null,
    "error": "I couldn't understand that. Could you try again?"
}

Authentication
--------------
Requires the same bearer token as /assistant/chat.
"""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from auth.dependencies import get_current_user
from models.user import User
from services.whisper_service import transcribe_audio

logger = logging.getLogger("cyberdesk.transcribe")

router = APIRouter(
    prefix="/assistant",
    tags=["AI Assistant"],
)

_FALLBACK_MSG = "I couldn't understand that. Could you try again?"

# 25 MB hard cap — rejects files too large to be a voice clip
MAX_AUDIO_BYTES = 25 * 1024 * 1024


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(..., description="Audio recording from the browser microphone"),
    current_user: User = Depends(get_current_user),
):
    """
    Transcribe a browser audio recording using local Whisper inference.

    The client uploads the raw audio blob produced by the MediaRecorder API.
    Supported formats: webm (Chrome/Edge), ogg (Firefox), wav, mp4, mp3.
    """
    logger.info(
        "[TRANSCRIBE] user=%s | filename=%s | content_type=%s",
        current_user.email,
        audio.filename,
        audio.content_type,
    )

    # ── Read audio bytes ───────────────────────────────────────────────────────
    try:
        audio_bytes = await audio.read()
    except Exception as exc:
        logger.error("[TRANSCRIBE] Failed to read upload: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"transcript": None, "error": _FALLBACK_MSG},
        )

    if not audio_bytes:
        logger.warning("[TRANSCRIBE] Empty audio upload from user=%s", current_user.email)
        return JSONResponse(
            status_code=422,
            content={"transcript": None, "error": _FALLBACK_MSG},
        )

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        logger.warning("[TRANSCRIBE] Audio too large: %d bytes", len(audio_bytes))
        return JSONResponse(
            status_code=413,
            content={"transcript": None, "error": "Audio recording is too long. Please try a shorter message."},
        )

    # ── Run Whisper ────────────────────────────────────────────────────────────
    content_type = audio.content_type or "audio/webm"
    transcript   = transcribe_audio(audio_bytes, content_type)

    if not transcript:
        logger.info("[TRANSCRIBE] No transcript returned for user=%s", current_user.email)
        return JSONResponse(
            status_code=200,
            content={"transcript": None, "error": _FALLBACK_MSG},
        )

    logger.info(
        "[TRANSCRIBE] Success | user=%s | transcript=%r",
        current_user.email,
        transcript[:80],
    )

    return {"transcript": transcript}
