"""
exceptions.py — Telephony error hierarchy for CyberShield AI.

All telephony-specific exceptions extend TelephonyError so callers can
catch the base class when stage-specific details aren't needed.

Hierarchy
---------
TelephonyError
├── InvalidSignatureError  — Twilio webhook signature validation failed
├── TwiMLError             — Failure during TwiML XML generation
└── TelephonyClientError   — Twilio REST API client error
"""


class TelephonyError(Exception):
    """Base class for all telephony failures."""

    def __init__(self, message: str, http_status: int = 500):
        super().__init__(message)
        self.http_status = http_status


class InvalidSignatureError(TelephonyError):
    """Raised when a Twilio webhook signature check fails."""

    def __init__(self, message: str = "Invalid Twilio signature."):
        super().__init__(message, http_status=403)


class TwiMLError(TelephonyError):
    """Raised when TwiML generation fails."""

    def __init__(self, message: str = "Failed to generate TwiML."):
        super().__init__(message, http_status=500)


class TelephonyClientError(TelephonyError):
    """Raised when Twilio client configuration or API call fails."""

    def __init__(self, message: str = "Twilio client error."):
        super().__init__(message, http_status=500)
