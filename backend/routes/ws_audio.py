"""
ws_audio.py — WebSocket endpoint for streaming audio → Whisper → Chat.

Endpoint: WS /ws/assistant/audio

Protocol
--------
Client sends:
  1. TEXT frame: JSON session-init message
     { "conversation_id": <int|null>, "token": "<jwt>" }

  2. BINARY frames: raw audio chunks (webm/opus, ogg, wav — any format Whisper accepts)
     Chunks arrive as the MediaRecorder fires timeslice events (~250 ms each).

  3. TEXT frame: JSON end-of-utterance signal
     { "type": "stop" }

Server responds:
  After "stop" is received and Whisper transcribes the buffered audio:
  { "type": "transcript",  "transcript": "...",   "conversation_id": <int> }
  { "type": "response",    "response": "...",      "status": "waiting"|"completed",
    "conversation_id": <int>, "action_card": {...} | null }

  On any error:
  { "type": "error", "message": "..." }

Session lifecycle
-----------------
  - One WebSocket = one recording session (one utterance).
  - The conversationId carries over across sessions (client remembers it).
  - Auth is done via the JSON init frame (not headers) so browsers don't
    need custom WS headers.

Fallback
--------
  If the WebSocket cannot connect, the frontend falls back to the existing
  POST /assistant/transcribe + POST /assistant/chat HTTP endpoints.
  This file does NOT affect those endpoints.
"""

import asyncio
import io
import json
import logging
from functools import partial
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from services.whisper_service import transcribe_audio, WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE
from services.voice_perf import VoicePerf
from auth.security import SECRET_KEY, ALGORITHM
from agent.agent import CyberDeskAgent
from agent.assistant_ai import chat_with_ai
from agent.planner import Planner
from agent.workflow_memory import WorkflowMemory
from agent.states import ConversationState
from models.user import User
from models.assistant_conversation import AssistantConversation
from models.assistant_message import AssistantMessage
from schemas.assistant import ChatRequest

logger = logging.getLogger("cyberdesk.ws_audio")

router = APIRouter(tags=["Voice WebSocket"])

# Maximum accumulated audio size per utterance (10 MB)
MAX_AUDIO_BYTES = 10 * 1024 * 1024


@router.websocket("/ws/assistant/audio")
async def ws_audio(websocket: WebSocket):
    """
    WebSocket endpoint for streaming audio chunks → Whisper → Chat.
    """
    await websocket.accept()

    # ── PERF: stage 1 — WebSocket connected ───────────────────────────────────
    perf = VoicePerf()
    perf.mark("ws_connected")

    logger.info("[WS_AUDIO] Client connected: %s", websocket.client)

    db: Session = SessionLocal()
    current_user: Optional[User] = None
    conversation_id: Optional[int] = None
    audio_chunks: list[bytes] = []
    mime_type: str = "audio/webm"
    first_chunk_received = False

    try:
        # ── 1. Auth handshake ──────────────────────────────────────────────────
        # First message must be TEXT JSON with token + optional conversation_id
        try:
            init_text = await websocket.receive_text()
            init_data = json.loads(init_text)
        except Exception:
            await _error(websocket, "Invalid session init frame. Expected JSON.")
            return

        token = init_data.get("token", "")
        if not token:
            await _error(websocket, "Missing auth token.")
            return

        # Inline JWT decode (FastAPI DI is not available in WebSocket context)
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("id")
            if not user_id:
                raise ValueError("no user id in token")
            current_user = db.query(User).filter(User.id == user_id).first()
            if current_user is None:
                raise ValueError("user not found")
        except (JWTError, ValueError) as exc:
            logger.warning("[WS_AUDIO] Auth failed: %s", exc)
            await _error(websocket, "Invalid or expired token.")
            return

        conversation_id = init_data.get("conversation_id") or None
        mime_type       = init_data.get("mime_type", "audio/webm")

        # ── PERF: stage 2 — auth complete ─────────────────────────────────────
        perf.mark("auth_ok")

        logger.info(
            "[WS_AUDIO] Auth OK | user=%s | conv_id=%s | mime=%s",
            current_user.email, conversation_id, mime_type,
        )

        # Acknowledge — client can now start sending audio
        await websocket.send_json({
            "type":            "ready",
            "conversation_id": conversation_id,
        })

        # ── 2. Streaming loop ──────────────────────────────────────────────────
        audio_chunks = []
        total_bytes  = 0
        num_chunks   = 0

        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                logger.info("[WS_AUDIO] WebSocket disconnected by client gracefully.")
                break

            # BINARY frame = audio chunk
            if "bytes" in message and message["bytes"]:
                chunk = message["bytes"]
                total_bytes += len(chunk)
                num_chunks  += 1

                if total_bytes > MAX_AUDIO_BYTES:
                    await _error(websocket, "Audio too large. Maximum 10 MB per utterance.")
                    return

                audio_chunks.append(chunk)

                # ── PERF: stage 3 — first chunk ───────────────────────────────
                if not first_chunk_received:
                    first_chunk_received = True
                    perf.mark("first_chunk")

                continue

            # TEXT frame = control message
            if "text" in message and message["text"]:
                try:
                    ctrl = json.loads(message["text"])
                except Exception:
                    await _error(websocket, "Invalid control frame.")
                    continue

                msg_type = ctrl.get("type", "")

                # ── stop: transcribe + chat ────────────────────────────────────
                if msg_type == "stop":
                    # ── PERF: stage 4 — last chunk / stop received ─────────────
                    perf.mark("last_chunk")
                    perf.mark("stop_received")

                    logger.info(
                        "[WS_AUDIO] Stop received | chunks=%d | total_bytes=%d",
                        num_chunks, total_bytes,
                    )

                    if not audio_chunks or total_bytes < 1000:
                        await websocket.send_json({
                            "type":    "error",
                            "message": "I couldn't understand that — the recording was too short. Could you try again?",
                        })
                        audio_chunks = []
                        total_bytes  = 0
                        num_chunks   = 0
                        first_chunk_received = False
                        perf = VoicePerf()          # reset for next utterance
                        perf.mark("ws_connected")   # re-use existing connection
                        perf.mark("auth_ok")
                        continue

                    # ── 3. Whisper transcription ───────────────────────────────
                    audio_bytes_buf = b"".join(audio_chunks)
                    audio_chunks = []
                    total_bytes  = 0

                    # ── PERF: stage 5 — Whisper start ─────────────────────────
                    perf.mark("whisper_start")

                    # OP-3: Run Whisper off the event loop so the WS handler
                    # stays responsive to other connections during inference.
                    loop = asyncio.get_event_loop()
                    transcript, audio_duration_s = await loop.run_in_executor(
                        None,
                        partial(_transcribe_with_duration, audio_bytes_buf, mime_type),
                    )

                    # ── PERF: stage 6 — Whisper end ───────────────────────────
                    perf.mark("whisper_end")

                    if not transcript:
                        await websocket.send_json({
                            "type":    "error",
                            "message": "I couldn't understand that. Could you try again?",
                        })
                        _emit_perf_report(
                            perf, conv_id=conversation_id, num_chunks=num_chunks,
                            audio_bytes=len(audio_bytes_buf), mime_type=mime_type,
                            audio_duration_s=audio_duration_s,
                            workflow_state="IDLE", selected_tool=None, http_fallback=False,
                        )
                        num_chunks = 0
                        first_chunk_received = False
                        perf = VoicePerf()
                        perf.mark("ws_connected")
                        perf.mark("auth_ok")
                        continue

                    logger.info("[WS_AUDIO] Transcript: %r", transcript[:80])

                    # Send transcript back to client (for display in chat)
                    await websocket.send_json({
                        "type":            "transcript",
                        "transcript":      transcript,
                        "conversation_id": conversation_id,
                    })

                    # ── 4. Resolve / create conversation ───────────────────────
                    if conversation_id is None:
                        conv = AssistantConversation(user_id=current_user.id)
                        db.add(conv)
                        db.commit()
                        db.refresh(conv)
                        conversation_id = conv.id
                    else:
                        conv = db.query(AssistantConversation).filter(
                            AssistantConversation.id == conversation_id
                        ).first()
                        if conv is None:
                            await _error(websocket, "Conversation not found.")
                            return

                    # ── 5. Save user message ───────────────────────────────────
                    db.add(AssistantMessage(
                        conversation_id=conv.id,
                        sender="user",
                        message=transcript,
                    ))
                    db.commit()

                    # ── 6. Planner + Agent (same path as /assistant/chat) ──────
                    memory          = WorkflowMemory(conv.collected_entities)
                    chat_request    = ChatRequest(
                        message=transcript,
                        conversation_id=conv.id,
                    )

                    # ── PERF: stage 7 — Planner start ─────────────────────────
                    perf.mark("planner_start")
                    planner_decision = await loop.run_in_executor(
                        None,
                        partial(Planner.decide, transcript.strip(), conv, memory)
                    )
                    perf.mark("planner_end")
                    # ── PERF: stage 8 — Planner end ───────────────────────────

                    ai_result = None
                    if planner_decision.action == "llm":
                        history_rows = (
                            db.query(AssistantMessage)
                            .filter(AssistantMessage.conversation_id == conv.id)
                            .order_by(AssistantMessage.created_at)
                            .all()
                        )
                        conversation_history = [
                            {"role": "assistant" if m.sender == "assistant" else "user",
                             "content": m.message}
                            for m in history_rows
                        ]
                        # ── PERF: stage 9 — LLM start ─────────────────────────
                        perf.mark("llm_start")
                        # OP-3: Run the blocking Groq HTTP call off the event loop.
                        loop = asyncio.get_event_loop()
                        ai_result = await loop.run_in_executor(
                            None,
                            partial(chat_with_ai, conversation_history, current_user,
                                    memory=memory),
                        )
                        perf.mark("llm_end")
                        # ── PERF: stage 10 — LLM end ──────────────────────────

                    # ── PERF: tool marks are set inside _execute_tool_instrumented ──
                    agent_result = await loop.run_in_executor(
                        None,
                        partial(
                            CyberDeskAgent.run,
                            ai_result=ai_result,
                            request=chat_request,
                            conversation=conv,
                            current_user=current_user,
                            db=db,
                            perf=perf,          # passed so agent can mark tool_start/end
                        )
                    )

                    # ── 7. Save assistant message ──────────────────────────────
                    db.add(AssistantMessage(
                        conversation_id=conv.id,
                        sender="assistant",
                        message=agent_result.get("response", ""),
                    ))
                    db.commit()

                    conversation_id = conv.id

                    # ── 8. Send response to client ─────────────────────────────
                    await websocket.send_json({
                        "type":            "response",
                        "response":        agent_result.get("response", ""),
                        "status":          agent_result.get("status", "waiting"),
                        "action_card":     agent_result.get("action_card"),
                        "conversation_id": conversation_id,
                    })

                    # ── PERF: stage 11 — response sent ────────────────────────
                    perf.mark("response_sent")

                    logger.info(
                        "[WS_AUDIO] Response sent | conv=%d | status=%s",
                        conversation_id,
                        agent_result.get("status"),
                    )

                    # ── Emit the performance report ────────────────────────────
                    _emit_perf_report(
                        perf,
                        conv_id=conversation_id,
                        num_chunks=num_chunks,
                        audio_bytes=len(audio_bytes_buf),
                        mime_type=mime_type,
                        audio_duration_s=audio_duration_s,
                        workflow_state=getattr(conv, "workflow_state", "IDLE"),
                        selected_tool=planner_decision.tool_name,
                        http_fallback=False,
                    )

                    # Reset for next utterance (WS stays open in voice-mode)
                    num_chunks = 0
                    first_chunk_received = False
                    perf = VoicePerf()
                    perf.mark("ws_connected")
                    perf.mark("auth_ok")
                    continue

                # ── ping: keepalive ────────────────────────────────────────────
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

    except WebSocketDisconnect:
        logger.info("[WS_AUDIO] Client disconnected: %s", websocket.client)

    except Exception as exc:
        logger.error("[WS_AUDIO] Unhandled error: %s", exc, exc_info=True)
        try:
            await _error(websocket, "An internal error occurred.")
        except Exception:
            pass

    finally:
        db.close()
        logger.info("[WS_AUDIO] Session closed for user=%s", getattr(current_user, "email", "?"))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _transcribe_with_duration(audio_bytes: bytes, mime_type: str):
    """
    Wraps transcribe_audio() and also extracts audio duration from the
    faster-whisper TranscriptionInfo object so we can include it in the
    performance report without changing the public whisper_service API.
    """
    import tempfile
    from pathlib import Path
    from services.whisper_service import _get_model, _mime_to_ext, WHISPER_LANGUAGE

    duration_s = 0.0
    if not audio_bytes:
        return None, duration_s

    ext = _mime_to_ext(mime_type)
    try:
        model = _get_model()
    except RuntimeError as exc:
        logger.error("[WS_AUDIO] Whisper model unavailable: %s", exc)
        return None, duration_s

    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        logger.info(
            "[WHISPER] Transcribing %d bytes (%s) from %s",
            len(audio_bytes), mime_type, tmp_path,
        )
        logger.info("[WHISPER] Whisper started")

        segments, info = model.transcribe(
            tmp_path,
            language=WHISPER_LANGUAGE,
            beam_size=1,              # OP-2: matches whisper_service.py
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=300),
        )

        transcript = " ".join(seg.text.strip() for seg in segments).strip()
        duration_s = getattr(info, "duration", 0.0)

        logger.info(
            "[WHISPER] Transcription complete | lang=%s prob=%.2f | duration=%.1fs | text=%r",
            info.language, info.language_probability, duration_s,
            transcript[:80],
        )
        logger.info("[WHISPER] Whisper finished")
        return (transcript if transcript else None), duration_s

    except Exception as exc:
        logger.error("[WHISPER] Transcription error: %s", exc, exc_info=True)
        return None, duration_s
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


def _emit_perf_report(perf: VoicePerf, **kwargs):
    """Safely call perf.report() without crashing the WS handler on error."""
    try:
        perf.report(
            whisper_model=WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
            **kwargs,
        )
    except Exception as exc:
        logger.warning("[PERF] Report generation failed: %s", exc)


async def _error(ws: WebSocket, message: str):
    """Send a JSON error frame and close the socket."""
    try:
        await ws.send_json({"type": "error", "message": message})
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception:
        pass
