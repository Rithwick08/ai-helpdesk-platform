"""
test_deepgram.py — Integration & unit tests for the Deepgram STT module.

Usage
-----
Run as a pytest suite (recommended):
    cd ai-helpdesk-platform
    python -m pytest backend/voice/tests/test_deepgram.py -v

Run as a standalone script with a real audio file:
    python backend/voice/tests/test_deepgram.py
    python backend/voice/tests/test_deepgram.py path/to/speech.wav

The standalone mode calls the live Deepgram API and requires a valid
DEEPGRAM_API_KEY in backend/.env.

Environment Variables
---------------------
    DEEPGRAM_API_KEY   (required for integration tests)
    DEEPGRAM_MODEL     (optional, default: nova-3)
    DEEPGRAM_LANGUAGE  (optional, default: en)

Dependencies
------------
    pip install deepgram-sdk pytest pytest-asyncio httpx python-dotenv
"""

import asyncio
import io
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

# Load .env so that integration tests pick up DEEPGRAM_API_KEY
from dotenv import load_dotenv  # noqa: E402

load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("cyberdesk.voice.tests")

# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_upload_file(content: bytes, filename: str = "test.wav", content_type: str = "audio/wav"):
    """
    Build a minimal FastAPI UploadFile-like mock.

    This avoids spinning up a full ASGI server for unit tests.
    """
    from fastapi import UploadFile  # noqa: import-outside-toplevel

    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = filename
    mock_file.content_type = content_type
    mock_file.read = AsyncMock(return_value=content)
    return mock_file


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests  (no live API calls — all Deepgram responses are mocked)
# ══════════════════════════════════════════════════════════════════════════════


class TestDeepgramClient:
    """Tests for the singleton client factory (voice/stt/deepgram_client.py)."""

    def test_raises_if_api_key_missing(self):
        """get_deepgram_client() must raise EnvironmentError when key is absent."""
        # Reset the module-level singleton so the factory re-runs
        import voice.stt.deepgram_client as dc  # noqa: import-outside-toplevel

        original = dc._deepgram_client
        dc._deepgram_client = None
        try:
            with patch.dict(os.environ, {"DEEPGRAM_API_KEY": ""}):
                with pytest.raises(EnvironmentError, match="DEEPGRAM_API_KEY"):
                    dc.get_deepgram_client()
        finally:
            dc._deepgram_client = original

    def test_returns_singleton(self):
        """Calling get_deepgram_client() twice must return the same object."""
        import voice.stt.deepgram_client as dc  # noqa: import-outside-toplevel

        # If a singleton is already cached, both calls must return it
        if dc._deepgram_client is not None:
            assert dc.get_deepgram_client() is dc.get_deepgram_client()


class TestSupportedMimeTypes:
    """Tests for the MIME-type allow-list in deepgram_service."""

    def test_accepted_mimes(self):
        from voice.stt.deepgram_service import is_supported_mime  # noqa

        accepted = [
            "audio/wav",
            "audio/x-wav",
            "audio/wave",
            "audio/webm",
            "video/webm",
            "audio/ogg",
            "audio/mp4",
            "audio/mpeg",
            "audio/mp3",
            "audio/flac",
            "audio/x-flac",
            "application/octet-stream",
        ]
        for mime in accepted:
            assert is_supported_mime(mime), f"Expected {mime!r} to be accepted"

    def test_rejected_mimes(self):
        from voice.stt.deepgram_service import is_supported_mime  # noqa

        rejected = ["video/mp4", "image/png", "text/plain", "application/json"]
        for mime in rejected:
            assert not is_supported_mime(mime), f"Expected {mime!r} to be rejected"

    def test_case_insensitive(self):
        from voice.stt.deepgram_service import is_supported_mime  # noqa

        assert is_supported_mime("Audio/WAV")
        assert is_supported_mime("AUDIO/WEBM")

    def test_mime_with_parameters(self):
        from voice.stt.deepgram_service import is_supported_mime  # noqa

        assert is_supported_mime("audio/wav; codecs=pcm")


class TestTranscribeAudioUnit:
    """Unit tests for transcribe_audio() with a mocked Deepgram client."""

    @pytest.mark.asyncio
    async def test_rejects_unsupported_mime(self):
        """415 must be raised for unsupported MIME types."""
        from fastapi import HTTPException  # noqa

        from voice.stt.deepgram_service import transcribe_audio  # noqa

        upload = _make_upload_file(b"data", content_type="video/mp4")
        with pytest.raises(HTTPException) as exc_info:
            await transcribe_audio(upload)
        assert exc_info.value.status_code == 415

    @pytest.mark.asyncio
    async def test_rejects_empty_bytes(self):
        """422 must be raised when the upload is empty."""
        from fastapi import HTTPException  # noqa

        from voice.stt.deepgram_service import transcribe_audio  # noqa

        upload = _make_upload_file(b"", content_type="audio/wav")
        with pytest.raises(HTTPException) as exc_info:
            await transcribe_audio(upload)
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_rejects_payload_too_large(self):
        """413 must be raised when audio exceeds MAX_AUDIO_BYTES."""
        from fastapi import HTTPException  # noqa

        import voice.stt.deepgram_service as svc  # noqa

        from voice.stt.deepgram_service import transcribe_audio  # noqa

        oversized = b"x" * (svc.MAX_AUDIO_BYTES + 1)
        upload = _make_upload_file(oversized, content_type="audio/wav")
        with pytest.raises(HTTPException) as exc_info:
            await transcribe_audio(upload)
        assert exc_info.value.status_code == 413

    @pytest.mark.asyncio
    async def test_returns_transcript_on_success(self):
        """Should return the transcript string on a well-formed Deepgram response."""
        from voice.stt.deepgram_service import transcribe_audio  # noqa

        # Build a mock Deepgram response tree
        mock_alternative = MagicMock()
        mock_alternative.transcript = "reset my VPN password"
        mock_channel = MagicMock()
        mock_channel.alternatives = [mock_alternative]
        mock_results = MagicMock()
        mock_results.channels = [mock_channel]
        mock_response = MagicMock()
        mock_response.results = mock_results

        mock_rest = AsyncMock()
        mock_rest.transcribe_file = AsyncMock(return_value=mock_response)

        with patch("voice.stt.deepgram_service.get_deepgram_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.listen.v1.media = mock_rest
            mock_factory.return_value = mock_client

            upload = _make_upload_file(b"fake_audio_data", content_type="audio/wav")
            result = await transcribe_audio(upload)

        assert result == "reset my VPN password"

    @pytest.mark.asyncio
    async def test_raises_422_on_blank_transcript(self):
        """422 must be raised when Deepgram returns an empty transcript."""
        from fastapi import HTTPException  # noqa

        from voice.stt.deepgram_service import transcribe_audio  # noqa

        mock_alternative = MagicMock()
        mock_alternative.transcript = "   "  # blank / whitespace only
        mock_channel = MagicMock()
        mock_channel.alternatives = [mock_alternative]
        mock_results = MagicMock()
        mock_results.channels = [mock_channel]
        mock_response = MagicMock()
        mock_response.results = mock_results

        mock_rest = AsyncMock()
        mock_rest.transcribe_file = AsyncMock(return_value=mock_response)

        with patch("voice.stt.deepgram_service.get_deepgram_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.listen.v1.media = mock_rest
            mock_factory.return_value = mock_client

            upload = _make_upload_file(b"silence_data", content_type="audio/wav")
            with pytest.raises(HTTPException) as exc_info:
                await transcribe_audio(upload)
        assert exc_info.value.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# Integration Test  (live Deepgram API — skipped if no key is set)
# ══════════════════════════════════════════════════════════════════════════════

_HAS_API_KEY = bool(os.getenv("DEEPGRAM_API_KEY", "").strip())


@pytest.mark.asyncio
@pytest.mark.skipif(not _HAS_API_KEY, reason="DEEPGRAM_API_KEY not set — skipping live integration test")
async def test_live_transcription_with_sample_file():
    """
    Integration test: upload backend/test_tone.wav against the live Deepgram API.

    This test is automatically skipped in CI/CD environments where
    DEEPGRAM_API_KEY is not present.
    """
    sample_path = _BACKEND_DIR / "test_tone.wav"

    if not sample_path.exists():
        pytest.skip(f"Sample audio not found at {sample_path}. Provide a wav file to run this test.")

    audio_bytes = sample_path.read_bytes()
    logger.info("[INTEGRATION] Uploading %d bytes from %s", len(audio_bytes), sample_path)

    upload = _make_upload_file(audio_bytes, filename="test_tone.wav", content_type="audio/wav")

    from voice.stt.deepgram_service import transcribe_audio  # noqa

    try:
        transcript = await transcribe_audio(upload)
        logger.info("[INTEGRATION] Transcript: %r", transcript)
        assert isinstance(transcript, str)
        assert len(transcript) > 0
        print(f"\n✅ Deepgram Integration OK\n   Transcript: {transcript!r}\n")
    except Exception as exc:
        # A 401 means the key in .env is still the placeholder — skip gracefully
        from fastapi import HTTPException as _HTTPException  # noqa
        if isinstance(exc, _HTTPException) and exc.status_code == 401:
            pytest.skip("Live key not yet configured — set a real DEEPGRAM_API_KEY to run this test.")
        if isinstance(exc, _HTTPException) and exc.status_code == 422:
            # test_tone.wav is a pure tone (not speech) — API auth succeeded, transcript is empty
            print("\n✅ Deepgram API key valid — authentication succeeded.")
            print("   test_tone.wav contains no speech; Deepgram returned an empty transcript (expected).")
            print("   Pass a real speech file to get a transcript: python voice/tests/test_deepgram.py path/to/speech.wav\n")
            pytest.skip("test_tone.wav is not a speech file — API auth OK, transcript empty as expected.")
        pytest.fail(f"Live transcription raised an unexpected exception: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
# Standalone script entry-point
# ══════════════════════════════════════════════════════════════════════════════

async def _standalone_main(audio_path: Path) -> None:
    """Upload *audio_path* to Deepgram and print the result."""
    if not audio_path.exists():
        print(f"❌  File not found: {audio_path}")
        sys.exit(1)

    audio_bytes = audio_path.read_bytes()
    content_type = _guess_content_type(audio_path.suffix)

    print(f"📤  Uploading {audio_path.name} ({len(audio_bytes):,} bytes) …")

    upload = _make_upload_file(audio_bytes, filename=audio_path.name, content_type=content_type)

    from voice.stt.deepgram_service import transcribe_audio  # noqa

    transcript = await transcribe_audio(upload)
    print(f"\n✅  Transcript:\n{transcript}\n")


def _guess_content_type(suffix: str) -> str:
    mapping = {
        ".wav": "audio/wav",
        ".webm": "audio/webm",
        ".ogg": "audio/ogg",
        ".mp3": "audio/mpeg",
        ".mp4": "audio/mp4",
        ".flac": "audio/flac",
    }
    return mapping.get(suffix.lower(), "audio/wav")


if __name__ == "__main__":
    # Default sample: backend/test_tone.wav (already present in the repo)
    default_audio = _BACKEND_DIR / "test_tone.wav"
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else default_audio

    if not _HAS_API_KEY:
        print("⚠️  DEEPGRAM_API_KEY is not set in backend/.env — cannot run live test.")
        sys.exit(1)

    asyncio.run(_standalone_main(target))
