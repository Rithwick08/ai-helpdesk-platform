"""
test_media_stream.py — Unit & integration tests for Twilio Media Streams, audio codec, and WebSocket.
"""

import base64
import json
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── Bootstrap: make backend/ importable ────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))


class TestAudioCodec:

    def test_mulaw_to_wav_conversion(self):
        from voice.telephony.audio_codec import mulaw_to_wav  # noqa

        # 160 bytes of 8kHz mu-law (20ms)
        fake_mulaw = b"\xff" * 160
        wav_bytes = mulaw_to_wav(fake_mulaw, source_rate=8000, target_rate=16000)

        assert wav_bytes.startswith(b"RIFF")
        assert len(wav_bytes) > len(fake_mulaw)

    def test_wav_to_twilio_mulaw_conversion(self):
        from voice.telephony.audio_codec import mulaw_to_wav, wav_to_twilio_mulaw  # noqa

        fake_mulaw = b"\xff" * 160
        wav_bytes = mulaw_to_wav(fake_mulaw, source_rate=8000, target_rate=16000)

        out_mulaw = wav_to_twilio_mulaw(wav_bytes, target_rate=8000)
        assert isinstance(out_mulaw, bytes)
        assert len(out_mulaw) > 0

    def test_mulaw_to_b64_frames(self):
        from voice.telephony.audio_codec import mulaw_to_b64_frames  # noqa

        mulaw_data = b"\xff" * 320  # 2 frames of 160 bytes
        frames = mulaw_to_b64_frames(mulaw_data, frame_size=160)
        assert len(frames) == 2
        assert isinstance(frames[0], str)
        assert base64.b64decode(frames[0]) == b"\xff" * 160


class TestStreamSession:

    def test_stream_session_add_media_chunk(self):
        from voice.telephony.stream_session import StreamSession  # noqa

        s = StreamSession(call_sid="CA123", stream_sid="MZ456")
        b64 = base64.b64encode(b"\xff" * 160).decode()

        s.add_media_chunk(b64)
        assert s.packet_count == 1
        assert s.bytes_received == 160
        assert s.buffered_bytes_count == 160

        data = s.get_and_clear_audio_bytes()
        assert data == b"\xff" * 160
        assert s.buffered_bytes_count == 0

    def test_stream_session_record_turn(self):
        from voice.telephony.stream_session import StreamSession  # noqa

        s = StreamSession(call_sid="CA123")
        turn = s.record_turn(
            transcript="hello",
            response_text="hi",
            agent_status="chat",
            audio_bytes_sent=1000,
            stt_latency_ms=100,
            ai_latency_ms=200,
            tts_latency_ms=150,
        )
        assert turn.turn_number == 1
        assert turn.total_latency_ms == 450


class TestMediaStreamTwiML:

    def test_build_media_stream_twiml(self):
        from voice.telephony.twiml import build_media_stream_twiml  # noqa

        xml = build_media_stream_twiml("https://test.ngrok-free.app/telephony/incoming")
        assert "<Connect>" in xml
        assert "<Stream url=\"wss://test.ngrok-free.app/telephony/media\"" in xml or "<Stream url=\"wss://test.ngrok-free.app/telephony/incoming\"" in xml


class TestMediaStreamProcessUtterance:

    @pytest.mark.asyncio
    async def test_process_stream_utterance_mocked(self):
        from voice.pipeline.schemas import VoiceResponse  # noqa
        from voice.telephony.media_stream import process_stream_utterance  # noqa
        from voice.telephony.stream_session import StreamSession  # noqa

        s = StreamSession(call_sid="CA999")
        fake_mulaw = b"\xff" * 3200  # ~0.4s audio

        fake_pipeline_response = VoiceResponse(
            transcript="reset password",
            response_text="I can help with that.",
            audio_bytes=b"RIFF" + b"\x00" * 40,
            mime_type="audio/wav",
            conversation_id=12,
            agent_status="waiting",
            session_id="sess-123",
        )

        with patch("voice.telephony.media_stream.process_voice_request", new_callable=AsyncMock) as mock_p:
            mock_p.return_value = fake_pipeline_response

            b64_frames, text, conv_id, status = await process_stream_utterance(
                session=s,
                mulaw_bytes=fake_mulaw,
                current_user=MagicMock(),
                db=MagicMock(),
            )

        assert len(b64_frames) > 0
        assert text == "I can help with that."
        assert conv_id == 12
        assert status == "waiting"
