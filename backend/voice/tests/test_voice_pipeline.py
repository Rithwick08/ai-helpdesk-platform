"""
test_voice_pipeline.py — Unit & integration tests for the Voice Pipeline.

Usage
-----
Run as a pytest suite:
    cd ai-helpdesk-platform
    python -m pytest backend/voice/tests/test_voice_pipeline.py -v

Run as a standalone CLI (requires both API keys):
    python backend/voice/tests/test_voice_pipeline.py sample.wav

Output:
    Transcript:
    <transcribed text>

    AI Response:
    <CyberShield AI reply>

    Audio Generated:
    <bytes, MIME type, saved path>

Environment Variables
---------------------
    DEEPGRAM_API_KEY   — required for integration test
    SARVAM_API_KEY     — required for integration test

Dependencies
------------
    pip install deepgram-sdk sarvamai pytest pytest-asyncio python-dotenv
"""

import asyncio
import base64
import logging
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

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
logger = logging.getLogger("cyberdesk.voice.pipeline.tests")

_AUDIO_OUTPUT = Path(__file__).parent / "pipeline_output.wav"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_upload_file(
    content: bytes,
    filename: str = "test.wav",
    content_type: str = "audio/wav",
):
    """Build a minimal FastAPI UploadFile-like mock."""
    from fastapi import UploadFile  # noqa

    mock = MagicMock(spec=UploadFile)
    mock.filename = filename
    mock.content_type = content_type
    mock.read = AsyncMock(return_value=content)
    return mock


def _make_user(user_id: int = 1, email: str = "test@cybershield.ai"):
    """Build a minimal User mock."""
    user = MagicMock()
    user.id = user_id
    user.email = email
    return user


def _make_db():
    """Build a minimal SQLAlchemy Session mock."""
    return MagicMock()


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — VoiceSession
# ══════════════════════════════════════════════════════════════════════════════


class TestVoiceSession:

    def test_creates_unique_session_ids(self):
        from voice.pipeline.voice_session import VoiceSession  # noqa

        s1 = VoiceSession(user_id=1)
        s2 = VoiceSession(user_id=1)
        assert s1.session_id != s2.session_id

    def test_accepts_custom_session_id(self):
        from voice.pipeline.voice_session import VoiceSession  # noqa

        s = VoiceSession(user_id=1, session_id="my-session-abc")
        assert s.session_id == "my-session-abc"

    def test_turn_count_starts_at_zero(self):
        from voice.pipeline.voice_session import VoiceSession  # noqa

        s = VoiceSession(user_id=1)
        assert s.turn_count == 0
        assert s.last_turn is None

    def test_record_turn_increments_count(self):
        from voice.pipeline.voice_session import VoiceSession  # noqa

        s = VoiceSession(user_id=1)
        s.record_turn(
            transcript="hello",
            response_text="hi",
            agent_status="chat",
            audio_bytes_size=1024,
            stt_latency_ms=100,
            ai_latency_ms=300,
            tts_latency_ms=200,
        )
        assert s.turn_count == 1
        assert s.last_turn is not None
        assert s.last_turn.turn_number == 1

    def test_turn_total_latency(self):
        from voice.pipeline.voice_session import VoiceSession  # noqa

        s = VoiceSession(user_id=1)
        turn = s.record_turn(
            transcript="t", response_text="r", agent_status="chat",
            audio_bytes_size=100, stt_latency_ms=100, ai_latency_ms=200,
            tts_latency_ms=50,
        )
        assert turn.total_latency_ms == 350

    def test_turn_latency_none_if_partial(self):
        from voice.pipeline.voice_session import VoiceSession  # noqa

        s = VoiceSession(user_id=1)
        turn = s.record_turn(
            transcript="t", response_text="r", agent_status="chat",
            audio_bytes_size=100,
        )
        assert turn.total_latency_ms is None

    def test_summary_contains_required_keys(self):
        from voice.pipeline.voice_session import VoiceSession  # noqa

        s = VoiceSession(user_id=42)
        summary = s.summary()
        for key in ("session_id", "user_id", "conversation_id", "turn_count", "current_state"):
            assert key in summary


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — Exceptions
# ══════════════════════════════════════════════════════════════════════════════


class TestExceptions:

    def test_stt_error_stage(self):
        from voice.pipeline.exceptions import STTError  # noqa

        exc = STTError("boom", http_status=503)
        assert exc.stage == "stt"
        assert exc.http_status == 503

    def test_ai_error_stage(self):
        from voice.pipeline.exceptions import AIError  # noqa

        exc = AIError("boom")
        assert exc.stage == "ai"
        assert exc.http_status == 500

    def test_tts_error_stage(self):
        from voice.pipeline.exceptions import TTSError  # noqa

        exc = TTSError("boom", http_status=429)
        assert exc.stage == "tts"
        assert exc.http_status == 429

    def test_all_inherit_from_base(self):
        from voice.pipeline.exceptions import AIError, STTError, TTSError, VoicePipelineError  # noqa

        for cls in (STTError, AIError, TTSError):
            assert issubclass(cls, VoicePipelineError)


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — VoiceResponse schema
# ══════════════════════════════════════════════════════════════════════════════


class TestSchemas:

    def test_voice_response_construction(self):
        from voice.pipeline.schemas import VoiceResponse  # noqa

        vr = VoiceResponse(
            transcript="reset my password",
            response_text="I'll help you reset your password.",
            audio_bytes=b"\x00" * 512,
            mime_type="audio/wav",
            conversation_id=7,
            agent_status="waiting",
            session_id="abc-123",
        )
        assert vr.conversation_id == 7
        assert vr.mime_type == "audio/wav"
        assert len(vr.audio_bytes) == 512


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — Voice Pipeline (fully mocked)
# ══════════════════════════════════════════════════════════════════════════════


class TestVoicePipeline:

    @pytest.mark.asyncio
    async def test_pipeline_raises_stt_error_on_stt_failure(self):
        """If STT raises HTTPException the pipeline wraps it in STTError."""
        from fastapi import HTTPException  # noqa

        from voice.pipeline.exceptions import STTError  # noqa
        from voice.pipeline.voice_pipeline import process_voice_request  # noqa

        with patch("voice.pipeline.voice_pipeline.transcribe_audio",
                   new_callable=AsyncMock) as mock_stt:
            mock_stt.side_effect = HTTPException(status_code=422, detail="blank transcript")

            with pytest.raises(STTError) as exc_info:
                await process_voice_request(
                    audio_file=_make_upload_file(b"audio"),
                    current_user=_make_user(),
                    db=_make_db(),
                )
        assert exc_info.value.http_status == 422

    @pytest.mark.asyncio
    async def test_pipeline_raises_tts_error_on_tts_failure(self):
        """If TTS raises HTTPException the pipeline wraps it in TTSError."""
        from fastapi import HTTPException  # noqa

        from voice.pipeline.exceptions import TTSError  # noqa
        from voice.pipeline.voice_pipeline import process_voice_request  # noqa

        with patch("voice.pipeline.voice_pipeline.transcribe_audio",
                   new_callable=AsyncMock, return_value="hello world"):
            with patch("voice.pipeline.voice_pipeline._run_assistant_chat",
                       return_value={"conversation_id": 1, "status": "chat", "response": "Hi"}):
                with patch("voice.pipeline.voice_pipeline.generate_speech",
                           new_callable=AsyncMock) as mock_tts:
                    mock_tts.side_effect = HTTPException(status_code=429, detail="rate limit")
                    with pytest.raises(TTSError) as exc_info:
                        await process_voice_request(
                            audio_file=_make_upload_file(b"audio"),
                            current_user=_make_user(),
                            db=_make_db(),
                        )
        assert exc_info.value.http_status == 429

    @pytest.mark.asyncio
    async def test_pipeline_success_returns_voice_response(self):
        """Full mocked pipeline produces a valid VoiceResponse."""
        from voice.pipeline.schemas import VoiceResponse  # noqa
        from voice.pipeline.voice_pipeline import process_voice_request  # noqa

        fake_audio = b"RIFF" + b"\x00" * 40

        with patch("voice.pipeline.voice_pipeline.transcribe_audio",
                   new_callable=AsyncMock, return_value="my printer is broken"):
            with patch("voice.pipeline.voice_pipeline._run_assistant_chat",
                       return_value={
                           "conversation_id": 42,
                           "status": "waiting",
                           "response": "Let me help you troubleshoot your printer.",
                       }):
                with patch("voice.pipeline.voice_pipeline.generate_speech",
                           new_callable=AsyncMock,
                           return_value=(fake_audio, "audio/wav")):
                    result = await process_voice_request(
                        audio_file=_make_upload_file(b"audio"),
                        current_user=_make_user(),
                        db=_make_db(),
                    )

        assert isinstance(result, VoiceResponse)
        assert result.transcript == "my printer is broken"
        assert result.response_text == "Let me help you troubleshoot your printer."
        assert result.audio_bytes == fake_audio
        assert result.mime_type == "audio/wav"
        assert result.conversation_id == 42
        assert result.agent_status == "waiting"
        assert result.session_id is not None

    @pytest.mark.asyncio
    async def test_pipeline_records_session_turn(self):
        """Session should record exactly one turn after a successful pipeline run."""
        from voice.pipeline.voice_pipeline import process_voice_request  # noqa
        from voice.pipeline.voice_session import VoiceSession  # noqa

        session = VoiceSession(user_id=1)
        fake_audio = b"\x00" * 100

        with patch("voice.pipeline.voice_pipeline.transcribe_audio",
                   new_callable=AsyncMock, return_value="test input"):
            with patch("voice.pipeline.voice_pipeline._run_assistant_chat",
                       return_value={"conversation_id": 5, "status": "chat", "response": "ok"}):
                with patch("voice.pipeline.voice_pipeline.generate_speech",
                           new_callable=AsyncMock, return_value=(fake_audio, "audio/wav")):
                    await process_voice_request(
                        audio_file=_make_upload_file(b"audio"),
                        current_user=_make_user(),
                        db=_make_db(),
                        session=session,
                    )

        assert session.turn_count == 1
        assert session.conversation_id == 5
        assert session.last_turn.transcript == "test input"

    @pytest.mark.asyncio
    async def test_pipeline_passes_conversation_id_to_ai(self):
        """The pipeline must pass conversation_id through to the AI bridge."""
        from voice.pipeline.voice_pipeline import process_voice_request  # noqa

        captured = {}

        def fake_ai(**kwargs):
            captured["conversation_id"] = kwargs["conversation_id"]
            return {"conversation_id": 99, "status": "chat", "response": "ok"}

        with patch("voice.pipeline.voice_pipeline.transcribe_audio",
                   new_callable=AsyncMock, return_value="hi"):
            with patch("voice.pipeline.voice_pipeline._run_assistant_chat",
                       side_effect=fake_ai):
                with patch("voice.pipeline.voice_pipeline.generate_speech",
                           new_callable=AsyncMock, return_value=(b"\x00", "audio/wav")):
                    await process_voice_request(
                        audio_file=_make_upload_file(b"audio"),
                        current_user=_make_user(),
                        db=_make_db(),
                        conversation_id=77,
                    )

        assert captured["conversation_id"] == 77


# ══════════════════════════════════════════════════════════════════════════════
# Integration Test — live APIs; skipped unless both keys are set
# ══════════════════════════════════════════════════════════════════════════════

_HAS_DEEPGRAM = bool(os.getenv("DEEPGRAM_API_KEY", "").strip()) and \
                os.getenv("DEEPGRAM_API_KEY") != "your_deepgram_api_key_here"
_HAS_SARVAM   = bool(os.getenv("SARVAM_API_KEY", "").strip()) and \
                os.getenv("SARVAM_API_KEY") != "your_sarvam_api_key_here"
_HAS_BOTH_KEYS = _HAS_DEEPGRAM and _HAS_SARVAM

_SAMPLE_WAV = _BACKEND_DIR / "test_tone.wav"


@pytest.mark.asyncio
@pytest.mark.skipif(
    not _HAS_BOTH_KEYS,
    reason="Both DEEPGRAM_API_KEY and SARVAM_API_KEY are required for this test.",
)
async def test_live_stt_to_tts_without_ai():
    """
    Live integration test: transcribe audio then synthesise back via TTS.

    This test intentionally skips the AI stage to avoid needing a DB connection
    in CI.  It validates that the STT and TTS modules are wired correctly.
    """
    # Reset singletons so they are re-created in this test's event loop
    # (avoids 'Event loop is closed' from httpx clients created in a prior loop)
    import voice.stt.deepgram_client as _dc
    import voice.tts.sarvam_client as _sc
    _dc._deepgram_client = None
    _sc._sarvam_client = None

    from voice.stt.deepgram_service import transcribe_audio  # noqa
    from voice.tts.sarvam_service import generate_speech    # noqa

    if not _SAMPLE_WAV.exists():
        pytest.skip(f"Sample audio not found at {_SAMPLE_WAV}. Provide a wav file.")

    audio_bytes = _SAMPLE_WAV.read_bytes()
    upload = _make_upload_file(audio_bytes, filename="test_tone.wav", content_type="audio/wav")

    try:
        transcript = await transcribe_audio(upload)
    except Exception as exc:
        from fastapi import HTTPException as _HTTPException  # noqa

        if isinstance(exc, _HTTPException) and exc.status_code in (401, 422):
            pytest.skip(f"STT skipped ({exc.status_code}): {exc.detail}")
        pytest.fail(f"STT raised unexpected exception: {exc}")

    logger.info("[INTEGRATION] Transcript: %r", transcript)

    try:
        audio_out, mime = await generate_speech(transcript or "Hello from CyberShield AI.")
    except Exception as exc:
        from fastapi import HTTPException as _HTTPException  # noqa

        if isinstance(exc, _HTTPException) and exc.status_code == 401:
            pytest.skip("TTS key invalid.")
        pytest.fail(f"TTS raised unexpected exception: {exc}")

    assert len(audio_out) > 0
    _AUDIO_OUTPUT.write_bytes(audio_out)
    print(f"\n✅ STT→TTS Integration OK | transcript={transcript!r} | bytes={len(audio_out):,} | saved={_AUDIO_OUTPUT}\n")


# ══════════════════════════════════════════════════════════════════════════════
# Standalone script entry-point
# ══════════════════════════════════════════════════════════════════════════════

async def _standalone_main(wav_path: str) -> None:
    """Run the STT → TTS pipeline from the CLI (no DB / no AI agent)."""
    from voice.stt.deepgram_service import transcribe_audio  # noqa
    from voice.tts.sarvam_service import generate_speech    # noqa

    if not _HAS_DEEPGRAM:
        print("⚠️  DEEPGRAM_API_KEY is not set in backend/.env")
        sys.exit(1)
    if not _HAS_SARVAM:
        print("⚠️  SARVAM_API_KEY is not set in backend/.env")
        sys.exit(1)

    path = Path(wav_path)
    if not path.exists():
        print(f"❌  File not found: {path}")
        sys.exit(1)

    print(f"🎤  Transcribing: {path.name} …")
    upload = _make_upload_file(
        path.read_bytes(),
        filename=path.name,
        content_type="audio/wav",
    )

    try:
        transcript = await transcribe_audio(upload)
    except Exception as exc:
        print(f"❌  STT failed: {exc}")
        sys.exit(1)

    print(f"\nTranscript:\n  {transcript!r}\n")

    print("🔊  Generating speech …")
    try:
        audio_bytes, mime_type = await generate_speech(transcript)
    except Exception as exc:
        print(f"❌  TTS failed: {exc}")
        sys.exit(1)

    out = _AUDIO_OUTPUT
    out.write_bytes(audio_bytes)
    print(f"\nAudio Generated:\n  Bytes: {len(audio_bytes):,}  MIME: {mime_type}  Saved: {out}\n")
    print("✅  Pipeline OK (STT → TTS, AI skipped — use the server for full pipeline)\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_voice_pipeline.py path/to/speech.wav")
        print("       (AI stage skipped in standalone mode — requires a running server)")
        sys.exit(1)
    asyncio.run(_standalone_main(sys.argv[1]))
