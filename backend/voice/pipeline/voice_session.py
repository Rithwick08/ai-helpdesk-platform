"""
voice_session.py — Lightweight voice-specific session model for CyberShield AI.

Tracks voice-only metadata (audio turns, timing, current state) without
duplicating WorkflowMemory, which remains the authoritative store for
entity collection and workflow state.

VoiceSession lives in memory for the duration of a request chain.
It is serialised to/from the `session_id` opaque token carried in the
HTTP response and echoed back by the client on the next turn.

Design principles
-----------------
• Does NOT replace WorkflowMemory — only adds voice-layer metadata.
• Does NOT store transcripts permanently — only the current-turn preview.
• Stateless-friendly: a session can always be reconstructed from conversation_id.
• Thread-safe: no shared global state; each request owns its own instance.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("cyberdesk.voice.pipeline.session")


@dataclass
class VoiceTurn:
    """Metadata for a single voice request/response cycle."""

    turn_number: int
    transcript: str
    response_text: str
    agent_status: str
    audio_bytes_size: int
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    stt_latency_ms: Optional[int] = None
    ai_latency_ms: Optional[int] = None
    tts_latency_ms: Optional[int] = None

    @property
    def total_latency_ms(self) -> Optional[int]:
        """Total measured pipeline latency, or None if any stage was not timed."""
        parts = [self.stt_latency_ms, self.ai_latency_ms, self.tts_latency_ms]
        if all(p is not None for p in parts):
            return sum(parts)  # type: ignore[arg-type]
        return None


class VoiceSession:
    """
    Lightweight voice-layer session for one user conversation.

    Lifecycle
    ---------
    • Created on the first POST /voice/chat request (no session_id header).
    • Identified by a UUID returned as session_id in the response.
    • The client echoes session_id on subsequent turns so the pipeline
      can log turn numbers and per-session latency trends.
    • Discarded at the end of the conversation (no persistence required).

    Attributes
    ----------
    session_id : str
        UUID v4 identifier for this voice session.
    user_id : int
        The authenticated user's database ID.
    conversation_id : int | None
        The AssistantConversation ID, set after the first AI turn.
    turns : list[VoiceTurn]
        Ordered log of all turns processed in this session.
    created_at : datetime
        UTC timestamp when the session was created.
    last_active_at : datetime
        UTC timestamp of the most recent turn.
    current_state : str
        Most recent agent workflow status ('idle', 'waiting', 'completed', …).
    """

    def __init__(self, user_id: int, session_id: Optional[str] = None):
        self.session_id: str = session_id or str(uuid.uuid4())
        self.user_id: int = user_id
        self.conversation_id: Optional[int] = None
        self.turns: list[VoiceTurn] = []
        self.created_at: datetime = datetime.now(timezone.utc)
        self.last_active_at: datetime = self.created_at
        self.current_state: str = "idle"

        logger.debug(
            "[SESSION] New session | session_id=%s | user_id=%s",
            self.session_id,
            self.user_id,
        )

    # ── Turn management ────────────────────────────────────────────────────────

    def record_turn(
        self,
        *,
        transcript: str,
        response_text: str,
        agent_status: str,
        audio_bytes_size: int,
        stt_latency_ms: Optional[int] = None,
        ai_latency_ms: Optional[int] = None,
        tts_latency_ms: Optional[int] = None,
    ) -> VoiceTurn:
        """Append a completed turn to the session history and return it."""
        turn = VoiceTurn(
            turn_number=len(self.turns) + 1,
            transcript=transcript,
            response_text=response_text,
            agent_status=agent_status,
            audio_bytes_size=audio_bytes_size,
            stt_latency_ms=stt_latency_ms,
            ai_latency_ms=ai_latency_ms,
            tts_latency_ms=tts_latency_ms,
        )
        self.turns.append(turn)
        self.last_active_at = turn.created_at
        self.current_state = agent_status

        logger.info(
            "[SESSION] Turn %d | session=%s | conv=%s | state=%s | "
            "stt=%sms ai=%sms tts=%sms total=%sms",
            turn.turn_number,
            self.session_id[:8],
            self.conversation_id,
            agent_status,
            stt_latency_ms,
            ai_latency_ms,
            tts_latency_ms,
            turn.total_latency_ms,
        )
        return turn

    # ── Accessors ──────────────────────────────────────────────────────────────

    @property
    def turn_count(self) -> int:
        """Total number of completed turns in this session."""
        return len(self.turns)

    @property
    def last_turn(self) -> Optional[VoiceTurn]:
        """Most recent turn, or None if no turns yet."""
        return self.turns[-1] if self.turns else None

    def summary(self) -> dict:
        """Return a loggable/serialisable summary of the session."""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "conversation_id": self.conversation_id,
            "turn_count": self.turn_count,
            "current_state": self.current_state,
            "created_at": self.created_at.isoformat(),
            "last_active_at": self.last_active_at.isoformat(),
        }
