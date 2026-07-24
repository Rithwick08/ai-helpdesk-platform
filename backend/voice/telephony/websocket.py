"""
websocket.py — FastAPI WebSocket handler for Twilio Media Streams (/telephony/media).

Endpoint: WS /telephony/media

Twilio Protocol:
    1. Connected event: { "event": "connected", ... }
    2. Start event:     { "event": "start", "start": { "streamSid": "MZ...", "callSid": "CA..." } }
    3. Media event:     { "event": "media", "media": { "payload": "b64..." } }
    4. Mark event:      { "event": "mark", "mark": { "name": "..." } }
    5. Stop event:      { "event": "stop", "stop": { "callSid": "CA..." } }

Server -> Twilio:
    Media event:        { "event": "media", "streamSid": "MZ...", "media": { "payload": "b64..." } }
    Mark event:         { "event": "mark",  "streamSid": "MZ...", "mark": { "name": "..." } }
    Clear event:        { "event": "clear", "streamSid": "MZ..." }
"""

import asyncio
import audioop
import base64
import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from database import SessionLocal
from models.user import User
from voice.telephony.media_stream import process_stream_utterance
from voice.telephony.stream_session import StreamSession

logger = logging.getLogger("cyberdesk.voice.telephony.websocket")

router = APIRouter(
    prefix="/telephony",
    tags=["Voice — Telephony Media Stream"],
)

# Silence detection threshold for turn submission (in seconds of inactivity)
SILENCE_TIMEOUT_SECONDS = 1.2
# Maximum silence wait per turn (15 seconds)
MAX_TURN_SILENCE_SECONDS = 15.0


def _get_default_telephony_user(db: Session) -> User:
    """Resolve or fallback to a default system user for phone callers."""
    user = db.query(User).first()
    if user is None:
        user = User(
            email="phone_caller@cybershield.ai",
            name="Phone Caller",
            role="Employee",
            department="IT",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.websocket("/media")
async def telephony_media_websocket(websocket: WebSocket):
    """
    WebSocket endpoint handling real-time audio streaming with Twilio Media Streams.
    """
    await websocket.accept()
    logger.info("[TELEPHONY/WS] WebSocket connected from %s", websocket.client)

    db: Session = SessionLocal()
    session: Optional[StreamSession] = None
    current_user: Optional[User] = None

    SPEECH_RMS_THRESHOLD = 250
    has_speech = False
    last_speech_time = time.monotonic()
    packet_counter = 0
    processing_lock = asyncio.Lock()

    try:
        current_user = _get_default_telephony_user(db)

        while True:
            try:
                raw_msg = await websocket.receive_text()
            except WebSocketDisconnect:
                logger.info("[TELEPHONY/WS] Client disconnected | call_sid=%s", session.call_sid if session else "unknown")
                break
            except Exception as exc:
                logger.warning("[TELEPHONY/WS] Exception receiving frame: %s", exc)
                break

            if not raw_msg:
                continue

            try:
                data = json.loads(raw_msg)
            except Exception:
                logger.warning("[TELEPHONY/WS] Malformed JSON text frame received.")
                continue

            event_type = data.get("event")

            # ── 1. Connected event ────────────────────────────────────────────────
            if event_type == "connected":
                logger.info("[TELEPHONY/WS] Twilio connected event received.")
                continue

            # ── 2. Start event ────────────────────────────────────────────────────
            elif event_type == "start":
                start_data = data.get("start", {})
                call_sid = start_data.get("callSid", data.get("streamSid", "unknown"))
                stream_sid = data.get("streamSid", start_data.get("streamSid", ""))

                session = StreamSession(call_sid=call_sid, stream_sid=stream_sid)
                has_speech = False
                last_speech_time = time.monotonic()
                packet_counter = 0

                logger.info(
                    "[TELEPHONY/WS] Stream started | call_sid=%s | stream_sid=%s",
                    call_sid,
                    stream_sid,
                )

            # ── 3. Media event ────────────────────────────────────────────────────
            elif event_type == "media":
                if session is None:
                    continue

                media = data.get("media", {})
                payload = media.get("payload", "")

                if payload:
                    session.add_media_chunk(payload)
                    session.status = "active"
                    packet_counter += 1

                    # Compute RMS volume & evaluate VAD inline
                    try:
                        raw_bytes = base64.b64decode(payload)
                        pcm_16bit = audioop.ulaw2lin(raw_bytes, 2)
                        rms = audioop.rms(pcm_16bit, 2)
                        now = time.monotonic()

                        if packet_counter % 100 == 0:
                            logger.info("[TELEPHONY/VAD] Packet #%d | RMS=%d | has_speech=%s", packet_counter, rms, has_speech)

                        if rms > SPEECH_RMS_THRESHOLD:
                            if not has_speech:
                                logger.info("[TELEPHONY/VAD] 🗣️ Speech STARTED detected | RMS=%d", rms)
                            has_speech = True
                            last_speech_time = now
                        elif has_speech:
                            silence_dur = now - last_speech_time
                            if silence_dur >= SILENCE_TIMEOUT_SECONDS and session.buffered_bytes_count > 1600:
                                logger.info(
                                    "[TELEPHONY/VAD] ⏱️ Post-speech silence threshold reached (%.2fs) | Flushing utterance mid-call (%d bytes)...",
                                    silence_dur,
                                    session.buffered_bytes_count,
                                )
                                has_speech = False
                                async with processing_lock:
                                    await _process_and_respond(websocket, session, current_user, db)
                    except Exception as exc:
                        logger.warning("[TELEPHONY/VAD] Exception calculating RMS: %s", exc)

            # ── 4. Mark event ─────────────────────────────────────────────────────
            elif event_type == "mark":
                mark_name = data.get("mark", {}).get("name", "")
                logger.info(
                    "[TELEPHONY/WS] Mark event received | name=%s | stream_sid=%s",
                    mark_name,
                    session.stream_sid if session else "none",
                )

            # ── 5. Stop event ─────────────────────────────────────────────────────
            elif event_type == "stop":
                logger.info(
                    "[TELEPHONY/WS] Stream stop event received | call_sid=%s",
                    session.call_sid if session else "none",
                )

                if session and session.buffered_bytes_count > 1600:
                    async with processing_lock:
                        await _process_and_respond(websocket, session, current_user, db)

                if session:
                    session.close(status="stopped")
                break

    except WebSocketDisconnect:
        logger.info(
            "[TELEPHONY/WS] Client disconnected | call_sid=%s",
            session.call_sid if session else "unknown",
        )
    except Exception as exc:
        logger.error(
            "[TELEPHONY/WS] Unhandled WebSocket exception: %s",
            exc,
            exc_info=True,
        )
    finally:
        if session:
            session.close()
        db.close()


async def _process_and_respond(
    websocket: WebSocket,
    session: StreamSession,
    current_user: User,
    db: Session,
) -> None:
    """Extract buffered audio, process via Voice Pipeline, and stream media frames back."""
    mulaw_bytes = session.get_and_clear_audio_bytes()
    if not mulaw_bytes or len(mulaw_bytes) < 1600:
        return

    session.status = "processing"

    try:
        b64_frames, response_text, conv_id, agent_status = await process_stream_utterance(
            session=session,
            mulaw_bytes=mulaw_bytes,
            current_user=current_user,
            db=db,
        )
    except Exception as exc:
        logger.error("[TELEPHONY/WS] Failed to process stream utterance: %s", exc)
        session.status = "error"
        return

    if not b64_frames:
        session.status = "active"
        return

    session.status = "speaking"
    logger.info(
        "[TELEPHONY/WS] Streaming %d audio frames to Twilio | conv_id=%d",
        len(b64_frames),
        conv_id,
    )

    # Stream out audio frames with tiny pacing delay (~20ms per frame to match real-time playback)
    for frame in b64_frames:
        media_event = {
            "event": "media",
            "streamSid": session.stream_sid,
            "media": {"payload": frame},
        }
        await websocket.send_json(media_event)
        await asyncio.sleep(0.018)  # 18ms frame pacing

    # Send mark event to signal end of playback
    mark_event = {
        "event": "mark",
        "streamSid": session.stream_sid,
        "mark": {"name": f"turn_{len(session.turns)}"},
    }
    await websocket.send_json(mark_event)

    session.status = "active"
