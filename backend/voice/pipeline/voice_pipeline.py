"""
voice_pipeline.py — Core orchestration service for CyberShield AI voice pipeline.

This is the single entry-point for turning audio into audio.  It:
  1. Transcribes the audio via Deepgram STT
  2. Calls the SAME assistant chat logic used by the React UI
  3. Synthesises the AI response via Sarvam TTS
  4. Returns a typed VoiceResponse

Design constraints
------------------
• Does NOT implement any AI logic.
• Does NOT modify agent, planner, workflow memory, or tool routing.
• Calls the EXACT same code path that POST /assistant/chat uses:
      Router.determine_tool() → CyberDeskAgent.run()
  so every capability (Planner, Memory, SOC, Password Reset, IT Support,
  Security Awareness, Ticket Creation) continues working unchanged.
• The assistant/chat route handler is intentionally synchronous (SQLAlchemy
  sync session).  We run it in an executor so it doesn't block the async
  event loop.
• Raises VoicePipelineError subclasses; the route handler converts these
  to appropriate HTTPExceptions.
"""

import asyncio
import logging
import time
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from models.user import User
from voice.pipeline.exceptions import AIError, STTError, TTSError
from voice.pipeline.schemas import VoiceResponse
from voice.pipeline.voice_session import VoiceSession
from voice.stt.deepgram_service import transcribe_audio
from voice.tts.sarvam_service import generate_speech

logger = logging.getLogger("cyberdesk.voice.pipeline")


# ── Internal AI bridge ─────────────────────────────────────────────────────────

def _run_assistant_chat(
    *,
    message: str,
    conversation_id: Optional[int],
    db: Session,
    current_user: User,
) -> dict:
    """
    Call the EXACT same code path that POST /assistant/chat uses.

    This function deliberately mirrors routes/assistant.py step-by-step
    so the voice interface is byte-for-byte equivalent to the web interface.
    It is synchronous because SQLAlchemy's Session is not async-safe and
    the existing route is already synchronous.

    Parameters
    ----------
    message : str
        The transcribed user text (equivalent to ChatRequest.message).
    conversation_id : int | None
        Existing conversation to continue, or None to start a new one.
    db : Session
        Active SQLAlchemy session (obtained from the route's Depends(get_db)).
    current_user : User
        The authenticated user (from the route's Depends(get_current_user)).

    Returns
    -------
    dict
        The agent_result dict with keys: status, response, conversation_id, …
        Identical to what POST /assistant/chat returns to the React frontend.
    """
    # ── Inline imports to mirror routes/assistant.py exactly ──────────────────
    from agent.agent import CyberDeskAgent
    from agent.router import Router
    from agent.workflow_memory import WorkflowMemory
    from models.assistant_conversation import AssistantConversation
    from models.assistant_message import AssistantMessage
    from schemas.assistant import ChatRequest

    # ── 1. Resolve or create conversation ─────────────────────────────────────
    if conversation_id is None:
        conversation = AssistantConversation(user_id=current_user.id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    else:
        conversation = db.query(AssistantConversation).filter(
            AssistantConversation.id == conversation_id
        ).first()
        if conversation is None:
            raise AIError(
                f"Conversation {conversation_id} not found.",
                http_status=404,
            )

    logger.info(
        "[PIPELINE/AI] user=%s | conv=%s | state=%s | message=%r",
        current_user.email,
        conversation.id,
        getattr(conversation, "workflow_state", "IDLE"),
        message[:80],
    )

    # ── 2. Save user message ───────────────────────────────────────────────────
    db.add(AssistantMessage(
        conversation_id=conversation.id,
        sender="user",
        message=message,
    ))
    db.commit()

    # ── 3. Build conversation history ──────────────────────────────────────────
    history_rows = (
        db.query(AssistantMessage)
        .filter(AssistantMessage.conversation_id == conversation.id)
        .order_by(AssistantMessage.created_at)
        .all()
    )
    conversation_history = [
        {"role": "assistant" if m.sender == "assistant" else "user", "content": m.message}
        for m in history_rows
    ]

    # ── 4. Router determines next action ───────────────────────────────────────
    memory = WorkflowMemory(conversation.collected_entities)

    request = ChatRequest(
        conversation_id=conversation.id,
        message=message,
    )
    request.conversation_history = conversation_history

    decision_dict, memory = Router.determine_tool(
        user_text=message.strip(),
        conversation=conversation,
        memory=memory,
        current_user=current_user,
        conversation_history=conversation_history,
    )

    logger.info(
        "[PIPELINE/AI] Router: action=%s | tool=%s",
        decision_dict.get("action"),
        decision_dict.get("tool_name"),
    )

    # ── 5. Run agent ───────────────────────────────────────────────────────────
    agent_result = CyberDeskAgent.run(
        decision_dict=decision_dict,
        request=request,
        conversation=conversation,
        memory=memory,
        current_user=current_user,
        db=db,
    )

    # ── 6. Save AI response ────────────────────────────────────────────────────
    db.add(AssistantMessage(
        conversation_id=conversation.id,
        sender="assistant",
        message=agent_result.get("response", ""),
    ))
    db.commit()

    # ── 7. Training recommendations (on completion) ────────────────────────────
    if agent_result.get("status") == "completed":
        try:
            from models.training_recommendation import TrainingRecommendation
            from services.ai_service import recommend_training

            history_rows = (
                db.query(AssistantMessage)
                .filter(AssistantMessage.conversation_id == conversation.id)
                .order_by(AssistantMessage.created_at)
                .all()
            )
            conversation_text = "\n".join(f"{m.sender}: {m.message}" for m in history_rows)
            recommendations = recommend_training(conversation_text)

            db.query(TrainingRecommendation).filter(
                TrainingRecommendation.user_id == current_user.id,
                TrainingRecommendation.is_active == True,
            ).update({TrainingRecommendation.is_active: False})
            db.commit()

            for topic in recommendations.get("topics", []):
                db.add(TrainingRecommendation(
                    user_id=current_user.id,
                    topic=topic,
                    is_active=True,
                ))
            db.commit()
        except Exception as exc:
            logger.warning("[PIPELINE/AI] Training recommendation failed: %s", exc)

    return {
        "conversation_id": conversation.id,
        **agent_result,
    }


# ── Public pipeline entry-point ────────────────────────────────────────────────

async def process_voice_request(
    *,
    audio_file: UploadFile,
    current_user: User,
    db: Session,
    conversation_id: Optional[int] = None,
    session: Optional[VoiceSession] = None,
) -> VoiceResponse:
    """
    Full voice pipeline: Audio → STT → AI → TTS → Audio.

    This is the single public entry-point.  Routes call this function;
    it orchestrates the three stages and returns a typed VoiceResponse.

    Parameters
    ----------
    audio_file : UploadFile
        The raw audio file from the multipart form upload.
    current_user : User
        The authenticated CyberShield AI user.
    db : Session
        Active SQLAlchemy session injected by FastAPI's dependency system.
    conversation_id : int | None
        Continue an existing conversation, or None to start fresh.
    session : VoiceSession | None
        Existing voice session for latency tracking, or None to create one.

    Returns
    -------
    VoiceResponse
        Typed result containing transcript, response_text, audio_bytes,
        mime_type, conversation_id, agent_status, and session_id.

    Raises
    ------
    STTError   — if Deepgram transcription fails
    AIError    — if the CyberShield AI agent fails
    TTSError   — if Sarvam TTS fails
    """
    # Initialise or reuse session
    if session is None:
        session = VoiceSession(user_id=current_user.id)

    logger.info(
        "[PIPELINE] START | user=%s | session=%s | conv=%s | file=%s",
        current_user.email,
        session.session_id[:8],
        conversation_id,
        audio_file.filename,
    )

    # ── Stage 1: Deepgram STT ──────────────────────────────────────────────────
    logger.info("[PIPELINE] Stage 1/3 — STT (Deepgram)")
    t0 = time.monotonic()
    try:
        transcript = await transcribe_audio(audio_file)
    except HTTPException as exc:
        logger.error(
            "[PIPELINE] STT failed | status=%s | detail=%s",
            exc.status_code, exc.detail,
        )
        raise STTError(
            message=f"Speech-to-text failed: {exc.detail}",
            http_status=exc.status_code,
        ) from exc
    except Exception as exc:
        logger.error("[PIPELINE] STT unexpected error: %s", exc, exc_info=True)
        raise STTError("Speech-to-text failed due to an unexpected error.") from exc

    stt_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "[PIPELINE] STT OK | chars=%d | latency=%dms | transcript=%r",
        len(transcript), stt_ms, transcript[:80],
    )

    # ── Stage 2: CyberShield AI Agent ─────────────────────────────────────────
    logger.info("[PIPELINE] Stage 2/3 — AI (CyberDeskAgent)")
    t1 = time.monotonic()
    try:
        # The assistant route is synchronous (SQLAlchemy sync session).
        # Run it in a thread-pool executor so we don't block the event loop.
        loop = asyncio.get_running_loop()
        ai_result = await loop.run_in_executor(
            None,
            lambda: _run_assistant_chat(
                message=transcript,
                conversation_id=conversation_id,
                db=db,
                current_user=current_user,
            ),
        )
    except AIError:
        raise
    except Exception as exc:
        logger.error("[PIPELINE] AI unexpected error: %s", exc, exc_info=True)
        raise AIError("AI agent failed due to an unexpected error.") from exc

    ai_ms = int((time.monotonic() - t1) * 1000)
    response_text: str = ai_result.get("response", "")
    resolved_conversation_id: int = ai_result["conversation_id"]
    agent_status: str = ai_result.get("status", "chat")

    logger.info(
        "[PIPELINE] AI OK | conv=%s | status=%s | latency=%dms | response=%r",
        resolved_conversation_id, agent_status, ai_ms, response_text[:80],
    )

    # ── Stage 3: Sarvam TTS ────────────────────────────────────────────────────
    logger.info("[PIPELINE] Stage 3/3 — TTS (Sarvam AI)")
    t2 = time.monotonic()
    try:
        audio_bytes, mime_type = await generate_speech(response_text)
    except HTTPException as exc:
        logger.error(
            "[PIPELINE] TTS failed | status=%s | detail=%s",
            exc.status_code, exc.detail,
        )
        raise TTSError(
            message=f"Text-to-speech failed: {exc.detail}",
            http_status=exc.status_code,
        ) from exc
    except Exception as exc:
        logger.error("[PIPELINE] TTS unexpected error: %s", exc, exc_info=True)
        raise TTSError("Text-to-speech failed due to an unexpected error.") from exc

    tts_ms = int((time.monotonic() - t2) * 1000)
    logger.info(
        "[PIPELINE] TTS OK | bytes=%d | mime=%s | latency=%dms",
        len(audio_bytes), mime_type, tts_ms,
    )

    # ── Record session turn ────────────────────────────────────────────────────
    session.conversation_id = resolved_conversation_id
    turn = session.record_turn(
        transcript=transcript,
        response_text=response_text,
        agent_status=agent_status,
        audio_bytes_size=len(audio_bytes),
        stt_latency_ms=stt_ms,
        ai_latency_ms=ai_ms,
        tts_latency_ms=tts_ms,
    )

    total_ms = stt_ms + ai_ms + tts_ms
    logger.info(
        "[PIPELINE] COMPLETE | session=%s | turn=%d | total_latency=%dms",
        session.session_id[:8], turn.turn_number, total_ms,
    )

    return VoiceResponse(
        transcript=transcript,
        response_text=response_text,
        audio_bytes=audio_bytes,
        mime_type=mime_type,
        conversation_id=resolved_conversation_id,
        agent_status=agent_status,
        session_id=session.session_id,
    )
