"""
voice/pipeline/ — Voice pipeline orchestration package for CyberShield AI.

This package is the glue layer between the two voice I/O modules and the
existing AI reasoning engine.  It does NOT implement any AI logic itself.

Pipeline:
    Audio Upload
        ↓ deepgram_service.transcribe_audio()
    Transcript (str)
        ↓ _call_assistant_chat()  ← the SAME entry-point used by the React UI
    AI Response (dict)
        ↓ sarvam_service.generate_speech()
    Audio Response (bytes)

Public surface:
    voice_pipeline.py   — process_voice_request()
    voice_session.py    — VoiceSession (in-memory per-request model)
    schemas.py          — VoiceResponse Pydantic model
    exceptions.py       — VoicePipelineError hierarchy
    routes.py           — POST /voice/chat  FastAPI router
"""
