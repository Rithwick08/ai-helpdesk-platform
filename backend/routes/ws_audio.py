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

import io
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from services.whisper_service import transcribe_audio
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
    logger.info("[WS_AUDIO] Client connected: %s", websocket.client)

    db: Session = SessionLocal()
    current_user: Optional[User] = None
    conversation_id: Optional[int] = None
    audio_chunks: list[bytes] = []
    mime_type: str = "audio/webm"

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

        while True:
            message = await websocket.receive()

            # BINARY frame = audio chunk
            if "bytes" in message and message["bytes"]:
                chunk = message["bytes"]
                total_bytes += len(chunk)

                if total_bytes > MAX_AUDIO_BYTES:
                    await _error(websocket, "Audio too large. Maximum 10 MB per utterance.")
                    return

                audio_chunks.append(chunk)
                logger.debug("[WS_AUDIO] Received chunk: %d bytes (total=%d)", len(chunk), total_bytes)
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
                    logger.info(
                        "[WS_AUDIO] Stop received | chunks=%d | total_bytes=%d",
                        len(audio_chunks), total_bytes,
                    )

                    if not audio_chunks or total_bytes < 1000:
                        await websocket.send_json({
                            "type":    "error",
                            "message": "I couldn't understand that — the recording was too short. Could you try again?",
                        })
                        audio_chunks = []
                        total_bytes  = 0
                        continue

                    # ── 3. Whisper transcription ───────────────────────────────
                    audio_bytes = b"".join(audio_chunks)
                    audio_chunks = []
                    total_bytes  = 0

                    transcript = transcribe_audio(audio_bytes, mime_type)

                    if not transcript:
                        await websocket.send_json({
                            "type":    "error",
                            "message": "I couldn't understand that. Could you try again?",
                        })
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
                    planner_decision = Planner.decide(transcript.strip(), conv, memory)

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
                        ai_result = chat_with_ai(conversation_history, current_user, memory=memory)
                    else:
                        ai_result = None

                    agent_result = CyberDeskAgent.run(
                        ai_result=ai_result,
                        request=chat_request,
                        conversation=conv,
                        current_user=current_user,
                        db=db,
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

                    logger.info(
                        "[WS_AUDIO] Response sent | conv=%d | status=%s",
                        conversation_id,
                        agent_result.get("status"),
                    )
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

async def _error(ws: WebSocket, message: str):
    """Send a JSON error frame and close the socket."""
    try:
        await ws.send_json({"type": "error", "message": message})
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception:
        pass
