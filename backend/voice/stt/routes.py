"""
routes.py — POST /voice/transcribe  (Deepgram STT endpoint)

Accepts a multipart/form-data audio file, delegates transcription to
deepgram_service.transcribe_audio(), and returns a JSON transcript.

All validation and error handling is performed inside the service layer;
this router is intentionally thin.

Request
-------
    POST /voice/transcribe
    Authorization: Bearer <jwt>
    Content-Type:  multipart/form-data

    Form fields:
        audio  (file, required) — recorded audio blob

Response 200 OK
---------------
    { "transcript": "reset my VPN password" }

Error responses (from service layer)
--------------------------------------
    401  — invalid or expired Deepgram API key
    413  — audio payload exceeds 25 MB
    415  — unsupported audio MIME type
    422  — empty upload or blank transcript (silence)
    500  — unexpected server-side failure
    503  — Deepgram unreachable

Authentication
--------------
    Requires the same Bearer JWT as all other CyberShield AI endpoints.
    Remove the Depends(get_current_user) if you want a public endpoint.
"""

import logging

from fastapi import APIRouter, Depends, File, UploadFile

from auth.dependencies import get_current_user
from models.user import User
from voice.stt.deepgram_service import transcribe_audio

logger = logging.getLogger("cyberdesk.voice.stt.routes")

router = APIRouter(
    prefix="/voice",
    tags=["Voice — STT"],
)


@router.post(
    "/transcribe",
    summary="Transcribe audio with Deepgram STT",
    response_description="Plain-text transcript of the uploaded audio.",
)
async def voice_transcribe(
    audio: UploadFile = File(
        ...,
        description=(
            "Audio recording to transcribe. "
            "Supported formats: wav, webm, ogg, mp4, mp3, flac."
        ),
    ),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Transcribe a voice recording using Deepgram nova-3.

    The endpoint accepts a raw audio blob from the browser's MediaRecorder API
    or any supported audio file.  After transcription the caller can forward
    the transcript to ``POST /assistant/chat`` as a normal text message.

    **Pipeline position**: User Voice → **Deepgram STT** → CyberShield AI → Sarvam TTS
    """
    logger.info(
        "[VOICE/TRANSCRIBE] user=%s | filename=%s | content_type=%s",
        current_user.email,
        audio.filename,
        audio.content_type,
    )

    transcript = await transcribe_audio(audio)

    logger.info(
        "[VOICE/TRANSCRIBE] Success | user=%s | preview=%r",
        current_user.email,
        transcript[:80],
    )

    return {"transcript": transcript}
