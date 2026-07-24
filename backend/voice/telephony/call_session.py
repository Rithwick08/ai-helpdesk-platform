"""
call_session.py — Lightweight CallSession metadata model for CyberShield AI.

Tracks telephony-specific call metadata (Call SID, caller number, start/end times,
status, duration) without duplicating WorkflowMemory or AssistantConversation.

Design principles
-----------------
• Pure data container for telephony metadata.
• Does NOT replace or duplicate WorkflowMemory or database entities.
• Thread-safe and light-weight.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("cyberdesk.voice.telephony.session")


@dataclass
class CallSession:
    """
    Metadata for a single telephony call turn/session.

    Attributes
    ----------
    call_sid : str
        Twilio unique call identifier (e.g. 'CA1234567890abcdef').
    caller_number : str
        E.164 phone number of the caller (e.g. '+15551234567').
    to_number : str
        Twilio phone number receiving the call.
    start_time : datetime
        UTC timestamp when the incoming call webhook was received.
    end_time : datetime | None
        UTC timestamp when the call ended or TwiML response was sent.
    status : str
        Twilio call status ('ringing', 'in-progress', 'completed', 'failed').
    duration_seconds : int | None
        Call duration in seconds if provided by Twilio.
    """

    call_sid: str
    caller_number: str
    to_number: str = ""
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    status: str = "initiated"
    duration_seconds: Optional[int] = None

    def complete(self, status: str = "completed", duration: Optional[int] = None) -> None:
        """Mark the call session as finished."""
        self.end_time = datetime.now(timezone.utc)
        self.status = status
        if duration is not None:
            self.duration_seconds = duration

        logger.info(
            "[CALL_SESSION] Call %s completed | status=%s | duration=%ss",
            self.call_sid,
            self.status,
            self.duration_seconds if self.duration_seconds is not None else "n/a",
        )

    def to_dict(self) -> dict:
        """Return a JSON-serialisable dictionary representation of the session."""
        return {
            "call_sid": self.call_sid,
            "caller_number": self.caller_number,
            "to_number": self.to_number,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status,
            "duration_seconds": self.duration_seconds,
        }
