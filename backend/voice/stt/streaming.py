"""
streaming.py — Real-time streaming Deepgram Speech-to-Text wrapper.

This module provides a DeepgramStreamer class to manage a continuous websocket
connection to Deepgram for real-time transcription of Twilio Media Streams.
"""

import asyncio
import logging
from typing import Optional

from deepgram.listen.v1.types.listen_v1results import ListenV1Results
from deepgram.listen.v1.types.listen_v1results import ListenV1Results
from deepgram.listen.v1.socket_client import AsyncV1SocketClient
from deepgram.core.events import EventType

from voice.stt.deepgram_client import get_deepgram_client
from voice.stt.deepgram_service import DEEPGRAM_MODEL, DEEPGRAM_LANGUAGE

logger = logging.getLogger("cyberdesk.voice.stt.streaming")


class DeepgramStreamer:
    """
    Manages a single streaming Deepgram STT connection.
    Intended to be created fresh per conversational turn (utterance).
    """

    def __init__(self):
        self._client = get_deepgram_client()
        self._socket_context = None
        self._socket: Optional[AsyncV1SocketClient] = None
        self._listen_task: Optional[asyncio.Task] = None
        self._final_transcript = ""
        self._is_finished = False
        self._speech_final_detected = False
        self._finished_event = asyncio.Event()

    async def start(self):
        """
        Open the websocket connection and start the background listening task.
        """
        # Configure for Twilio 8kHz mu-law
        self._socket_context = self._client.listen.v1.connect(
            model=DEEPGRAM_MODEL,
            language=DEEPGRAM_LANGUAGE,
            encoding="mulaw",
            sample_rate=8000,
            smart_format=True,
            punctuate=True,
            endpointing="500", 
            interim_results=True,
        )
        
        self._socket = await self._socket_context.__aenter__()
        
        self._final_transcript = ""
        self._interim_transcript = ""
        self._is_finished = False
        self._speech_final_detected = False
        self._finished_event = asyncio.Event()
        
        def on_message(result):
            try:
                t = result.channel.alternatives[0].transcript
                
                # Check for speech_final
                if getattr(result, "speech_final", False):
                    self._speech_final_detected = True
                    logger.info("[STT_STREAM] Speech final detected")
                    
                if result.is_final:
                    if t:
                        self._final_transcript += (" " if self._final_transcript else "") + t.strip()
                    self._interim_transcript = ""
                    logger.info("[STT_STREAM] Got final transcript: %r", t)
                else:
                    self._interim_transcript = t.strip()
            except (AttributeError, IndexError):
                pass
                
        def on_error(error):
            logger.warning("[STT_STREAM] Listen loop error: %s", error)
            
        def on_close(close_msg):
            self._finished_event.set()

        self._socket.on(EventType.MESSAGE, on_message)
        self._socket.on(EventType.ERROR, on_error)
        self._socket.on(EventType.CLOSE, on_close)
        
        self._listen_task = asyncio.create_task(self._socket.start_listening())

        logger.info("[STT_STREAM] Deepgram streaming connection opened")

    async def send_audio(self, mulaw_bytes: bytes):
        if self._socket and not self._is_finished:
            try:
                await self._socket.send_media(mulaw_bytes)
            except Exception as exc:
                logger.warning("[STT_STREAM] Error sending media: %s", exc)



    async def finish(self) -> str:
        """
        Tell Deepgram we are done sending audio, wait for the final transcript,
        and clean up the socket.
        """
        if self._is_finished:
            return (self._final_transcript + " " + self._interim_transcript).strip()
            
        self._is_finished = True
        
        # We must tell Deepgram we are done sending audio so it flushes
        # any remaining transcript immediately, then we wait for the final message.
        if self._socket:
            try:
                await self._socket.send_finalize()
                await self._socket.send_close_stream()
            except Exception as exc:
                logger.warning("[STT_STREAM] Error sending finalize: %s", exc)
                
        # Wait for the final transcript to arrive from Deepgram.
        if self._speech_final_detected and self._final_transcript:
            timeout_seconds = 0.2
        elif self._final_transcript and not self._interim_transcript:
            timeout_seconds = 0.5
        elif self._interim_transcript:
            timeout_seconds = 1.5
        else:
            timeout_seconds = 3.0
            
        logger.info(
            "[STT_STREAM] finish() waiting %.1fs | current_final=%r | current_interim=%r", 
            timeout_seconds, self._final_transcript, self._interim_transcript
        )
        
        try:
            await asyncio.wait_for(self._finished_event.wait(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            if not (self._final_transcript + " " + self._interim_transcript).strip():
                logger.warning("[STT_STREAM] Timed out waiting for final Deepgram transcript (empty)")
            else:
                logger.debug("[STT_STREAM] Proceeding with existing transcript (final event delayed)")
            
        final_result = (self._final_transcript + " " + self._interim_transcript).strip()
        logger.info("[STT_STREAM] finish() returning final transcript=%r", final_result)
        
        async def _cleanup(socket, context):
            if socket:
                try:
                    await socket.send_finalize()
                    await socket.send_close_stream()
                except Exception:
                    pass
            if context:
                try:
                    await context.__aexit__(None, None, None)
                except Exception:
                    pass
            if hasattr(self, '_listen_task'):
                self._listen_task.cancel()
                    
        asyncio.create_task(_cleanup(self._socket, self._socket_context))
        
        self._socket = None
        self._socket_context = None
        
        logger.debug("[STT_STREAM] Stream finished. Final transcript length: %d", len(final_result))
        return final_result
