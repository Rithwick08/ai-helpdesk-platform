"""
routes.py — POST /voice/chat  (Voice Pipeline endpoint)

Accepts a multipart/form-data audio file, runs it through the full
voice pipeline (Deepgram STT → CyberShield AI → Sarvam TTS), and
returns the synthesised audio with JSON metadata in custom headers.

Request
-------
    POST /voice/chat
    Authorization: Bearer <jwt>
    Content-Type:  multipart/form-data

    Form fields:
        audio          (file, required)   — the audio recording
        conversation_id (int, optional)   — continue an existing conversation
        session_id      (str, optional)   — voice session continuity token

Response 200 OK
---------------
    Content-Type: audio/wav   (or configured codec's MIME type)
    X-Transcript: <url-encoded transcript text>
    X-Response-Text: <url-encoded AI response text>
    X-Conversation-Id: <int>
    X-Agent-Status: <waiting|completed|chat|cancelled>
    X-Session-Id: <uuid>
    X-Turn-Number: <int>

    <raw audio bytes>

Error responses
---------------
    400  — STT: empty audio / text-to-speech empty text
    401  — invalid JWT / expired Deepgram or Sarvam API key
    408  — pipeline timeout
    413  — audio too large / text too long
    415  — unsupported audio MIME type
    422  — blank transcript / unsupported language
    500  — unexpected failure in any stage
    503  — Deepgram or Sarvam unreachable

Authentication
--------------
    Requires the same Bearer JWT as POST /assistant/chat.
"""

import logging
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from models.user import User
from voice.pipeline.exceptions import AIError, STTError, TTSError, VoicePipelineError
from voice.pipeline.schemas import VoiceResponse
from voice.pipeline.voice_pipeline import process_voice_request
from voice.pipeline.voice_session import VoiceSession

logger = logging.getLogger("cyberdesk.voice.pipeline.routes")

router = APIRouter(
    prefix="/voice",
    tags=["Voice — Pipeline"],
)


def _pipeline_error_to_http(exc: VoicePipelineError) -> HTTPException:
    """Convert a VoicePipelineError into a FastAPI HTTPException."""
    return HTTPException(
        status_code=exc.http_status,
        detail=f"[{exc.stage.upper()}] {str(exc)}",
    )


@router.post(
    "/chat",
    summary="Full voice pipeline: Audio → AI → Audio",
    response_description=(
        "Raw synthesised audio bytes with metadata in response headers."
    ),
    response_class=Response,
    responses={
        200: {
            "content": {"audio/wav": {}, "audio/mpeg": {}},
            "description": (
                "Synthesised speech audio with pipeline metadata in headers: "
                "X-Transcript, X-Response-Text, X-Conversation-Id, "
                "X-Agent-Status, X-Session-Id, X-Turn-Number."
            ),
        }
    },
)
async def voice_chat(
    audio: UploadFile = File(
        ...,
        description=(
            "The voice recording to process. "
            "Supported formats: wav, webm, ogg, mp4, mp3, flac."
        ),
    ),
    conversation_id: Optional[int] = Form(
        default=None,
        description="Continue an existing conversation (omit to start a new one).",
    ),
    session_id: Optional[str] = Form(
        default=None,
        description="Echo back the session_id from a previous response for turn tracking.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """
    Full voice pipeline endpoint.

    Accepts a voice recording, transcribes it with Deepgram, passes the
    transcript to the CyberShield AI agent (same path as the React web UI),
    synthesises the AI response with Sarvam AI, and returns the audio.

    All conversation state (Planner, WorkflowMemory, tool execution, tickets,
    training recommendations) behaves identically to the text interface.

    **Pipeline**: Deepgram STT → **CyberDesk Agent** → Sarvam TTS
    """
    logger.info(
        "[VOICE/CHAT] user=%s | conv=%s | session=%s | file=%s | mime=%s",
        current_user.email,
        conversation_id,
        (session_id or "new")[:8],
        audio.filename,
        audio.content_type,
    )

    # Build or reuse voice session
    voice_session = VoiceSession(
        user_id=current_user.id,
        session_id=session_id or None,
    )

    # ── Run the pipeline ───────────────────────────────────────────────────────
    try:
        result: VoiceResponse = await process_voice_request(
            audio_file=audio,
            current_user=current_user,
            db=db,
            conversation_id=conversation_id,
            session=voice_session,
        )
    except STTError as exc:
        logger.error("[VOICE/CHAT] STT stage failed: %s", exc)
        raise _pipeline_error_to_http(exc)
    except AIError as exc:
        logger.error("[VOICE/CHAT] AI stage failed: %s", exc)
        raise _pipeline_error_to_http(exc)
    except TTSError as exc:
        logger.error("[VOICE/CHAT] TTS stage failed: %s", exc)
        raise _pipeline_error_to_http(exc)
    except VoicePipelineError as exc:
        logger.error("[VOICE/CHAT] Pipeline error: %s", exc)
        raise _pipeline_error_to_http(exc)
    except Exception as exc:
        logger.error("[VOICE/CHAT] Unexpected error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected voice pipeline error occurred.")

    logger.info(
        "[VOICE/CHAT] Success | user=%s | conv=%s | status=%s | bytes=%d",
        current_user.email,
        result.conversation_id,
        result.agent_status,
        len(result.audio_bytes),
    )

    # ── Build response with metadata headers ──────────────────────────────────
    # URL-encode text headers so non-ASCII characters are safely transmitted.
    turn_number = voice_session.last_turn.turn_number if voice_session.last_turn else 1

    return Response(
        content=result.audio_bytes,
        media_type=result.mime_type,
        headers={
            # URL-encoded so non-ASCII (e.g. Hindi text) is safe in headers
            "X-Transcript":        quote(result.transcript,    safe=" "),
            "X-Response-Text":     quote(result.response_text, safe=" "),
            "X-Conversation-Id":   str(result.conversation_id),
            "X-Agent-Status":      result.agent_status,
            "X-Session-Id":        result.session_id,
            "X-Turn-Number":       str(turn_number),
            "Content-Disposition": "inline",
        },
    )
