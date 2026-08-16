"""
websocket.py — FastAPI WebSocket handler for Twilio Media Streams (/telephony/media).

Endpoint: WS /telephony/media

Twilio Protocol (inbound — Twilio → server):
    1. Connected event: { "event": "connected", ... }
    2. Start event:     { "event": "start", "start": { "streamSid": "MZ...", "callSid": "CA..." } }
    3. Media event:     { "event": "media", "media": { "payload": "b64..." } }
    4. Mark event:      { "event": "mark", "mark": { "name": "..." } }
    5. Stop event:      { "event": "stop", "stop": { "callSid": "CA..." } }

Twilio Protocol (outbound — server → Twilio):
    Media event:        { "event": "media",  "streamSid": "MZ...", "media": { "payload": "b64..." } }
    Mark event:         { "event": "mark",   "streamSid": "MZ...", "mark": { "name": "..." } }
    Clear event:        { "event": "clear",  "streamSid": "MZ..." }  ← flushes Twilio's buffer

Barge-In Architecture
---------------------
TTS frame streaming runs as a concurrent asyncio.Task (_stream_tts_frames).
The main WebSocket receive loop continues to process inbound media events during AI playback.
When sustained caller speech is detected while AI is speaking:
  1. _barge_in_event is set
  2. _stream_tts_frames detects it and stops sending frames
  3. A Twilio "clear" event flushes any already-buffered audio
  4. The caller's utterance is captured and processed normally

State transitions:
  connected → active → processing → speaking → active (normal)
                                  ↘ interrupted → active (barge-in)
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
from voice.stt.streaming import DeepgramStreamer
from voice.telephony.media_stream import process_stream_utterance
from voice.telephony.stream_session import StreamSession

logger = logging.getLogger("cyberdesk.voice.telephony.websocket")

router = APIRouter(
    prefix="/telephony",
    tags=["Voice — Telephony Media Stream"],
)

# ── VAD / silence detection ───────────────────────────────────────────────────
SPEECH_RMS_THRESHOLD = 250          # same as before — do not change
SILENCE_TIMEOUT_SECONDS = 1.2       # seconds of post-speech silence to flush
MAX_TURN_SILENCE_SECONDS = 15.0     # hard maximum

# ── Barge-in confirmation ─────────────────────────────────────────────────────
# Require this many consecutive above-threshold packets while AI is speaking
# before confirming a real barge-in (avoids clicks / breathing / noise).
# Each Twilio media packet ≈ 20ms, so 3 packets ≈ 60ms of sustained speech.
BARGE_IN_SUSTAIN_PACKETS = 3


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


async def _stream_tts_frames(
    websocket: WebSocket,
    session: StreamSession,
    b64_frames: list,
    barge_in_event: asyncio.Event,
) -> bool:
    """
    Stream TTS audio frames to Twilio as an interruptible asyncio.Task.

    Checks barge_in_event before every frame. If the event is set, stops
    immediately and sends a Twilio "clear" event to flush buffered audio.

    Returns
    -------
    bool
        True  — all frames sent normally (AI finished speaking)
        False — interrupted by barge-in
    """
    session.status = "speaking"
    logger.info(
        "[TELEPHONY/TTS] Starting playback | %d frames | call_sid=%s",
        len(b64_frames),
        session.call_sid,
    )

    for i, frame in enumerate(b64_frames):
        # Check for barge-in before every frame
        if barge_in_event.is_set():
            logger.info(
                "[TELEPHONY/BARGE_IN] Interrupting AI response at frame %d/%d | call_sid=%s",
                i, len(b64_frames), session.call_sid,
            )
            # Send Twilio clear event to flush already-buffered audio
            try:
                clear_event = {
                    "event": "clear",
                    "streamSid": session.stream_sid,
                }
                await websocket.send_json(clear_event)
                logger.info(
                    "[TELEPHONY/BARGE_IN] Sent clear event to Twilio | stream_sid=%s",
                    session.stream_sid,
                )
            except Exception as exc:
                logger.warning("[TELEPHONY/BARGE_IN] Failed to send clear event: %s", exc)
            return False

        # Send frame
        try:
            media_event = {
                "event": "media",
                "streamSid": session.stream_sid,
                "media": {"payload": frame},
            }
            await websocket.send_json(media_event)
        except Exception as exc:
            logger.warning("[TELEPHONY/TTS] Failed to send frame %d: %s", i, exc)
            return False

        # 18ms pacing to match real-time mu-law playback
        await asyncio.sleep(0.018)

    # Normal completion — send mark event
    try:
        mark_event = {
            "event": "mark",
            "streamSid": session.stream_sid,
            "mark": {"name": f"turn_{len(session.turns)}"},
        }
        await websocket.send_json(mark_event)
    except Exception as exc:
        logger.warning("[TELEPHONY/TTS] Failed to send mark event: %s", exc)

    logger.info(
        "[TELEPHONY/TTS] Response playback completed | frames=%d | call_sid=%s",
        len(b64_frames), session.call_sid,
    )
    return True


async def _process_and_respond(
    websocket: WebSocket,
    session: StreamSession,
    current_user: User,
    db: Session,
    barge_in_event: asyncio.Event,
) -> Optional[asyncio.Task]:
    """
    Extract buffered audio, process via Voice Pipeline (STT → AI → TTS),
    and launch an interruptible TTS streaming task.

    Returns the asyncio.Task for TTS frame streaming, or None if processing
    failed or produced no audio. The caller is responsible for tracking and
    cancelling this task on barge-in.
    """
    mulaw_bytes = session.get_and_clear_audio_bytes()
    if not mulaw_bytes or len(mulaw_bytes) < 1600:
        return None

    session.status = "processing"

    # ── STT finalization ──────────────────────────────────────────────────────
    transcript = None
    stt_ms = 0
    if session.dg_streamer:
        try:
            t0 = time.monotonic()
            transcript = await session.dg_streamer.finish()
            stt_ms = int((time.monotonic() - t0) * 1000)
            logger.info(
                "[TELEPHONY/WS] Streamer finished. STT overhead=%dms | transcript=%r",
                stt_ms,
                transcript[:80] if transcript else "",
            )
        except Exception as exc:
            logger.warning("[TELEPHONY/WS] Failed to finalize deepgram stream: %s", exc)
            transcript = None

    if transcript is not None and not transcript.strip():
        logger.info("[TELEPHONY/WS] Empty transcript from STT. Dropping utterance to avoid LLM error.")
        session.status = "idle"
        return None

    # ── Voice pipeline (AI + TTS generation) ─────────────────────────────────
    try:
        b64_frames, response_text, conv_id, agent_status = await process_stream_utterance(
            session=session,
            mulaw_bytes=mulaw_bytes,
            current_user=current_user,
            db=db,
            transcript=transcript,
            stt_ms=stt_ms,
        )
    except Exception as exc:
        logger.error("[TELEPHONY/WS] Failed to process stream utterance: %s", exc)
        session.status = "error"
        return None

    if not b64_frames:
        session.status = "active"
        return None

    logger.info(
        "[TELEPHONY/WS] Launching TTS streaming task | %d frames | conv_id=%s",
        len(b64_frames), conv_id,
    )

    # ── Launch TTS as interruptible Task ──────────────────────────────────────
    # Reset barge-in event for this new response
    barge_in_event.clear()

    tts_task = asyncio.create_task(
        _stream_tts_frames(websocket, session, b64_frames, barge_in_event),
        name=f"tts_stream_{session.call_sid}",
    )
    return tts_task


@router.websocket("/media")
async def telephony_media_websocket(websocket: WebSocket):
    """
    WebSocket endpoint handling real-time audio streaming with Twilio Media Streams.

    The main receive loop processes all Twilio events and also monitors for
    barge-in while the TTS task streams audio concurrently.
    """
    await websocket.accept()
    logger.info("[TELEPHONY/WS] WebSocket connected from %s", websocket.client)

    db: Session = SessionLocal()
    session: Optional[StreamSession] = None
    current_user: Optional[User] = None

    # VAD state
    has_speech = False
    last_speech_time = time.monotonic()
    packet_counter = 0
    processing_lock = asyncio.Lock()

    # Barge-in state
    barge_in_event: asyncio.Event = asyncio.Event()
    tts_task: Optional[asyncio.Task] = None        # currently running TTS task
    barge_in_candidate_count: int = 0              # consecutive above-threshold packets while speaking

    try:
        current_user = _get_default_telephony_user(db)

        while True:
            try:
                raw_msg = await websocket.receive_text()
            except WebSocketDisconnect:
                logger.info(
                    "[TELEPHONY/WS] Client disconnected | call_sid=%s",
                    session.call_sid if session else "unknown",
                )
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

            # ── 1. Connected event ────────────────────────────────────────────
            if event_type == "connected":
                logger.info("[TELEPHONY/WS] Twilio connected event received.")
                continue

            # ── 2. Start event ────────────────────────────────────────────────
            elif event_type == "start":
                start_data = data.get("start", {})
                call_sid = start_data.get("callSid", data.get("streamSid", "unknown"))
                stream_sid = data.get("streamSid", start_data.get("streamSid", ""))

                session = StreamSession(call_sid=call_sid, stream_sid=stream_sid)
                has_speech = False
                last_speech_time = time.monotonic()
                packet_counter = 0
                barge_in_event.clear()
                tts_task = None
                barge_in_candidate_count = 0

                logger.info(
                    "[TELEPHONY/WS] Stream started | call_sid=%s | stream_sid=%s",
                    call_sid, stream_sid,
                )

                # Start Deepgram streamer for this call
                try:
                    session.dg_streamer = DeepgramStreamer()
                    await session.dg_streamer.start()
                except Exception as exc:
                    logger.error("[TELEPHONY/WS] Failed to start Deepgram stream: %s", exc)

            # ── 3. Media event ────────────────────────────────────────────────
            elif event_type == "media":
                if session is None:
                    continue

                media = data.get("media", {})
                payload = media.get("payload", "")

                if not payload:
                    continue

                session.add_media_chunk(payload)
                # Only advance to "active" from initial "connected" state.
                # Do NOT overwrite "speaking" / "interrupted" / "processing" —
                # those states are owned by the TTS task and barge-in logic.
                if session.status == "connected":
                    session.status = "active"
                packet_counter += 1

                try:
                    raw_bytes = base64.b64decode(payload)

                    # Always feed inbound audio to Deepgram (caller's voice only)
                    if session.dg_streamer:
                        await session.dg_streamer.send_audio(raw_bytes)

                    # RMS calculation for VAD
                    pcm_16bit = audioop.ulaw2lin(raw_bytes, 2)
                    rms = audioop.rms(pcm_16bit, 2)
                    now = time.monotonic()

                    if packet_counter % 100 == 0:
                        logger.info(
                            "[TELEPHONY/VAD] Packet #%d | RMS=%d | has_speech=%s | status=%s",
                            packet_counter, rms, has_speech, session.status,
                        )

                    # ── Diagnostic: inbound audio arriving while AI speaks ─────
                    if session.status == "speaking" and packet_counter % 50 == 0:
                        logger.info(
                            "[TELEPHONY/BARGE_IN] Inbound media while speaking | packet=%d | RMS=%d | candidates=%d",
                            packet_counter, rms, barge_in_candidate_count,
                        )

                    # ── Barge-in detection while AI is speaking ───────────────
                    if tts_task is not None and not tts_task.done() and session.status == "speaking":
                        if rms > SPEECH_RMS_THRESHOLD:
                            barge_in_candidate_count += 1
                            if barge_in_candidate_count == 1:
                                logger.info(
                                    "[TELEPHONY/BARGE_IN] Potential interruption detected | RMS=%d | call_sid=%s",
                                    rms, session.call_sid,
                                )
                            if barge_in_candidate_count >= BARGE_IN_SUSTAIN_PACKETS:
                                if not barge_in_event.is_set():
                                    logger.info(
                                        "[TELEPHONY/BARGE_IN] Speech confirmed after %d packets | RMS=%d | call_sid=%s",
                                        barge_in_candidate_count, rms, session.call_sid,
                                    )
                                    logger.info(
                                        "[TELEPHONY/BARGE_IN] Cancelling TTS task | call_sid=%s",
                                        session.call_sid,
                                    )
                                    barge_in_event.set()
                                    session.status = "interrupted"
                                    if hasattr(session, "barge_in_count"):
                                        session.barge_in_count += 1
                        else:
                            # Reset candidate count on silence (require sustained speech)
                            barge_in_candidate_count = 0

                    # ── Normal VAD: speech started ────────────────────────────
                    if rms > SPEECH_RMS_THRESHOLD:
                        if not has_speech:
                            logger.info("[TELEPHONY/VAD] 🗣️ Speech STARTED detected | RMS=%d", rms)
                        has_speech = True
                        last_speech_time = now
                    elif has_speech:
                        # ── VAD: silence after speech ─────────────────────────
                        silence_dur = now - last_speech_time

                        # After barge-in is confirmed, the TTS task will stop
                        # itself and the session status becomes "interrupted".
                        # We then wait for the TTS task to finish cancelling
                        # before processing the new utterance.
                        if (
                            silence_dur >= SILENCE_TIMEOUT_SECONDS
                            and session.buffered_bytes_count > 1600
                            # Do not flush while AI is speaking — let barge-in handle it.
                            # Only flush after the TTS task has stopped (speaking→interrupted→active).
                            and session.status not in ("processing", "speaking")
                        ):
                            was_barge_in = session.status == "interrupted"
                            has_speech = False
                            barge_in_candidate_count = 0

                            if was_barge_in:
                                logger.info(
                                    "[TELEPHONY/BARGE_IN] Capturing interrupted caller utterance | bytes=%d",
                                    session.buffered_bytes_count,
                                )
                            else:
                                logger.info(
                                    "[TELEPHONY/VAD] ⏱️ Post-speech silence threshold reached (%.2fs) | "
                                    "Flushing utterance mid-call (%d bytes)...",
                                    silence_dur, session.buffered_bytes_count,
                                )

                            # Wait for any running TTS task to finish/cancel
                            if tts_task is not None and not tts_task.done():
                                try:
                                    await asyncio.wait_for(
                                        asyncio.shield(tts_task),
                                        timeout=0.5,
                                    )
                                except (asyncio.TimeoutError, asyncio.CancelledError):
                                    pass

                            async with processing_lock:
                                tts_task = await _process_and_respond(
                                    websocket, session, current_user, db, barge_in_event,
                                )

                            if was_barge_in:
                                logger.info(
                                    "[TELEPHONY/BARGE_IN] Processing interrupted request | call_sid=%s",
                                    session.call_sid,
                                )

                            # Reset Deepgram for the next turn
                            try:
                                session.dg_streamer = DeepgramStreamer()
                                await session.dg_streamer.start()
                            except Exception as exc:
                                logger.error("[TELEPHONY/WS] Failed to restart Deepgram stream: %s", exc)

                except Exception as exc:
                    logger.warning("[TELEPHONY/VAD] Exception calculating RMS: %s", exc)

            # ── 4. Mark event ─────────────────────────────────────────────────
            elif event_type == "mark":
                mark_name = data.get("mark", {}).get("name", "")
                logger.info(
                    "[TELEPHONY/WS] Mark event received | name=%s | stream_sid=%s",
                    mark_name,
                    session.stream_sid if session else "none",
                )
                # When we receive the mark echo, TTS has finished playing
                if tts_task is not None and tts_task.done():
                    tts_task = None
                    barge_in_event.clear()
                    barge_in_candidate_count = 0
                    if session:
                        session.status = "active"

            # ── 5. Stop event ─────────────────────────────────────────────────
            elif event_type == "stop":
                logger.info(
                    "[TELEPHONY/WS] Stream stop event received | call_sid=%s",
                    session.call_sid if session else "none",
                )

                # Cancel any in-flight TTS task
                if tts_task is not None and not tts_task.done():
                    barge_in_event.set()
                    try:
                        await asyncio.wait_for(asyncio.shield(tts_task), timeout=1.0)
                    except (asyncio.TimeoutError, asyncio.CancelledError):
                        pass

                if session and session.buffered_bytes_count > 1600:
                    async with processing_lock:
                        await _process_and_respond(
                            websocket, session, current_user, db, barge_in_event,
                        )

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
            "[TELEPHONY/WS] Unhandled WebSocket exception: %s", exc, exc_info=True,
        )
    finally:
        # Clean up TTS task
        if tts_task is not None and not tts_task.done():
            barge_in_event.set()
            tts_task.cancel()
            try:
                await tts_task
            except (asyncio.CancelledError, Exception):
                pass

        if session:
            session.close()
        db.close()
