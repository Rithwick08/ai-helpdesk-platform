"""
routes.py — POST /telephony/incoming      (Twilio Incoming Call Webhook)
          — POST /telephony/outbound-call  (Employee-initiated outbound call)

Accepts incoming call webhook requests from Twilio, validates signature,
tracks call metadata via CallSession, and returns TwiML connecting the call to
Twilio Media Streams WebSocket (/telephony/media).

Outbound call endpoint authenticates the employee, reads their registered
phone number, and uses the Twilio REST API to ring their phone.  When
answered, Twilio POSTs to /telephony/incoming which feeds the existing
greeting → Media Stream → Deepgram → AI → Sarvam pipeline without any changes.
"""

import asyncio
import logging
import os
import time
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from models.user import User
from voice.telephony.call_session import CallSession
from voice.telephony.exceptions import TwiMLError
from voice.telephony.twiml import build_error_twiml, build_media_stream_twiml
from voice.telephony.twilio_client import (
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    get_twilio_client,
    validate_twilio_signature,
)

logger = logging.getLogger("cyberdesk.voice.telephony.routes")

router = APIRouter(
    prefix="/telephony",
    tags=["Voice — Telephony"],
)


# ── Incoming Call Webhook ──────────────────────────────────────────────────────

@router.post(
    "/incoming",
    summary="Twilio Incoming Call Webhook",
    response_description="TwiML XML response connecting the call to Twilio Media Stream WebSocket.",
    response_class=Response,
    responses={
        200: {
            "content": {"application/xml": {}},
            "description": "Valid TwiML XML connecting the caller to /telephony/media.",
        }
    },
)
async def incoming_call_webhook(
    request: Request,
    x_twilio_signature: Optional[str] = Header(default=None, alias="X-Twilio-Signature"),
) -> Response:
    """
    Twilio Incoming Call Webhook.

    Validates request, tracks call session metadata, and returns TwiML <Connect><Stream>
    instructing Twilio to stream audio to /telephony/media over WebSockets.
    """
    # ── 1. Parse form data ─────────────────────────────────────────────────────
    try:
        form_data = await request.form()
        params = dict(form_data)
    except Exception as exc:
        logger.error("[TELEPHONY] Failed to parse form data: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid request body.") from exc

    call_sid = params.get("CallSid", "").strip()
    caller_number = params.get("From", "").strip()
    to_number = params.get("To", "").strip()
    call_status = params.get("CallStatus", "ringing")

    logger.info(
        "[TELEPHONY] Incoming call webhook received | call_sid=%s | from=%s | to=%s | status=%s",
        call_sid,
        caller_number,
        to_number,
        call_status,
    )

    if not call_sid:
        logger.warning("[TELEPHONY] Request rejected: missing CallSid parameter.")
        raise HTTPException(status_code=400, detail="Missing required CallSid parameter.")

    # ── 2. Validate Twilio request signature ───────────────────────────────────
    request_url = str(request.url)
    if not validate_twilio_signature(request_url, params, x_twilio_signature or ""):
        logger.warning(
            "[TELEPHONY] Request rejected: invalid signature | url=%s",
            request_url,
        )
        raise HTTPException(status_code=403, detail="Invalid Twilio request signature.")

    # ── 3. Create lightweight CallSession ──────────────────────────────────────
    session = CallSession(
        call_sid=call_sid,
        caller_number=caller_number,
        to_number=to_number,
        status=call_status,
    )

    # ── 4. Construct Media Stream WebSocket URL ────────────────────────────────
    stream_url = _build_stream_url(request)

    # ── 5. Generate Media Stream TwiML ─────────────────────────────────────────
    try:
        twiml_xml = build_media_stream_twiml(stream_url=stream_url)
        session.complete(status="in-progress")

        logger.info(
            "[TELEPHONY] Call %s connected to Media Stream | stream_url=%s",
            call_sid,
            stream_url,
        )

        return Response(
            content=twiml_xml,
            media_type="application/xml",
            headers={"X-Call-Sid": call_sid},
        )

    except TwiMLError as exc:
        logger.error("[TELEPHONY] TwiML error for call %s: %s", call_sid, exc)
        session.complete(status="error")
        err_xml = build_error_twiml("An error occurred during call setup.")
        return Response(content=err_xml, media_type="application/xml", status_code=500)

    except Exception as exc:
        logger.error("[TELEPHONY] Unexpected error for call %s: %s", call_sid, exc, exc_info=True)
        session.complete(status="error")
        err_xml = build_error_twiml("An unexpected system error occurred.")
        return Response(content=err_xml, media_type="application/xml", status_code=500)


# ── Outbound Call ──────────────────────────────────────────────────────────────

@router.post(
    "/outbound-call",
    summary="Initiate Outbound AI Voice Call to Employee",
    response_description="JSON result containing call SID and status.",
)
async def outbound_call(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Employee-initiated outbound call.

    Reads the authenticated employee's registered phone number and uses the
    Twilio REST API (via asyncio.to_thread to avoid blocking the event loop)
    to ring their phone.  When answered, Twilio POSTs to /telephony/incoming
    which feeds the existing greeting → Media Stream → Deepgram → AI → Sarvam
    pipeline without any modifications.
    """

    # ── STEP 1: Endpoint reached ───────────────────────────────────────────────
    logger.info("[OUTBOUND] ━━━ REQUEST RECEIVED ━━━")
    logger.info(
        "[OUTBOUND] Authenticated employee | user_id=%s | email=%s | role=%s",
        current_user.id,
        current_user.email,
        getattr(current_user, "role", "unknown"),
    )

    # ── STEP 2: Phone number lookup ────────────────────────────────────────────
    phone_number = (current_user.phone_number or "").strip()
    logger.info("[OUTBOUND] Employee phone_number from DB = %r", phone_number)
    if not phone_number:
        logger.warning("[OUTBOUND] ✗ Employee ID=%s has no registered phone number.", current_user.id)
        return {
            "success": False,
            "message": "Employee phone number not found. Please add a phone number in your profile settings.",
        }
    logger.info("[OUTBOUND] ✓ Employee phone number resolved: %s", phone_number)

    # ── STEP 3: Build webhook URL ──────────────────────────────────────────────
    incoming_url = _build_incoming_url(request)
    logger.info("[OUTBOUND] ✓ Webhook URL for Twilio call: %s", incoming_url)

    # ── STEP 4: Validate Twilio config ────────────────────────────────────────
    logger.info(
        "[OUTBOUND] Twilio config | ACCOUNT_SID=%s | AUTH_TOKEN=%s | FROM=%s",
        (TWILIO_ACCOUNT_SID[:6] + "***") if TWILIO_ACCOUNT_SID else "NOT SET",
        "***set***" if TWILIO_AUTH_TOKEN else "NOT SET",
        TWILIO_PHONE_NUMBER or "NOT SET",
    )
    if not TWILIO_PHONE_NUMBER:
        logger.error("[OUTBOUND] ✗ TWILIO_PHONE_NUMBER is not configured.")
        raise HTTPException(
            status_code=500,
            detail="Twilio phone number is not configured on the server.",
        )

    # ── STEP 5: Obtain Twilio client ───────────────────────────────────────────
    try:
        client = get_twilio_client()
        logger.info("[OUTBOUND] ✓ Twilio REST client obtained")
    except EnvironmentError as exc:
        logger.error("[OUTBOUND] ✗ Twilio client init failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # ── STEP 6: Place the call ─────────────────────────────────────────────────
    # IMPORTANT: client.calls.create() is a synchronous blocking HTTP call.
    # Running it directly inside an async handler freezes the event loop and
    # causes request timeouts.  We offload it to a thread via asyncio.to_thread.
    logger.info(
        "[OUTBOUND] Creating Twilio call → to=%s | from=%s | url=%s",
        phone_number,
        TWILIO_PHONE_NUMBER,
        incoming_url,
    )
    t_start = time.perf_counter()

    def _create_call():
        return client.calls.create(
            to=phone_number,
            from_=TWILIO_PHONE_NUMBER,
            url=incoming_url,
        )

    try:
        call = await asyncio.to_thread(_create_call)
        elapsed_ms = int((time.perf_counter() - t_start) * 1000)
        logger.info(
            "[OUTBOUND] ✓ Twilio call created | SID=%s | status=%s | elapsed=%dms",
            call.sid,
            call.status,
            elapsed_ms,
        )

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - t_start) * 1000)
        exc_type = type(exc).__name__
        exc_msg  = str(exc)
        tb       = traceback.format_exc()

        # Full TwilioRestException introspection
        try:
            from twilio.base.exceptions import TwilioRestException  # noqa
            if isinstance(exc, TwilioRestException):
                logger.error(
                    "[OUTBOUND] ✗ TwilioRestException after %dms\n"
                    "  http_status = %s\n"
                    "  twilio_code = %s\n"
                    "  message     = %s\n"
                    "  more_info   = %s\n"
                    "  details     = %s",
                    elapsed_ms,
                    getattr(exc, "status",    "N/A"),
                    getattr(exc, "code",      "N/A"),
                    getattr(exc, "msg",       exc_msg),
                    getattr(exc, "more_info", "N/A"),
                    getattr(exc, "details",   "N/A"),
                )
        except ImportError:
            pass

        logger.error(
            "[OUTBOUND] ✗ Exception type=%s | elapsed=%dms | message=%s\nTraceback:\n%s",
            exc_type,
            elapsed_ms,
            exc_msg,
            tb,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Failed to place call via Twilio ({exc_type}): {exc_msg}",
        ) from exc

    logger.info("[OUTBOUND] ━━━ SUCCESS | Call SID=%s ━━━", call.sid)
    return {
        "success": True,
        "call_sid": call.sid,
        "status":   "initiated",
        "message":  "Calling your registered phone number.",
    }


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _build_stream_url(request: Request) -> str:
    """Build the wss:// Media Stream URL from the current request headers."""
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    env_webhook = os.getenv("TWILIO_WEBHOOK_URL", "").strip()

    if forwarded_host and "localhost" not in forwarded_host and "127.0.0.1" not in forwarded_host:
        proto = request.headers.get("x-forwarded-proto", "https")
        ws_proto = "wss" if proto == "https" else "ws"
        return f"{ws_proto}://{forwarded_host}/telephony/media"
    elif env_webhook and "localhost" not in env_webhook and "127.0.0.1" not in env_webhook:
        base_url = env_webhook.rsplit("/", 1)[0]
        return f"{base_url}/media"
    else:
        host = request.url.netloc
        scheme = "wss" if request.url.scheme == "https" else "ws"
        return f"{scheme}://{host}/telephony/media"


def _build_incoming_url(request: Request) -> str:
    """Build the https:// /telephony/incoming URL for outbound call webhook."""
    env_webhook = os.getenv("TWILIO_WEBHOOK_URL", "").strip()

    # Prefer env-configured public URL first
    if env_webhook and "localhost" not in env_webhook and "127.0.0.1" not in env_webhook:
        base = env_webhook.rsplit("/telephony/", 1)[0]
        return f"{base}/telephony/incoming"

    # Fall back to x-forwarded-host (Cloudflare / ngrok reverse proxy header)
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if forwarded_host and "localhost" not in forwarded_host and "127.0.0.1" not in forwarded_host:
        proto = request.headers.get("x-forwarded-proto", "https")
        return f"{proto}://{forwarded_host}/telephony/incoming"

    # Local fallback
    host = request.url.netloc
    scheme = request.url.scheme
    return f"{scheme}://{host}/telephony/incoming"
