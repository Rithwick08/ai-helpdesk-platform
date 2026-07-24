"""
stream_session.py — Session tracking model for Twilio Media Streams.

Maintains stream-level metadata, timing, packet statistics, and audio buffer
accumulation for a single Twilio telephony call stream.

Design principles
-----------------
• Does NOT replace or duplicate WorkflowMemory or AssistantConversation.
• Manages low-level stream state ('connected', 'active', 'processing', 'speaking', 'stopped').
• Tracks turn count and latency per stream session.
"""

import base64
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("cyberdesk.voice.telephony.stream_session")


@dataclass
class StreamTurn:
    """Turn-level timing and latency metrics for one telephony interaction."""

    turn_number: int
    transcript: str
    response_text: str
    agent_status: str
    audio_bytes_sent: int
    stt_latency_ms: Optional[int] = None
    ai_latency_ms: Optional[int] = None
    tts_latency_ms: Optional[int] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def total_latency_ms(self) -> Optional[int]:
        """Total latency in milliseconds for STT + AI + TTS."""
        parts = [self.stt_latency_ms, self.ai_latency_ms, self.tts_latency_ms]
        if all(p is not None for p in parts):
            return sum(parts)  # type: ignore[arg-type]
        return None


class StreamSession:
    """
    Session container for a Twilio Media Stream WebSocket call connection.

    Attributes
    ----------
    call_sid : str
        Twilio unique Call SID (e.g. 'CA1234567890').
    stream_sid : str
        Twilio unique Stream SID (e.g. 'MZ1234567890').
    voice_session_id : str
        Unique session UUID for voice pipeline logging.
    conversation_id : int | None
        AssistantConversation database ID.
    packet_count : int
        Number of incoming media packets received.
    bytes_received : int
        Total raw mu-law bytes received from Twilio.
    start_time : datetime
        UTC timestamp when stream started.
    end_time : datetime | None
        UTC timestamp when stream stopped/closed.
    status : str
        Stream state ('connected', 'active', 'processing', 'speaking', 'stopped', 'closed').
    """

    def __init__(self, call_sid: str, stream_sid: str = ""):
        self.call_sid: str = call_sid
        self.stream_sid: str = stream_sid
        self.voice_session_id: str = str(uuid.uuid4())
        self.conversation_id: Optional[int] = None
        self.packet_count: int = 0
        self.bytes_received: int = 0
        self.start_time: datetime = datetime.now(timezone.utc)
        self.end_time: Optional[datetime] = None
        self.status: str = "connected"

        # Audio accumulation buffer
        self._mulaw_buffer = bytearray()
        self.turns: list[StreamTurn] = []

        logger.info(
            "[STREAM_SESSION] Created | call_sid=%s | stream_sid=%s | session_id=%s",
            call_sid,
            stream_sid,
            self.voice_session_id[:8],
        )

    def add_media_chunk(self, payload_b64: str) -> None:
        """Decode base64 payload from Twilio media event and append to buffer."""
        try:
            raw_bytes = base64.b64decode(payload_b64)
            self._mulaw_buffer.extend(raw_bytes)
            self.packet_count += 1
            self.bytes_received += len(raw_bytes)
        except Exception as exc:
            logger.warning("[STREAM_SESSION] Failed to decode media payload: %s", exc)

    def get_and_clear_audio_bytes(self) -> bytes:
        """Return all accumulated raw mu-law bytes and reset the buffer."""
        buf = bytes(self._mulaw_buffer)
        self._mulaw_buffer.clear()
        return buf

    @property
    def buffered_bytes_count(self) -> int:
        """Return the number of bytes currently stored in the buffer."""
        return len(self._mulaw_buffer)

    def record_turn(
        self,
        *,
        transcript: str,
        response_text: str,
        agent_status: str,
        audio_bytes_sent: int,
        stt_latency_ms: Optional[int] = None,
        ai_latency_ms: Optional[int] = None,
        tts_latency_ms: Optional[int] = None,
    ) -> StreamTurn:
        """Record turn latency metrics."""
        turn = StreamTurn(
            turn_number=len(self.turns) + 1,
            transcript=transcript,
            response_text=response_text,
            agent_status=agent_status,
            audio_bytes_sent=audio_bytes_sent,
            stt_latency_ms=stt_latency_ms,
            ai_latency_ms=ai_latency_ms,
            tts_latency_ms=tts_latency_ms,
        )
        self.turns.append(turn)
        self.status = agent_status

        logger.info(
            "[STREAM_SESSION] Turn %d | call_sid=%s | conv_id=%s | "
            "stt=%sms ai=%sms tts=%sms total=%sms",
            turn.turn_number,
            self.call_sid,
            self.conversation_id,
            stt_latency_ms,
            ai_latency_ms,
            tts_latency_ms,
            turn.total_latency_ms,
        )
        return turn

    def close(self, status: str = "closed") -> None:
        """Mark stream session as closed."""
        self.end_time = datetime.now(timezone.utc)
        self.status = status
        logger.info(
            "[STREAM_SESSION] Stream closed | call_sid=%s | packets=%d | total_bytes=%d",
            self.call_sid,
            self.packet_count,
            self.bytes_received,
        )

    def summary(self) -> dict:
        """Return serialisable dictionary of stream session statistics."""
        return {
            "call_sid": self.call_sid,
            "stream_sid": self.stream_sid,
            "voice_session_id": self.voice_session_id,
            "conversation_id": self.conversation_id,
            "packet_count": self.packet_count,
            "bytes_received": self.bytes_received,
            "turn_count": len(self.turns),
            "status": self.status,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
        }
