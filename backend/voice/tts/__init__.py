"""
voice/tts/ — Sarvam AI Text-to-Speech sub-package for CyberShield AI.

Public API:
    sarvam_client.py   — singleton AsyncSarvamAI client factory
    sarvam_service.py  — generate_speech() service function
    routes.py          — FastAPI router: POST /voice/speak

Pipeline position:
    Deepgram STT → CyberShield AI → **Sarvam TTS** → Twilio (future)
"""
