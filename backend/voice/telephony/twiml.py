"""
twiml.py — Reusable TwiML XML generators for CyberShield AI telephony.

Uses the official Twilio Python SDK ``twilio.twiml.voice_response.VoiceResponse``
to build structured XML responses.  Never constructs raw XML strings manually.

Design principles
-----------------
• Reusable helper functions for different telephony flows.
• Uses standard TwiML elements (<Say>, <Connect>, <Stream>, <Hangup>, <Pause>).
• Supports configurable welcome greetings, voices, and Media Streams WebSockets.
"""

import logging
from typing import Optional

from voice.telephony.exceptions import TwiMLError

logger = logging.getLogger("cyberdesk.voice.telephony.twiml")

DEFAULT_WELCOME_MESSAGE = (
    "Welcome to CyberShield AI. please tell me how I can help you."
)

DEFAULT_VOICE = "Polly.Aditi"  # Clean Indian-English voice available in Twilio
DEFAULT_LANGUAGE = "en-IN"


def build_media_stream_twiml(
    stream_url: str,
    greeting: Optional[str] = DEFAULT_WELCOME_MESSAGE,
    voice: str = DEFAULT_VOICE,
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """
    Generate TwiML XML to connect an incoming call to a Twilio Media Stream WebSocket.

    Parameters
    ----------
    stream_url : str
        The WebSocket URL (e.g. 'wss://xyz.ngrok-free.app/telephony/media').
    greeting : str, optional
        Optional initial spoken message before stream connection.
    voice : str, optional
        Voice identifier for greeting.
    language : str, optional
        Language identifier for greeting.

    Returns
    -------
    str
        Valid TwiML XML string ready for HTTP response body.
    """
    try:
        from twilio.twiml.voice_response import Connect, VoiceResponse  # noqa: import-outside-toplevel

        # Ensure scheme is wss:// or ws:// for Twilio Media Streams
        if stream_url.startswith("https://"):
            wss_url = "wss://" + stream_url[8:]
        elif stream_url.startswith("http://"):
            wss_url = "ws://" + stream_url[7:]
        else:
            wss_url = stream_url

        response = VoiceResponse()

        if greeting and greeting.strip():
            response.say(greeting.strip(), voice=voice, language=language)

        connect = Connect()
        connect.stream(url=wss_url)
        response.append(connect)

        xml_output = str(response)
        logger.info("[TWIML] Generated greeting + Media Stream TwiML | stream_url=%s | length=%d bytes", wss_url, len(xml_output))
        return xml_output

    except Exception as exc:
        logger.error("[TWIML] Failed to generate Media Stream TwiML: %s", exc, exc_info=True)
        raise TwiMLError(f"Media Stream TwiML generation failed: {exc}") from exc


def build_welcome_twiml(
    message: Optional[str] = None,
    voice: str = DEFAULT_VOICE,
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """
    Generate TwiML XML to speak a welcome greeting and hang up cleanly.
    """
    try:
        from twilio.twiml.voice_response import VoiceResponse  # noqa: import-outside-toplevel

        greeting = message.strip() if message and message.strip() else DEFAULT_WELCOME_MESSAGE

        response = VoiceResponse()
        response.say(greeting, voice=voice, language=language)
        response.pause(length=1)
        response.hangup()

        xml_output = str(response)
        logger.info("[TWIML] Generated welcome TwiML | length=%d bytes", len(xml_output))
        return xml_output

    except Exception as exc:
        logger.error("[TWIML] Failed to generate welcome TwiML: %s", exc, exc_info=True)
        raise TwiMLError(f"TwiML generation failed: {exc}") from exc


def build_error_twiml(
    message: Optional[str] = None,
    voice: str = DEFAULT_VOICE,
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """
    Generate TwiML XML for an error message and hangup.
    """
    try:
        from twilio.twiml.voice_response import VoiceResponse  # noqa: import-outside-toplevel

        error_text = (
            message.strip()
            if message and message.strip()
            else "We are experiencing technical difficulties. Please try again later."
        )

        response = VoiceResponse()
        response.say(error_text, voice=voice, language=language)
        response.hangup()

        return str(response)

    except Exception as exc:
        logger.error("[TWIML] Failed to generate error TwiML: %s", exc, exc_info=True)
        raise TwiMLError("Failed to generate error TwiML.") from exc
