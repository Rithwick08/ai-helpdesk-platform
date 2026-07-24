"""
media_stream.py — Twilio Media Stream event handler and Voice Pipeline bridge.

Connects Twilio Media Streams to the existing CyberShield AI voice pipeline
(`process_voice_request()`) without introducing redundant STT, TTS, or AI logic.

Flow
----
Incoming 8kHz mu-law audio
    ↓ audio_codec.mulaw_to_wav()
WAV audio buffer
    ↓ process_voice_request()  ← SAME voice pipeline used by the browser!
        • Deepgram STT
        • CyberShield AI Agent (Planner + Router + Memory)
        • Sarvam AI TTS
Sarvam AI WAV audio
    ↓ audio_codec.wav_to_twilio_mulaw()
Outgoing 8kHz mu-law audio
    ↓ audio_codec.mulaw_to_b64_frames()
Base64 JSON media frames → Twilio WebSocket → Caller
"""

import logging
import time
from typing import List, Tuple
from fastapi import UploadFile
from sqlalchemy.orm import Session

from models.user import User
from voice.pipeline.voice_pipeline import process_voice_request
from voice.pipeline.schemas import VoiceResponse
from voice.telephony.audio_codec import mulaw_to_b64_frames, mulaw_to_wav, wav_to_twilio_mulaw
from voice.telephony.stream_session import StreamSession

logger = logging.getLogger("cyberdesk.voice.telephony.media_stream")


class VirtualUploadFile(UploadFile):
    """Memory-backed UploadFile wrapper for audio bytes passed to process_voice_request()."""

    def __init__(self, filename: str, content_type: str, data: bytes):
        import io
        from starlette.datastructures import Headers
        file_obj = io.BytesIO(data)
        headers = Headers({"content-type": content_type})
        super().__init__(file=file_obj, filename=filename, headers=headers)

    async def read(self, size: int = -1) -> bytes:
        return self.file.read(size)


async def process_stream_utterance(
    *,
    session: StreamSession,
    mulaw_bytes: bytes,
    current_user: User,
    db: Session,
) -> Tuple[List[str], str, int, str]:
    """
    Process one accumulated audio utterance from Twilio Media Streams through the Voice Pipeline.

    Parameters
    ----------
    session : StreamSession
        Active stream session tracking metadata.
    mulaw_bytes : bytes
        Accumulated 8-bit mu-law audio bytes from Twilio.
    current_user : User
        Authenticated user (or default system user for phone calls).
    db : Session
        Active SQLAlchemy database session.

    Returns
    -------
    tuple[list[str], str, int, str]
        (b64_media_frames, response_text, conversation_id, agent_status)
    """
    if not mulaw_bytes or len(mulaw_bytes) < 800:
        logger.warning(
            "[MEDIA_STREAM] Utterance audio buffer too small (%d bytes), skipping processing.",
            len(mulaw_bytes),
        )
        return [], "", session.conversation_id or 0, "idle"

    t0 = time.monotonic()
    logger.info(
        "[MEDIA_STREAM] Processing utterance | call_sid=%s | bytes=%d | conv_id=%s",
        session.call_sid,
        len(mulaw_bytes),
        session.conversation_id,
    )

    # ── 1. Convert Twilio 8kHz mu-law -> 16kHz WAV for Deepgram ──────────────────
    wav_bytes = mulaw_to_wav(mulaw_bytes, source_rate=8000, target_rate=16000)

    try:
        with open("debug_twilio.wav", "wb") as f:
            f.write(wav_bytes)
        logger.info("[MEDIA_STREAM] Saved debug audio to debug_twilio.wav (%d bytes)", len(wav_bytes))
    except Exception as e:
        logger.warning("[MEDIA_STREAM] Could not save debug_twilio.wav: %s", e)

    upload_file = VirtualUploadFile(
        filename=f"twilio_{session.call_sid}.wav",
        content_type="audio/wav",
        data=wav_bytes,
    )

    # ── 2. Run through existing Voice Pipeline (Deepgram -> AI -> Sarvam) ─────────
    try:
        t_pipeline = time.monotonic()
        pipeline_result: VoiceResponse = await process_voice_request(
            audio_file=upload_file,
            current_user=current_user,
            db=db,
            conversation_id=session.conversation_id,
        )
        pipeline_ms = int((time.monotonic() - t_pipeline) * 1000)
    except Exception as exc:
        logger.error(
            "[MEDIA_STREAM] Voice pipeline processing failed for call %s: %s",
            session.call_sid,
            exc,
            exc_info=True,
        )
        raise

    total_ms = int((time.monotonic() - t0) * 1000)
    session.conversation_id = pipeline_result.conversation_id

    logger.info(
        "[MEDIA_STREAM] Pipeline success | call_sid=%s | conv_id=%d | transcript=%r | "
        "status=%s | pipeline_ms=%dms | total_ms=%dms",
        session.call_sid,
        pipeline_result.conversation_id,
        pipeline_result.transcript[:60],
        pipeline_result.agent_status,
        pipeline_ms,
        total_ms,
    )

    # ── 3. Convert Sarvam AI output WAV -> Twilio 8kHz mu-law bytes ───────────────
    sarvam_mulaw_bytes = wav_to_twilio_mulaw(pipeline_result.audio_bytes, target_rate=8000)

    # ── 4. Split mu-law bytes into 20ms base64 media frames ──────────────────────
    b64_frames = mulaw_to_b64_frames(sarvam_mulaw_bytes, frame_size=160)

    # ── 5. Record session turn metrics ──────────────────────────────────────────
    session.record_turn(
        transcript=pipeline_result.transcript,
        response_text=pipeline_result.response_text,
        agent_status=pipeline_result.agent_status,
        audio_bytes_sent=len(sarvam_mulaw_bytes),
    )

    return (
        b64_frames,
        pipeline_result.response_text,
        pipeline_result.conversation_id,
        pipeline_result.agent_status,
    )
