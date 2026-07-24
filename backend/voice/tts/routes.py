"""
routes.py — POST /voice/speak  (Sarvam AI TTS endpoint)

Accepts a JSON body with a ``text`` field, delegates synthesis to
sarvam_service.generate_speech(), and streams the audio bytes back
with the correct Content-Type header.

No files are written to disk — the audio is returned directly in the
HTTP response body.

Request
-------
    POST /voice/speak
    Authorization: Bearer <jwt>
    Content-Type:  application/json

    {
        "text": "Your password has been reset successfully."
    }

Optional query parameters (override .env defaults per-request)
--------------------------------------------------------------
    speaker   — voice name      (e.g. aditya, anushka, ritu)
    language  — BCP-47 code     (e.g. en-IN, hi-IN, ta-IN)
    model     — model id        (e.g. bulbul:v3)
    codec     — audio codec     (e.g. wav, mp3, opus)

Response 200 OK
---------------
    Content-Type: audio/wav   (or the configured codec's MIME type)
    <raw audio bytes>

Error responses (from service layer)
--------------------------------------
    400  — empty text input
    401  — invalid or expired Sarvam API key
    413  — text exceeds 1000 characters
    422  — unsupported language code
    429  — Sarvam rate limit
    500  — unexpected server-side failure or bad Sarvam response
    503  — Sarvam unreachable

Authentication
--------------
    Requires the same Bearer JWT as all other CyberShield AI endpoints.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from auth.dependencies import get_current_user
from models.user import User
from voice.tts.sarvam_service import generate_speech

logger = logging.getLogger("cyberdesk.voice.tts.routes")

router = APIRouter(
    prefix="/voice",
    tags=["Voice — TTS"],
)


class SpeakRequest(BaseModel):
    """Request body for the POST /voice/speak endpoint."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="The text to synthesise into speech.",
        examples=["Your password has been reset successfully."],
    )


@router.post(
    "/speak",
    summary="Generate speech with Sarvam AI TTS",
    response_description="Raw audio bytes of the synthesised speech.",
    response_class=Response,
    responses={
        200: {
            "content": {"audio/wav": {}, "audio/mpeg": {}, "audio/opus": {}},
            "description": "Audio bytes of the synthesised speech.",
        }
    },
)
async def voice_speak(
    body: SpeakRequest,
    speaker: Optional[str] = Query(
        default=None,
        description="Override the default voice (e.g. anushka, aditya, ritu).",
    ),
    language: Optional[str] = Query(
        default=None,
        description="Override the language code (e.g. en-IN, hi-IN, ta-IN).",
    ),
    model: Optional[str] = Query(
        default=None,
        description="Override the Sarvam model (e.g. bulbul:v3).",
    ),
    codec: Optional[str] = Query(
        default=None,
        description="Override the output audio codec (e.g. wav, mp3, opus).",
    ),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    Convert text to speech using Sarvam AI bulbul:v3.

    Returns raw audio bytes with the correct ``Content-Type`` header.
    The caller can play this directly in a browser ``<audio>`` element,
    pass it to Twilio, or stream it over WebSocket.

    **Pipeline position**: Deepgram STT → CyberShield AI → **Sarvam TTS** → Twilio
    """
    logger.info(
        "[VOICE/SPEAK] user=%s | chars=%d | speaker=%s | lang=%s",
        current_user.email,
        len(body.text),
        speaker or "default",
        language or "default",
    )

    audio_bytes, mime_type = await generate_speech(
        body.text,
        speaker=speaker,
        language=language,
        model=model,
        audio_codec=codec,
    )

    logger.info(
        "[VOICE/SPEAK] Success | user=%s | bytes=%d | mime=%s",
        current_user.email,
        len(audio_bytes),
        mime_type,
    )

    return Response(
        content=audio_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": "inline",
            "X-Audio-Length-Bytes": str(len(audio_bytes)),
        },
    )
