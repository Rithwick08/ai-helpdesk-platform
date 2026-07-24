"""
exceptions.py — Voice pipeline error hierarchy for CyberShield AI.

All pipeline-specific exceptions extend VoicePipelineError so callers
can catch the base class when they don't need to distinguish stages.

Hierarchy
---------
VoicePipelineError
├── STTError          — Deepgram transcription failures
├── AIError           — CyberShield AI agent failures
└── TTSError          — Sarvam TTS failures
"""


class VoicePipelineError(Exception):
    """Base class for all voice pipeline failures."""

    def __init__(self, message: str, stage: str = "pipeline", http_status: int = 500):
        super().__init__(message)
        self.stage = stage
        self.http_status = http_status


class STTError(VoicePipelineError):
    """Raised when the Deepgram STT stage fails."""

    def __init__(self, message: str, http_status: int = 500):
        super().__init__(message, stage="stt", http_status=http_status)


class AIError(VoicePipelineError):
    """Raised when the CyberShield AI agent stage fails."""

    def __init__(self, message: str, http_status: int = 500):
        super().__init__(message, stage="ai", http_status=http_status)


class TTSError(VoicePipelineError):
    """Raised when the Sarvam TTS stage fails."""

    def __init__(self, message: str, http_status: int = 500):
        super().__init__(message, stage="tts", http_status=http_status)
