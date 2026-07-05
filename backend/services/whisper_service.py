"""
whisper_service.py — Local Whisper transcription using faster-whisper.

The model singleton is lazy-loaded by default but can be pre-warmed at
application startup via prewarm_model() to eliminate the cold-start
penalty on the first voice request.

Model selection (ordered by speed vs accuracy trade-off on a Mac):
  - "tiny"   : ~39M params, fastest, lowest accuracy — good for quick demos
  - "base"   : ~74M params, good balance for English enterprise speech
  - "small"  : ~244M params, better accuracy, 2-3s on Apple Silicon
  - "medium" : large, accurate, slower

Change WHISPER_MODEL_SIZE to "small" or "medium" for higher accuracy.

Dependencies (install once):
    pip install faster-whisper

ffmpeg must also be available on the system PATH for audio decoding:
    brew install ffmpeg      # macOS
"""

import io
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger("cyberdesk.whisper")

# ── Configuration ──────────────────────────────────────────────────────────────
# Override with env var WHISPER_MODEL_SIZE if desired.
WHISPER_MODEL_SIZE   = os.getenv("WHISPER_MODEL_SIZE",   "base")
WHISPER_DEVICE       = os.getenv("WHISPER_DEVICE",       "cpu")          # "cpu" | "cuda" | "auto"
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")         # "int8" on CPU is fastest
WHISPER_LANGUAGE     = os.getenv("WHISPER_LANGUAGE",     "en")           # force English for speed

# ── Lazy model singleton ───────────────────────────────────────────────────────
_model = None


def _get_model():
    """Return (or lazily initialise) the faster-whisper model singleton."""
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel  # noqa: import-outside-toplevel
        except ImportError:
            raise RuntimeError(
                "faster-whisper is not installed. "
                "Run: pip install faster-whisper"
            )

        logger.info(
            "[WHISPER] Loading model: size=%s device=%s compute=%s",
            WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE,
        )
        _model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
        )
        logger.info("[WHISPER] Model ready.")
    return _model


def prewarm_model() -> None:
    """
    Eagerly load and warm-up the Whisper model.

    Call this during application startup (e.g. FastAPI lifespan) so the
    first real voice request experiences zero cold-start delay.

    Safe to call multiple times — subsequent calls are no-ops because the
    singleton is already initialised.
    """
    try:
        _get_model()
        logger.info("[WHISPER] Model preloaded successfully.")
    except Exception as exc:
        logger.error("[WHISPER] Pre-warm failed: %s", exc)


def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/webm") -> Optional[str]:
    """
    Transcribe raw audio bytes to text.

    Args:
        audio_bytes:  Raw bytes from the uploaded file (webm, wav, ogg, mp4, etc.)
        content_type: MIME type from the upload (informational only).

    Returns:
        The transcribed text as a string, or None if transcription fails.

    Side effects:
        Writes a temporary file (cleaned up automatically).
    """
    if not audio_bytes:
        logger.warning("[WHISPER] Empty audio bytes — skipping")
        return None

    # Determine file extension from content_type for ffmpeg to decode correctly
    ext = _mime_to_ext(content_type)

    try:
        model = _get_model()
    except RuntimeError as exc:
        logger.error("[WHISPER] Model unavailable: %s", exc)
        return None

    # Write to a named temp file — faster-whisper needs a file path
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        logger.info(
            "[WHISPER] Transcribing %d bytes (%s) from %s",
            len(audio_bytes), content_type, tmp_path,
        )

        segments, info = model.transcribe(
            tmp_path,
            language=WHISPER_LANGUAGE,
            beam_size=1,              # OP-2: beam_size=1 for ~60% faster CPU inference
            vad_filter=True,          # skip silence automatically
            vad_parameters=dict(
                min_silence_duration_ms=300,
            ),
        )

        transcript = " ".join(seg.text.strip() for seg in segments).strip()

        logger.info(
            "[WHISPER] Transcription complete | lang=%s prob=%.2f | text=%r",
            info.language, info.language_probability,
            transcript[:80],
        )
        return transcript if transcript else None

    except Exception as exc:
        logger.error("[WHISPER] Transcription error: %s", exc, exc_info=True)
        return None
    finally:
        # Always clean up temp file
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


def _mime_to_ext(content_type: str) -> str:
    """Map MIME type to a file extension that ffmpeg understands."""
    mapping = {
        "audio/webm":       ".webm",
        "audio/ogg":        ".ogg",
        "audio/wav":        ".wav",
        "audio/wave":       ".wav",
        "audio/x-wav":      ".wav",
        "audio/mp4":        ".mp4",
        "audio/mpeg":       ".mp3",
        "audio/mp3":        ".mp3",
        "audio/flac":       ".flac",
        "audio/x-flac":     ".flac",
        "video/webm":       ".webm",  # Chrome sometimes sends video/webm for MediaRecorder
        "application/octet-stream": ".webm",  # fallback
    }
    return mapping.get(content_type.lower().split(";")[0].strip(), ".webm")
