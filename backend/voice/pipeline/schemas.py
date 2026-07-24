"""
schemas.py — Pydantic models for the Voice Pipeline API.

These schemas define the typed request/response surface for
POST /voice/chat, separate from the AI agent's internal schemas.
"""

from typing import Optional
from pydantic import BaseModel, Field


class VoiceResponse(BaseModel):
    """
    Complete result of one voice pipeline turn.

    Returned by process_voice_request() and used by routes.py to
    build the multipart or JSON+audio HTTP response.
    """

    # ── STT output ─────────────────────────────────────────────────────────────
    transcript: str = Field(
        ...,
        description="Text transcribed from the user's audio by Deepgram.",
    )

    # ── AI output ──────────────────────────────────────────────────────────────
    response_text: str = Field(
        ...,
        description="Text response produced by the CyberShield AI agent.",
    )

    # ── TTS output ─────────────────────────────────────────────────────────────
    audio_bytes: bytes = Field(
        ...,
        description="Raw audio bytes of the synthesised speech from Sarvam AI.",
    )
    mime_type: str = Field(
        ...,
        description="MIME type of the audio (e.g. audio/wav, audio/mpeg).",
    )

    # ── Conversation state ─────────────────────────────────────────────────────
    conversation_id: int = Field(
        ...,
        description="The assistant conversation ID — pass back on the next turn.",
    )
    agent_status: str = Field(
        ...,
        description=(
            "Agent workflow status from the AI layer: "
            "'chat', 'waiting', 'completed', 'cancelled', 'error'."
        ),
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Voice session UUID — pass back on the next turn for session continuity.",
    )

    class Config:
        # Allow bytes field (not JSON-serialisable by default)
        arbitrary_types_allowed = True


class VoiceStatusResponse(BaseModel):
    """Lightweight JSON summary of a voice turn — used as the JSON part of the response."""

    transcript: str
    response_text: str
    conversation_id: int
    agent_status: str
    session_id: Optional[str] = None
    audio_bytes_size: int = Field(
        description="Size in bytes of the returned audio payload."
    )
    mime_type: str
