"""
audio_codec.py — Audio format and sampling rate converter for Twilio Media Streams.

Twilio Media Streams protocol uses:
    • Encoding:  audio/x-mulaw (G.711 mu-law 8-bit PCM)
    • Rate:      8000 Hz (8 kHz)
    • Channels:  1 (Mono)

Deepgram STT & Sarvam AI TTS use standard WAV / PCM formats (16-bit PCM, 16-22.05 kHz).

This module isolates all format conversion and resampling logic using `audioop_lts`
(Python 3.13 compatible drop-in for `audioop`).
"""

import base64
import io
import logging
import wave
from typing import List, Tuple

import audioop

logger = logging.getLogger("cyberdesk.voice.telephony.codec")

TWILIO_SAMPLE_RATE = 8000
TWILIO_SAMPLE_WIDTH = 1     # 8-bit mu-law
TWILIO_CHANNELS = 1

PIPELINE_SAMPLE_RATE = 16000  # 16 kHz 16-bit PCM for Deepgram
PIPELINE_SAMPLE_WIDTH = 2    # 16-bit PCM

# Twilio Media Streams send 20 ms audio frames (8000 Hz * 0.02s = 160 samples = 160 bytes of mu-law)
TWILIO_FRAME_BYTES = 160


def mulaw_to_wav(
    mulaw_bytes: bytes,
    source_rate: int = TWILIO_SAMPLE_RATE,
    target_rate: int = PIPELINE_SAMPLE_RATE,
) -> bytes:
    """
    Convert raw 8-bit mu-law audio (from Twilio Media Stream) into 16-bit PCM WAV.

    Parameters
    ----------
    mulaw_bytes : bytes
        Raw 8-bit mu-law audio bytes accumulated from Twilio media events.
    source_rate : int
        Incoming sample rate (default: 8000 Hz).
    target_rate : int
        Target sample rate for the output WAV (default: 16000 Hz).

    Returns
    -------
    bytes
        Valid RIFF WAV bytes (16-bit PCM, mono, target_rate Hz).
    """
    if not mulaw_bytes:
        return b""

    try:
        # 1. Convert 8-bit mu-law -> 16-bit linear PCM (width=2)
        pcm_16bit = audioop.ulaw2lin(mulaw_bytes, PIPELINE_SAMPLE_WIDTH)

        # 2. Resample to target rate (e.g. 8000 Hz -> 16000 Hz) if needed
        if source_rate != target_rate:
            pcm_16bit, _ = audioop.ratecv(
                pcm_16bit,
                PIPELINE_SAMPLE_WIDTH,
                TWILIO_CHANNELS,
                source_rate,
                target_rate,
                None,
            )

        # 3. Package linear PCM into a standard RIFF WAV buffer
        wav_buf = io.BytesIO()
        with wave.open(wav_buf, "wb") as wf:
            wf.setnchannels(TWILIO_CHANNELS)
            wf.setsampwidth(PIPELINE_SAMPLE_WIDTH)
            wf.setframerate(target_rate)
            wf.writeframes(pcm_16bit)

        wav_data = wav_buf.getvalue()
        logger.debug(
            "[CODEC] mulaw -> WAV converted | in_bytes=%d | out_bytes=%d | rate=%dHz",
            len(mulaw_bytes),
            len(wav_data),
            target_rate,
        )
        return wav_data

    except Exception as exc:
        logger.error("[CODEC] Failed to convert mulaw to WAV: %s", exc, exc_info=True)
        raise ValueError("Audio conversion mulaw -> WAV failed.") from exc


def wav_to_twilio_mulaw(
    audio_bytes: bytes,
    target_rate: int = TWILIO_SAMPLE_RATE,
) -> bytes:
    """
    Convert WAV/PCM audio (from Sarvam AI TTS response) into 8-bit mu-law 8kHz audio.

    Parameters
    ----------
    audio_bytes : bytes
        WAV or raw PCM audio bytes returned by Sarvam AI TTS.
    target_rate : int
        Target sample rate for Twilio (default: 8000 Hz).

    Returns
    -------
    bytes
        Raw 8-bit mu-law audio bytes at 8000 Hz.
    """
    if not audio_bytes:
        return b""

    try:
        # Try reading as WAV file first
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                rate = wf.getframerate()
                pcm_data = wf.readframes(wf.getnframes())
        except Exception:
            # Fallback: treat as raw 16-bit 22.05kHz PCM
            channels = 1
            sample_width = PIPELINE_SAMPLE_WIDTH
            rate = 22050
            pcm_data = audio_bytes

        # Convert stereo to mono if needed
        if channels == 2:
            pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)

        # Convert sample width to 16-bit if not already
        if sample_width != PIPELINE_SAMPLE_WIDTH:
            pcm_data = audioop.lin2lin(pcm_data, sample_width, PIPELINE_SAMPLE_WIDTH)

        # Resample to 8000 Hz
        if rate != target_rate:
            pcm_data, _ = audioop.ratecv(
                pcm_data,
                PIPELINE_SAMPLE_WIDTH,
                1,
                rate,
                target_rate,
                None,
            )

        # Convert 16-bit linear PCM -> 8-bit mu-law
        mulaw_data = audioop.lin2ulaw(pcm_data, PIPELINE_SAMPLE_WIDTH)

        logger.debug(
            "[CODEC] WAV -> mulaw converted | in_bytes=%d | out_bytes=%d | orig_rate=%dHz",
            len(audio_bytes),
            len(mulaw_data),
            rate,
        )
        return mulaw_data

    except Exception as exc:
        logger.error("[CODEC] Failed to convert WAV to Twilio mulaw: %s", exc, exc_info=True)
        raise ValueError("Audio conversion WAV -> mulaw failed.") from exc


def mulaw_to_b64_frames(
    mulaw_bytes: bytes,
    frame_size: int = TWILIO_FRAME_BYTES,
) -> List[str]:
    """
    Split a buffer of mu-law audio bytes into ~20ms frames and base64 encode each.

    Parameters
    ----------
    mulaw_bytes : bytes
        Raw mu-law audio buffer.
    frame_size : int
        Bytes per frame (default: 160 bytes = 20ms at 8kHz).

    Returns
    -------
    list[str]
        List of base64-encoded strings ready for Twilio media event payloads.
    """
    frames = []
    total_len = len(mulaw_bytes)
    for i in range(0, total_len, frame_size):
        chunk = mulaw_bytes[i : i + frame_size]
        b64 = base64.b64encode(chunk).decode("utf-8")
        frames.append(b64)
    return frames
