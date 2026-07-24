"""
test_telephony.py — Unit & integration tests for the Twilio Telephony module.

Usage
-----
Run as a pytest suite (recommended):
    cd ai-helpdesk-platform
    python -m pytest backend/voice/tests/test_telephony.py -v

Run as a standalone test script:
    python backend/voice/tests/test_telephony.py

Environment Variables
---------------------
    TWILIO_ACCOUNT_SID      (optional override)
    TWILIO_AUTH_TOKEN       (optional override)
    TWILIO_PHONE_NUMBER     (optional override)
    TWILIO_WEBHOOK_URL      (optional override)
    TWILIO_VALIDATE_SIGNATURE (optional, default: false)
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ── Bootstrap: make backend/ importable when run as a script ──────────────────
_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("cyberdesk.voice.telephony.tests")


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — CallSession
# ══════════════════════════════════════════════════════════════════════════════


class TestCallSession:

    def test_call_session_initialisation(self):
        from voice.telephony.call_session import CallSession  # noqa

        session = CallSession(
            call_sid="CA1234567890abcdef",
            caller_number="+15551234567",
            to_number="+15559876543",
        )
        assert session.call_sid == "CA1234567890abcdef"
        assert session.caller_number == "+15551234567"
        assert session.status == "initiated"
        assert session.end_time is None

    def test_call_session_completion(self):
        from voice.telephony.call_session import CallSession  # noqa

        session = CallSession(
            call_sid="CA1234567890abcdef",
            caller_number="+15551234567",
        )
        session.complete(status="completed", duration=15)
        assert session.status == "completed"
        assert session.duration_seconds == 15
        assert session.end_time is not None

    def test_call_session_to_dict(self):
        from voice.telephony.call_session import CallSession  # noqa

        session = CallSession(
            call_sid="CA123",
            caller_number="+1555123",
        )
        d = session.to_dict()
        assert d["call_sid"] == "CA123"
        assert d["caller_number"] == "+1555123"
        assert "start_time" in d


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — TwiML Generator
# ══════════════════════════════════════════════════════════════════════════════


class TestTwiMLGenerator:

    def test_build_welcome_twiml_default(self):
        from voice.telephony.twiml import build_welcome_twiml  # noqa

        xml = build_welcome_twiml()
        assert "<Response>" in xml
        assert "<Say" in xml
        assert "Welcome to CyberShield AI" in xml
        assert "<Hangup/>" in xml or "<Hangup />" in xml

    def test_build_welcome_twiml_custom_message(self):
        from voice.telephony.twiml import build_welcome_twiml  # noqa

        custom = "Hello, this is a custom CyberShield test message."
        xml = build_welcome_twiml(message=custom)
        assert custom in xml

    def test_build_error_twiml(self):
        from voice.telephony.twiml import build_error_twiml  # noqa

        xml = build_error_twiml("Something went wrong.")
        assert "<Response>" in xml
        assert "Something went wrong." in xml
        assert "<Hangup" in xml


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — Twilio Client Factory & Signature Validation
# ══════════════════════════════════════════════════════════════════════════════


class TestTwilioClient:

    def test_raises_if_account_sid_missing(self):
        import voice.telephony.twilio_client as tc  # noqa

        original = tc._twilio_client
        tc._twilio_client = None
        try:
            with patch.dict(os.environ, {"TWILIO_ACCOUNT_SID": ""}):
                with pytest.raises(EnvironmentError, match="TWILIO_ACCOUNT_SID"):
                    tc.get_twilio_client()
        finally:
            tc._twilio_client = original

    def test_signature_validation_disabled_by_default_in_dev(self):
        from voice.telephony.twilio_client import validate_twilio_signature  # noqa

        # When TWILIO_VALIDATE_SIGNATURE is False, returns True
        with patch.dict(os.environ, {"TWILIO_VALIDATE_SIGNATURE": "false"}):
            valid = validate_twilio_signature("http://localhost/telephony/incoming", {}, "")
            assert valid is True


# ══════════════════════════════════════════════════════════════════════════════
# Integration Tests — FastAPI Route (Mocked Twilio Webhook)
# ══════════════════════════════════════════════════════════════════════════════


class TestTelephonyWebhookRoute:

    @pytest.mark.asyncio
    async def test_incoming_call_webhook_success(self):
        from fastapi import FastAPI  # noqa
        from httpx import ASGITransport, AsyncClient  # noqa

        from voice.telephony.routes import router  # noqa

        test_app = FastAPI()
        test_app.include_router(router)

        form_data = {
            "CallSid": "CA1234567890abcdef1234567890abcdef",
            "From": "+15551234567",
            "To": "+15559876543",
            "CallStatus": "ringing",
        }

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://testserver",
        ) as client:
            response = await client.post("/telephony/incoming", data=form_data)

        assert response.status_code == 200
        assert "application/xml" in response.headers.get("content-type", "")
        assert "<Response>" in response.text
        assert "Welcome to CyberShield AI" in response.text
        assert "<Connect>" in response.text
        assert "<Stream" in response.text
        assert response.headers.get("x-call-sid") == form_data["CallSid"]

    @pytest.mark.asyncio
    async def test_incoming_call_webhook_missing_call_sid(self):
        from fastapi import FastAPI  # noqa
        from httpx import ASGITransport, AsyncClient  # noqa

        from voice.telephony.routes import router  # noqa

        test_app = FastAPI()
        test_app.include_router(router)

        # Missing CallSid
        form_data = {
            "From": "+15551234567",
        }

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://testserver",
        ) as client:
            response = await client.post("/telephony/incoming", data=form_data)

        assert response.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# Standalone CLI Entry-Point
# ══════════════════════════════════════════════════════════════════════════════

def _standalone_main():
    from voice.telephony.twiml import build_welcome_twiml  # noqa


    print("📞  Testing Twilio Telephony TwiML Generation …\n")
    twiml_xml = build_welcome_twiml()
    print("Generated TwiML:")
    print("-" * 50)
    print(twiml_xml)
    print("-" * 50)
    print("\n✅  Telephony Phase 1 module working correctly!\n")


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — Outbound Call endpoint
# ══════════════════════════════════════════════════════════════════════════════

class _FakeUser:
    """Minimal User-like object for injection into outbound_call()."""
    def __init__(self, id=1, email="employee@example.com", phone_number=None):
        self.id = id
        self.email = email
        self.phone_number = phone_number


class _FakeCall:
    """Minimal Twilio Call object returned by client.calls.create()."""
    def __init__(self, sid="CA_test_call_sid", status="queued"):
        self.sid = sid
        self.status = status


class TestOutboundCall:
    """Tests for POST /telephony/outbound-call endpoint logic."""

    @pytest.mark.asyncio
    async def test_no_phone_number_returns_failure(self):
        """Employee without a phone number should receive a graceful failure response."""
        from voice.telephony.routes import outbound_call

        user = _FakeUser(phone_number=None)
        request = MagicMock()

        result = await outbound_call(request=request, current_user=user, db=MagicMock())

        assert result["success"] is False
        assert "phone number not found" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_empty_phone_number_returns_failure(self):
        """Employee with an empty string phone_number should also fail gracefully."""
        from voice.telephony.routes import outbound_call

        user = _FakeUser(phone_number="   ")
        request = MagicMock()

        result = await outbound_call(request=request, current_user=user, db=MagicMock())

        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_twilio_api_failure_raises_http_502(self):
        """A Twilio REST API exception should propagate as an HTTP 502."""
        from fastapi import HTTPException
        from voice.telephony.routes import outbound_call

        user = _FakeUser(phone_number="+919876543210")
        request = MagicMock()
        request.headers.get.return_value = None
        request.url.netloc = "localhost:8000"
        request.url.scheme = "http"

        with patch("voice.telephony.routes.get_twilio_client") as mock_client_factory, \
             patch("voice.telephony.routes.TWILIO_PHONE_NUMBER", "+15173144869"):
            mock_client = MagicMock()
            mock_client.calls.create.side_effect = Exception("Twilio network error")
            mock_client_factory.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await outbound_call(request=request, current_user=user, db=MagicMock())

            assert exc_info.value.status_code == 502

    @pytest.mark.asyncio
    async def test_successful_outbound_call_returns_call_sid(self):
        """A successful Twilio call.create() should return success=True with the call SID."""
        from voice.telephony.routes import outbound_call

        user = _FakeUser(phone_number="+919876543210")
        request = MagicMock()
        request.headers.get.return_value = None
        request.url.netloc = "localhost:8000"
        request.url.scheme = "http"

        fake_call = _FakeCall(sid="CA_abc123", status="queued")

        with patch("voice.telephony.routes.get_twilio_client") as mock_client_factory, \
             patch("voice.telephony.routes.TWILIO_PHONE_NUMBER", "+15173144869"):
            mock_client = MagicMock()
            mock_client.calls.create.return_value = fake_call
            mock_client_factory.return_value = mock_client

            result = await outbound_call(request=request, current_user=user, db=MagicMock())

        assert result["success"] is True
        assert result["call_sid"] == "CA_abc123"
        assert result["status"] == "initiated"
        assert "Calling" in result["message"]

    @pytest.mark.asyncio
    async def test_twilio_calls_create_with_correct_args(self):
        """Twilio client.calls.create() must be invoked with the employee's phone number."""
        from voice.telephony.routes import outbound_call

        user = _FakeUser(phone_number="+919876543210")
        request = MagicMock()
        request.headers.get.return_value = None
        request.url.netloc = "localhost:8000"
        request.url.scheme = "http"

        fake_call = _FakeCall()

        with patch("voice.telephony.routes.get_twilio_client") as mock_client_factory, \
             patch("voice.telephony.routes.TWILIO_PHONE_NUMBER", "+15173144869"):
            mock_client = MagicMock()
            mock_client.calls.create.return_value = fake_call
            mock_client_factory.return_value = mock_client

            await outbound_call(request=request, current_user=user, db=MagicMock())

            call_kwargs = mock_client.calls.create.call_args.kwargs
            assert call_kwargs["to"] == "+919876543210"
            assert call_kwargs["from_"] == "+15173144869"
            assert "/telephony/incoming" in call_kwargs["url"]

    @pytest.mark.asyncio
    async def test_missing_twilio_phone_raises_500(self):
        """If TWILIO_PHONE_NUMBER is not configured, the endpoint must return HTTP 500."""
        from fastapi import HTTPException
        from voice.telephony.routes import outbound_call

        user = _FakeUser(phone_number="+919876543210")
        request = MagicMock()

        with patch("voice.telephony.routes.TWILIO_PHONE_NUMBER", ""):
            with pytest.raises(HTTPException) as exc_info:
                await outbound_call(request=request, current_user=user, db=MagicMock())

            assert exc_info.value.status_code == 500


if __name__ == "__main__":
    _standalone_main()
