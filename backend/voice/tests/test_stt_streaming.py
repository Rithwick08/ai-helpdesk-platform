"""
Tests for DeepgramStreamer lifecycle and processing.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from deepgram.listen.v1.types.listen_v1results import ListenV1Results
from deepgram.core.unchecked_base_model import UncheckedBaseModel

from voice.stt.streaming import DeepgramStreamer


# Mock classes for deepgram responses
class MockChannel(UncheckedBaseModel):
    alternatives: list = []

class MockAlternative(UncheckedBaseModel):
    transcript: str = ""

@pytest.fixture
def mock_deepgram_client():
    with patch("voice.stt.streaming.get_deepgram_client") as mock_get_client:
        mock_client = MagicMock()
        
        # Mock the context manager returned by connect()
        mock_context = AsyncMock()
        mock_socket = AsyncMock()
        
        # We need to simulate the async iterator __aiter__
        async def mock_aiter(self_mock=None):
            if False:
                yield None
        mock_socket.__aiter__ = mock_aiter
        
        mock_context.__aenter__.return_value = mock_socket
        mock_client.listen.v1.connect.return_value = mock_context
        
        mock_get_client.return_value = mock_client
        yield mock_client, mock_socket

@pytest.mark.asyncio
async def test_streamer_lifecycle(mock_deepgram_client):
    """Test start, send, and finish lifecycle."""
    client, socket = mock_deepgram_client
    
    streamer = DeepgramStreamer()
    await streamer.start()
    
    # Ensure connect was called with right params
    client.listen.v1.connect.assert_called_once()
    kwargs = client.listen.v1.connect.call_args.kwargs
    assert kwargs["encoding"] == "mulaw"
    assert kwargs["sample_rate"] == 8000
    
    # Test sending audio
    await streamer.send_audio(b"test audio")
    socket.send_media.assert_called_once_with(b"test audio")
    
    # Test finish
    transcript = await streamer.finish()
    
    # Yield to event loop to allow background cleanup task to run
    await asyncio.sleep(0.01)
    
    socket.send_finalize.assert_called_once()
    socket.send_close_stream.assert_called_once()
    assert transcript == ""
    
    # Verify idempotency of finish
    await streamer.finish()
    await asyncio.sleep(0.01)
    assert socket.send_finalize.call_count == 1

@pytest.mark.asyncio
async def test_streamer_transcript_assembly(mock_deepgram_client):
    """Test that transcripts are properly assembled from ListenV1Results."""
    client, socket = mock_deepgram_client
    
    # We will mock the type ListenV1Results directly to bypass Pydantic validation
    class DummyListenV1Results:
        def __init__(self, transcript, is_final):
            self.is_final = is_final
            self.transcript = transcript
            
        @property
        def channel(self):
            class Alt:
                def __init__(self, t):
                    self.transcript = t
            class Chan:
                def __init__(self, a):
                    self.alternatives = a
            return Chan([Alt(self.transcript)])

    res1 = DummyListenV1Results(transcript="hello", is_final=True)
    res2 = DummyListenV1Results(transcript="world", is_final=True)
    res3 = DummyListenV1Results(transcript="ignored", is_final=False)

    async def mock_aiter(self_mock=None):
        yield res1
        yield res2
        yield res3

    # To mock async for on socket, we can just replace the whole __aiter__ method
    socket.__aiter__ = mock_aiter
    
    streamer = DeepgramStreamer()
    await streamer.start()
    
    # Patch isinstance in streaming.py just for this test
    with patch("voice.stt.streaming.isinstance", return_value=True):
        # We must wait briefly for the listen loop to process the mock messages
        await asyncio.sleep(0.05)
        
        transcript = await streamer.finish()
        
    # Should only include final results, joined by spaces
    assert transcript == "hello world"
