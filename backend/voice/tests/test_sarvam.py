"""
test_sarvam.py — Integration & unit tests for the Sarvam AI TTS module.

Usage
-----
Run as a pytest suite (recommended):
    cd ai-helpdesk-platform
    python -m pytest backend/voice/tests/test_sarvam.py -v

Run as a standalone script to generate a real audio file:
    python backend/voice/tests/test_sarvam.py
    python backend/voice/tests/test_sarvam.py "Hello from CyberShield AI."

The standalone mode calls the live Sarvam API and requires a valid
SARVAM_API_KEY in backend/.env.  Output is saved to:
    backend/voice/tests/sarvam_output.wav

Environment Variables
---------------------
    SARVAM_API_KEY          (required for integration tests)
    SARVAM_MODEL            (optional, default: bulbul:v3)
    SARVAM_SPEAKER          (optional, default: anushka)
    SARVAM_LANGUAGE         (optional, default: en-IN)
    SARVAM_AUDIO_CODEC      (optional, default: wav)
    SARVAM_SAMPLE_RATE      (optional, default: 22050)

Dependencies
------------
    pip install sarvamai pytest pytest-asyncio python-dotenv
"""

import asyncio
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

# Load .env so integration tests pick up SARVAM_API_KEY
from dotenv import load_dotenv  # noqa: E402

load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("cyberdesk.voice.tts.tests")

# ── Helpers ────────────────────────────────────────────────────────────────────

_SAMPLE_TEXT = "Your password has been reset successfully. Please log in with your new credentials."
_OUTPUT_FILE = Path(__file__).parent / "sarvam_output.wav"


def _make_mock_response(audio_b64: str = "", request_id: str = "test-req-001"):
    """Build a minimal TextToSpeechResponse-like mock."""
    mock = MagicMock()
    mock.audios = [audio_b64] if audio_b64 else []
    mock.request_id = request_id
    return mock


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — no live API calls; all Sarvam responses are mocked
# ══════════════════════════════════════════════════════════════════════════════


class TestSarvamClient:
    """Tests for the singleton client factory (voice/tts/sarvam_client.py)."""

    def test_raises_if_api_key_missing(self):
        """get_sarvam_client() must raise EnvironmentError when key is absent."""
        import voice.tts.sarvam_client as sc  # noqa

        original = sc._sarvam_client
        sc._sarvam_client = None
        try:
            with patch.dict(os.environ, {"SARVAM_API_KEY": ""}):
                with pytest.raises(EnvironmentError, match="SARVAM_API_KEY"):
                    sc.get_sarvam_client()
        finally:
            sc._sarvam_client = original

    def test_returns_singleton(self):
        """Calling get_sarvam_client() twice must return the same object."""
        import voice.tts.sarvam_client as sc  # noqa

        if sc._sarvam_client is not None:
            assert sc.get_sarvam_client() is sc.get_sarvam_client()


class TestSupportedLanguages:
    """Tests for the language allow-list in sarvam_service."""

    def test_accepted_languages(self):
        from voice.tts.sarvam_service import is_supported_language  # noqa

        accepted = ["en-IN", "hi-IN", "ta-IN", "bn-IN", "gu-IN",
                    "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "te-IN"]
        for lang in accepted:
            assert is_supported_language(lang), f"Expected {lang!r} to be accepted"

    def test_rejected_languages(self):
        from voice.tts.sarvam_service import is_supported_language  # noqa

        rejected = ["en-US", "fr-FR", "de-DE", "zh-CN", "ja-JP", ""]
        for lang in rejected:
            assert not is_supported_language(lang), f"Expected {lang!r} to be rejected"

    def test_strips_whitespace(self):
        from voice.tts.sarvam_service import is_supported_language  # noqa

        assert is_supported_language(" en-IN ")


class TestGetAudioMimeType:
    """Tests for codec → MIME type mapping."""

    def test_known_codecs(self):
        from voice.tts.sarvam_service import get_audio_mime_type  # noqa

        assert get_audio_mime_type("wav")  == "audio/wav"
        assert get_audio_mime_type("mp3")  == "audio/mpeg"
        assert get_audio_mime_type("opus") == "audio/opus"
        assert get_audio_mime_type("flac") == "audio/flac"

    def test_unknown_codec_falls_back(self):
        from voice.tts.sarvam_service import get_audio_mime_type  # noqa

        assert get_audio_mime_type("unknown") == "audio/wav"

    def test_case_insensitive(self):
        from voice.tts.sarvam_service import get_audio_mime_type  # noqa

        assert get_audio_mime_type("WAV") == "audio/wav"
        assert get_audio_mime_type("MP3") == "audio/mpeg"


class TestGenerateSpeechUnit:
    """Unit tests for generate_speech() with a mocked Sarvam client."""

    @pytest.mark.asyncio
    async def test_raises_400_on_empty_text(self):
        """400 must be raised when text is empty."""
        from fastapi import HTTPException  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        with pytest.raises(HTTPException) as exc_info:
            await generate_speech("")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_raises_400_on_whitespace_only(self):
        """400 must be raised when text is only whitespace."""
        from fastapi import HTTPException  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        with pytest.raises(HTTPException) as exc_info:
            await generate_speech("   \t\n  ")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_raises_413_on_text_too_long(self):
        """413 must be raised when text exceeds MAX_TEXT_CHARS."""
        from fastapi import HTTPException  # noqa

        import voice.tts.sarvam_service as svc  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        long_text = "x" * (svc.MAX_TEXT_CHARS + 1)
        with pytest.raises(HTTPException) as exc_info:
            await generate_speech(long_text)
        assert exc_info.value.status_code == 413

    @pytest.mark.asyncio
    async def test_raises_422_on_unsupported_language(self):
        """422 must be raised for an unsupported language code."""
        from fastapi import HTTPException  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        with pytest.raises(HTTPException) as exc_info:
            await generate_speech("Hello", language="en-US")
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_audio_bytes_on_success(self):
        """Should return (bytes, mime_type) on a valid Sarvam response."""
        import base64  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        # Encode fake WAV data as base64 to simulate Sarvam response
        fake_audio = b"RIFF" + b"\x00" * 40   # minimal WAV-like bytes
        fake_b64   = base64.b64encode(fake_audio).decode()

        mock_tts = AsyncMock()
        mock_tts.convert = AsyncMock(return_value=_make_mock_response(fake_b64))

        with patch("voice.tts.sarvam_service.get_sarvam_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.text_to_speech = mock_tts
            mock_factory.return_value = mock_client

            audio_bytes, mime_type = await generate_speech("Reset my VPN password.")

        assert audio_bytes == fake_audio
        assert mime_type == "audio/wav"

    @pytest.mark.asyncio
    async def test_returns_correct_mime_for_mp3_codec(self):
        """MIME type must match the configured codec."""
        import base64  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        fake_audio = b"\xff\xfb" + b"\x00" * 40  # MP3-like header
        fake_b64   = base64.b64encode(fake_audio).decode()

        mock_tts = AsyncMock()
        mock_tts.convert = AsyncMock(return_value=_make_mock_response(fake_b64))

        with patch("voice.tts.sarvam_service.get_sarvam_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.text_to_speech = mock_tts
            mock_factory.return_value = mock_client

            _, mime_type = await generate_speech("Hello", audio_codec="mp3")

        assert mime_type == "audio/mpeg"

    @pytest.mark.asyncio
    async def test_raises_401_on_invalid_key(self):
        """401 must be raised when Sarvam reports invalid credentials."""
        from fastapi import HTTPException  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        mock_exc = Exception("auth failed")
        mock_exc.status_code = 401  # type: ignore[attr-defined]

        mock_tts = AsyncMock()
        mock_tts.convert = AsyncMock(side_effect=mock_exc)

        with patch("voice.tts.sarvam_service.get_sarvam_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.text_to_speech = mock_tts
            mock_factory.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await generate_speech("Hello world")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_raises_429_on_rate_limit(self):
        """429 must be raised when Sarvam reports rate limit exceeded."""
        from fastapi import HTTPException  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        mock_exc = Exception("too many requests")
        mock_exc.status_code = 429  # type: ignore[attr-defined]

        mock_tts = AsyncMock()
        mock_tts.convert = AsyncMock(side_effect=mock_exc)

        with patch("voice.tts.sarvam_service.get_sarvam_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.text_to_speech = mock_tts
            mock_factory.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await generate_speech("Hello world")
        assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_raises_500_on_empty_audio_response(self):
        """500 must be raised when Sarvam returns an empty audios list."""
        from fastapi import HTTPException  # noqa

        from voice.tts.sarvam_service import generate_speech  # noqa

        mock_tts = AsyncMock()
        mock_tts.convert = AsyncMock(return_value=_make_mock_response(""))  # empty audio

        with patch("voice.tts.sarvam_service.get_sarvam_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.text_to_speech = mock_tts
            mock_factory.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await generate_speech("Hello world")
        assert exc_info.value.status_code == 500


# ══════════════════════════════════════════════════════════════════════════════
# Integration Test — live Sarvam API; skipped if no key is set
# ══════════════════════════════════════════════════════════════════════════════

_HAS_API_KEY = bool(os.getenv("SARVAM_API_KEY", "").strip())
_KEY_IS_PLACEHOLDER = os.getenv("SARVAM_API_KEY", "") in (
    "", "your_sarvam_api_key_here"
)


@pytest.mark.asyncio
@pytest.mark.skipif(
    not _HAS_API_KEY or _KEY_IS_PLACEHOLDER,
    reason="SARVAM_API_KEY not configured — skipping live integration test",
)
async def test_live_speech_generation():
    """
    Integration test: call the live Sarvam API with sample text.

    Automatically skipped in CI/CD when SARVAM_API_KEY is absent.
    On success the audio is saved to backend/voice/tests/sarvam_output.wav
    for manual listening verification.
    """
    from voice.tts.sarvam_service import generate_speech  # noqa

    try:
        audio_bytes, mime_type = await generate_speech(
            _SAMPLE_TEXT,
            speaker="aditya",
            language="en-IN",
        )

        assert isinstance(audio_bytes, bytes)
        assert len(audio_bytes) > 0
        assert "audio" in mime_type

        # Persist for manual check
        _OUTPUT_FILE.write_bytes(audio_bytes)

        logger.info("[INTEGRATION] TTS OK | bytes=%d | mime=%s", len(audio_bytes), mime_type)
        print(f"\n✅ Sarvam TTS Integration OK")
        print(f"   Bytes: {len(audio_bytes):,}")
        print(f"   MIME:  {mime_type}")
        print(f"   Saved: {_OUTPUT_FILE}\n")

    except Exception as exc:
        from fastapi import HTTPException as _HTTPException  # noqa

        if isinstance(exc, _HTTPException) and exc.status_code == 401:
            pytest.skip("Sarvam API key invalid — set a real SARVAM_API_KEY to run this test.")
        pytest.fail(f"Live TTS raised an unexpected exception: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
# Standalone script entry-point
# ══════════════════════════════════════════════════════════════════════════════

async def _standalone_main(text: str) -> None:
    """Call Sarvam TTS with *text*, print the result, and save the audio."""
    if _KEY_IS_PLACEHOLDER or not _HAS_API_KEY:
        print("⚠️  SARVAM_API_KEY is not set in backend/.env — cannot run live test.")
        sys.exit(1)

    print(f"🔊  Synthesising: {text!r} …")

    from voice.tts.sarvam_service import generate_speech  # noqa

    audio_bytes, mime_type = await generate_speech(text)

    _OUTPUT_FILE.write_bytes(audio_bytes)
    print(f"\n✅  Speech generated!")
    print(f"   Bytes:  {len(audio_bytes):,}")
    print(f"   MIME:   {mime_type}")
    print(f"   Saved:  {_OUTPUT_FILE}\n")


if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else _SAMPLE_TEXT
    asyncio.run(_standalone_main(text))
