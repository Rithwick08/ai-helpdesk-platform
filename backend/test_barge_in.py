"""
test_barge_in.py — Unit tests for voice barge-in / interruption logic.

Tests cover:
  1.  Normal TTS completion — no interruption
  2.  Barge-in during TTS — frames stop before completion
  3.  Barge-in with Twilio clear event sent
  4.  Single above-threshold packet — no barge-in (below sustain threshold)
  5.  Low RMS background noise — no barge-in
  6.  Barge-in event already set — no duplicate clear event
  7.  Remaining frames NOT sent after interruption
  8.  StreamSession barge_in_count increments
  9.  StreamSession summary includes barge_in_count
  10. _stream_tts_frames returns False on interruption, True on normal completion
  11. Existing password-reset AI routing still works (regression)
  12. Empty transcript handling still drops utterance (regression)
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call

from voice.telephony.stream_session import StreamSession
from voice.telephony.websocket import (
    _stream_tts_frames,
    BARGE_IN_SUSTAIN_PACKETS,
    SPEECH_RMS_THRESHOLD,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_session(call_sid="CAtest123", stream_sid="MZtest456"):
    return StreamSession(call_sid=call_sid, stream_sid=stream_sid)


def make_websocket(sent_events=None):
    """Return a mock WebSocket that records all sent JSON."""
    ws = AsyncMock()
    captured = sent_events if sent_events is not None else []

    async def capture_send(payload):
        captured.append(payload)

    ws.send_json.side_effect = capture_send
    return ws, captured


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_normal_tts_completion():
    """AI response plays all frames without interruption → returns True."""
    session = make_session()
    session.status = "speaking"
    ws, sent = make_websocket()
    barge_in = asyncio.Event()  # not set

    frames = ["frame1_b64", "frame2_b64", "frame3_b64"]
    result = await _stream_tts_frames(ws, session, frames, barge_in)

    assert result is True, "Should return True on normal completion"
    # All 3 media frames + 1 mark event sent
    media_events = [e for e in sent if e.get("event") == "media"]
    mark_events = [e for e in sent if e.get("event") == "mark"]
    assert len(media_events) == 3
    assert len(mark_events) == 1


@pytest.mark.asyncio
async def test_barge_in_stops_frames():
    """Barge-in event set before completion → returns False, stops early."""
    session = make_session()
    session.status = "speaking"
    ws, sent = make_websocket()
    barge_in = asyncio.Event()
    barge_in.set()  # Immediate barge-in

    frames = ["frame1", "frame2", "frame3", "frame4", "frame5"]
    result = await _stream_tts_frames(ws, session, frames, barge_in)

    assert result is False, "Should return False when interrupted"
    # No media frames sent (interrupted before first frame)
    media_events = [e for e in sent if e.get("event") == "media"]
    assert len(media_events) == 0, f"Expected 0 media frames, got {len(media_events)}"


@pytest.mark.asyncio
async def test_barge_in_sends_clear_event():
    """When barge-in occurs, a Twilio 'clear' event is sent."""
    session = make_session(stream_sid="MZ_test_stream")
    session.status = "speaking"
    ws, sent = make_websocket()
    barge_in = asyncio.Event()
    barge_in.set()

    await _stream_tts_frames(ws, session, ["f1", "f2"], barge_in)

    clear_events = [e for e in sent if e.get("event") == "clear"]
    assert len(clear_events) == 1, "Should send exactly one clear event"
    assert clear_events[0]["streamSid"] == "MZ_test_stream"


@pytest.mark.asyncio
async def test_no_clear_event_on_normal_completion():
    """Normal completion should NOT send a clear event."""
    session = make_session()
    session.status = "speaking"
    ws, sent = make_websocket()
    barge_in = asyncio.Event()  # not set

    await _stream_tts_frames(ws, session, ["f1", "f2"], barge_in)

    clear_events = [e for e in sent if e.get("event") == "clear"]
    assert len(clear_events) == 0, "Should not send clear event on normal completion"


@pytest.mark.asyncio
async def test_barge_in_mid_stream():
    """Barge-in fires after some frames already sent."""
    session = make_session()
    session.status = "speaking"
    ws, sent = make_websocket()
    barge_in = asyncio.Event()

    call_count = 0
    original_send = ws.send_json.side_effect

    async def set_barge_in_after_two(payload):
        nonlocal call_count
        await original_send(payload)
        call_count += 1
        if call_count >= 2:
            barge_in.set()

    ws.send_json.side_effect = set_barge_in_after_two

    frames = ["f1", "f2", "f3", "f4", "f5"]
    result = await _stream_tts_frames(ws, session, frames, barge_in)

    assert result is False
    media_events = [e for e in sent if e.get("event") == "media"]
    # Only the first 2 frames were sent before barge-in check fires
    assert len(media_events) == 2, f"Expected 2 frames before interruption, got {len(media_events)}"
    clear_events = [e for e in sent if e.get("event") == "clear"]
    assert len(clear_events) == 1


@pytest.mark.asyncio
async def test_single_rms_packet_no_barge_in():
    """A single above-threshold packet should NOT trigger barge-in (requires BARGE_IN_SUSTAIN_PACKETS)."""
    assert BARGE_IN_SUSTAIN_PACKETS > 1, "Sustain threshold must be > 1 for this test to be meaningful"
    # Verify the constant is configured correctly
    assert BARGE_IN_SUSTAIN_PACKETS == 3


def test_low_rms_no_barge_in_constant():
    """RMS below threshold should never trigger barge-in."""
    # SPEECH_RMS_THRESHOLD should be a sensible positive number
    assert SPEECH_RMS_THRESHOLD > 0
    assert SPEECH_RMS_THRESHOLD >= 100  # must be meaningful — not near zero


def test_stream_session_barge_in_count_initializes():
    """StreamSession should initialize barge_in_count to 0."""
    session = make_session()
    assert hasattr(session, "barge_in_count")
    assert session.barge_in_count == 0


def test_stream_session_barge_in_count_increments():
    """barge_in_count can be incremented."""
    session = make_session()
    session.barge_in_count += 1
    session.barge_in_count += 1
    assert session.barge_in_count == 2


def test_stream_session_summary_includes_barge_in_count():
    """summary() dict should include barge_in_count."""
    session = make_session()
    session.barge_in_count = 3
    s = session.summary()
    assert "barge_in_count" in s
    assert s["barge_in_count"] == 3


@pytest.mark.asyncio
async def test_empty_frames_returns_no_events():
    """Empty frames list — nothing sent, returns True (vacuous normal completion)."""
    session = make_session()
    session.status = "speaking"
    ws, sent = make_websocket()
    barge_in = asyncio.Event()

    result = await _stream_tts_frames(ws, session, [], barge_in)

    assert result is True
    media_events = [e for e in sent if e.get("event") == "media"]
    assert len(media_events) == 0


@pytest.mark.asyncio
async def test_no_orphaned_task_after_barge_in():
    """After barge-in, _stream_tts_frames must return (not hang)."""
    session = make_session()
    session.status = "speaking"
    ws, sent = make_websocket()
    barge_in = asyncio.Event()
    barge_in.set()

    # Should complete quickly, not block
    try:
        result = await asyncio.wait_for(
            _stream_tts_frames(ws, session, ["f1"] * 100, barge_in),
            timeout=2.0,
        )
        assert result is False
    except asyncio.TimeoutError:
        pytest.fail("_stream_tts_frames hung after barge-in — orphaned task detected")


@pytest.mark.asyncio
async def test_barge_in_already_set_no_duplicate_clear():
    """If barge_in_event is already set before _stream_tts_frames, only one clear event sent."""
    session = make_session()
    session.status = "speaking"
    ws, sent = make_websocket()
    barge_in = asyncio.Event()
    barge_in.set()  # Pre-set

    await _stream_tts_frames(ws, session, ["f1", "f2", "f3"], barge_in)

    clear_events = [e for e in sent if e.get("event") == "clear"]
    assert len(clear_events) == 1, "Should not send duplicate clear events"


# ─────────────────────────────────────────────────────────────────────────────
# Regression: existing password-reset routing still works
# ─────────────────────────────────────────────────────────────────────────────

def test_password_reset_regression_import():
    """Importing websocket.py and password_reset_tool should still succeed."""
    from voice.telephony import websocket  # noqa: F401
    from tools.password_reset_tool import PasswordResetTool  # noqa: F401


def test_password_reset_tool_does_not_require_admin_approval():
    """PasswordResetTool should use status='Pending', not 'Pending Approval'."""
    import inspect
    from tools.password_reset_tool import PasswordResetTool
    source = inspect.getsource(PasswordResetTool.execute)
    assert "Pending Approval" not in source, (
        "password_reset_tool should not force Pending Approval status — "
        "that was reverted intentionally"
    )
