"""
voice/telephony/ — Twilio Telephony Integration module for CyberShield AI.

Phase 1: Telephony connectivity and incoming call handling.

Public API:
    twilio_client.py   — Singleton Twilio REST client & request validator
    twiml.py           — Reusable TwiML XML generators
    call_session.py    — Lightweight CallSession metadata model
    exceptions.py      — Telephony exception hierarchy
    routes.py          — FastAPI router: POST /telephony/incoming

Pipeline position:
    Caller → Twilio PSTN → Ngrok / Webhook → **POST /telephony/incoming** → TwiML Response
"""
