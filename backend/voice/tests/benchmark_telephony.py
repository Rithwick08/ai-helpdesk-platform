"""
benchmark_telephony.py — Local Twilio Media Stream benchmark harness.

Simulates the full Twilio WebSocket protocol against a *running* FastAPI server
at ws://localhost:8000/telephony/media. No real phone call or Twilio PSTN
connection is needed.

Flow per iteration
------------------
  debug_twilio.wav (16 kHz PCM WAV)
      │  wav_to_twilio_mulaw()          ← existing audio_codec function
      ▼
  8 kHz μ-law bytes
      │  mulaw_to_b64_frames()          ← existing audio_codec function
      ▼
  160-byte / 20 ms base64 frames
      │  WebSocket (real network stack)
      ▼
  /telephony/media endpoint
      ├── VAD (RMS inline, threshold 250, silence_timeout 1.2 s)
      ├── process_stream_utterance()
      │       ├── mulaw_to_wav()
      │       └── process_voice_request()
      │               ├── Deepgram STT   → stt_ms
      │               ├── CyberDesk AI   → ai_ms
      │               └── Sarvam TTS     → tts_ms
      └── mulaw frames streamed back to client

Latency capture strategy
------------------------
  • Per-stage latencies (stt_ms, ai_ms, tts_ms, total pipeline) are already
    logged by voice_pipeline.py with structured key=value patterns.
    The harness tails backend_server.log between each run and parses them
    with regex — no production schema changes required.
  • utterance_end → first_audio is measured purely client-side with
    time.monotonic() — the single most important perceived-latency number.

Usage
-----
    # From the backend/ directory (server must be running):
    python voice/tests/benchmark_telephony.py
    python voice/tests/benchmark_telephony.py --runs 3
    python voice/tests/benchmark_telephony.py --audio debug_twilio.wav --url ws://localhost:8000/telephony/media
"""

import argparse
import asyncio
import base64
import json
import logging
import re
import sys
import time
import uuid
from pathlib import Path
from statistics import mean, median
from typing import Dict, List, Optional, Tuple

# ── Bootstrap: make backend/ importable when run as a script ─────────────────
_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=True)

# Reuse the EXACT same codec functions used by the production telephony stack
from voice.telephony.audio_codec import mulaw_to_b64_frames, wav_to_twilio_mulaw  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("cyberdesk.voice.benchmark")

# ── Defaults ──────────────────────────────────────────────────────────────────
DEFAULT_WS_URL = "ws://localhost:8000/telephony/media"
DEFAULT_HTTP_URL = "http://localhost:8000/"

# Audio selection strategy
# ────────────────────────
# debug_twilio.wav was captured as μ-law→WAV (one round-trip already done).
# Re-encoding it back to 8 kHz μ-law causes double companding loss: only
# 8/739 frames exceed the VAD RMS threshold of 250 — making VAD useless.
#
# sarvam_output.wav is a Sarvam TTS output (native WAV, never μ-law encoded).
# It has 79% of frames above the VAD threshold and contains real speech that
# Deepgram can transcribe.  Use it as the default benchmark audio.
#
# To test with debug_twilio.wav anyway: --audio path/to/debug_twilio.wav
_SARVAM_WAV   = _BACKEND_DIR / "voice" / "tests" / "sarvam_output.wav"
DEFAULT_AUDIO = _SARVAM_WAV if _SARVAM_WAV.exists() else _BACKEND_DIR / "debug_twilio.wav"
SERVER_LOG = _BACKEND_DIR / "backend_server.log"

# VAD timing — must match voice/telephony/websocket.py
SILENCE_TIMEOUT_SECONDS = 1.2
# Number of 20 ms silence frames to send after speech to trigger VAD flush.
# 80 frames × 20 ms = 1.6 s > 1.2 s threshold; leaves a comfortable margin.
SILENCE_FRAMES = 80
# Speech frames must be sent at real-time to properly benchmark Deepgram streaming
SPEECH_FRAME_SLEEP_S = 0.020   # 20 ms (real-time)
# Silence frames MUST be sent at real-time pace so wall-clock VAD timer fires.
SILENCE_FRAME_SLEEP_S = 0.020  # 20 ms (real-time)
# Max wait for server to send response audio after utterance
MAX_WAIT_RESPONSE_S = 25.0
# Extra wait after stop event to collect trailing frames
POST_STOP_WAIT_S = 2.5


# ═════════════════════════════════════════════════════════════════════════════
# Audio preparation
# ═════════════════════════════════════════════════════════════════════════════

def prepare_mulaw_frames(wav_path: Path) -> Tuple[List[str], int, float]:
    """
    Convert a WAV file to 8 kHz μ-law and split into 160-byte base64 frames
    using the SAME codec functions the production telephony stack uses.

    Returns
    -------
    (frames_b64, mulaw_byte_count, audio_duration_seconds)
    """
    if not wav_path.exists():
        raise FileNotFoundError(f"Audio file not found: {wav_path}")

    audio_bytes = wav_path.read_bytes()

    # wav_to_twilio_mulaw handles any sample rate / bit-depth → 8 kHz μ-law
    mulaw_bytes = wav_to_twilio_mulaw(audio_bytes, target_rate=8000)
    frames_b64 = mulaw_to_b64_frames(mulaw_bytes, frame_size=160)
    duration_s = len(mulaw_bytes) / 8000.0

    logger.info(
        "[HARNESS] Audio prepared | src=%s | mulaw_bytes=%d | frames=%d | duration=%.2fs",
        wav_path.name, len(mulaw_bytes), len(frames_b64), duration_s,
    )
    return frames_b64, len(mulaw_bytes), duration_s


def make_silence_b64() -> str:
    """Return one 20 ms μ-law silence frame (160 × 0xFF, base64-encoded)."""
    # 0xFF is the μ-law encoding for silence
    return base64.b64encode(bytes([0xFF] * 160)).decode()


# ═════════════════════════════════════════════════════════════════════════════
# Log-file parsing (no production code changes required)
# ═════════════════════════════════════════════════════════════════════════════

# voice_pipeline.py already emits structured latency lines:
#   [PIPELINE] STT OK | chars=NN | latency=NN ms | transcript='...'
#   [PIPELINE] AI OK  | conv=NN | status=chat | latency=NNms | response='...'
#   [PIPELINE] TTS OK | bytes=NN | mime=audio/wav | latency=NNms
#   [PIPELINE] COMPLETE | session=XXXX | turn=1 | total_latency=NNms
#   [MEDIA_STREAM] Pipeline success | call_sid=... | ... pipeline_ms=NNms | total_ms=NNms
#   [TELEPHONY/VAD] 🗣️ Speech STARTED detected | RMS=NN
#   [TELEPHONY/VAD] ⏱️ Post-speech silence threshold reached ...

_RE_STT      = re.compile(r'\[PIPELINE\] STT (?:OK|Skipped \(Using Streaming\)) \| chars=\d+ \| latency=(\d+)ms')
_RE_AI       = re.compile(r'\[PIPELINE\] AI OK \| conv=\S+ \| status=\S+ \| latency=(\d+)ms')
_RE_TTS      = re.compile(r'\[PIPELINE\] TTS OK \| bytes=\d+ \| mime=\S+ \| latency=(\d+)ms')
_RE_COMPLETE = re.compile(r'\[PIPELINE\] COMPLETE \| session=\S+ \| turn=\d+ \| total_latency=(\d+)ms')
_RE_MEDIA    = re.compile(
    r'\[MEDIA_STREAM\] Pipeline success \| [^\n]+ pipeline_ms=(\d+)ms \| total_ms=(\d+)ms'
)
_RE_VAD_START = re.compile(r'Speech STARTED detected')
_RE_VAD_FLUSH = re.compile(r'Post-speech silence threshold reached')
_RE_TRANSCRIPT = re.compile(r"transcript='([^']*)'")


def parse_log_metrics(log_slice: str) -> Dict:
    """
    Extract per-stage latencies from a slice of server log text.
    All values are ints (milliseconds) or None if not found.
    """
    m = _RE_STT.search(log_slice)
    stt_ms = int(m.group(1)) if m else None

    m = _RE_AI.search(log_slice)
    ai_ms = int(m.group(1)) if m else None

    m = _RE_TTS.search(log_slice)
    tts_ms = int(m.group(1)) if m else None

    m = _RE_COMPLETE.search(log_slice)
    pipeline_total_ms = int(m.group(1)) if m else None

    m = _RE_MEDIA.search(log_slice)
    if m:
        process_voice_ms = int(m.group(1))   # time inside process_voice_request()
        media_total_ms   = int(m.group(2))   # includes mulaw_to_wav() preamble
        # codec_ms = mulaw→WAV conversion (difference between media total and voice pipeline)
        codec_ms = media_total_ms - process_voice_ms
    else:
        process_voice_ms = None
        media_total_ms   = None
        codec_ms         = None

    m = _RE_TRANSCRIPT.search(log_slice)
    transcript_preview = m.group(1)[:80] if m else None

    return {
        "stt_ms":            stt_ms,
        "ai_ms":             ai_ms,
        "tts_ms":            tts_ms,
        "pipeline_total_ms": pipeline_total_ms,
        "codec_ms":          codec_ms,
        "media_total_ms":    media_total_ms,
        "transcript":        transcript_preview,
        "vad_speech_detected": bool(_RE_VAD_START.search(log_slice)),
        "vad_flush_triggered": bool(_RE_VAD_FLUSH.search(log_slice)),
    }


def _log_slice_since(position: int) -> str:
    """Read new log content written after *position* bytes."""
    if not SERVER_LOG.exists():
        logger.warning("[HARNESS] Log file not found: %s — per-stage latencies will be N/A", SERVER_LOG)
        return ""
    try:
        with open(SERVER_LOG, "r", errors="replace") as fh:
            fh.seek(position)
            return fh.read()
    except Exception as exc:
        logger.warning("[HARNESS] Could not read log: %s", exc)
        return ""


# ═════════════════════════════════════════════════════════════════════════════
# Server health check
# ═════════════════════════════════════════════════════════════════════════════

async def check_server(http_url: str) -> bool:
    """Return True if the FastAPI server responds at *http_url*."""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(http_url, timeout=3.0)
            return resp.status_code < 500
    except Exception as exc:
        logger.debug("[HARNESS] Server health check failed: %s", exc)
        return False


# ═════════════════════════════════════════════════════════════════════════════
# Single benchmark iteration
# ═════════════════════════════════════════════════════════════════════════════

async def run_iteration(
    ws_url: str,
    speech_frames: List[str],
    run_number: int,
) -> Dict:
    """
    Execute one complete Twilio Media Stream simulation.

    Sends: connected → start → speech media events → silence media events → stop.
    Concurrently receives: response media frames + mark events.

    Returns a dict with all client-side timing and log-parsed per-stage metrics.
    """
    call_sid   = f"CA_bench_{run_number:02d}_{uuid.uuid4().hex[:8]}"
    stream_sid = f"MZ_bench_{run_number:02d}_{uuid.uuid4().hex[:8]}"
    silence_b64 = make_silence_b64()

    result: Dict = {
        "run":                       run_number,
        "call_sid":                  call_sid,
        "success":                   False,
        "error":                     None,
        # VAD verification
        "vad_speech_detected":       False,
        "vad_flush_triggered":       False,
        # Content verification
        "transcript":                None,
        "ai_ms":                     None,
        # Client-side timing
        "t_utterance_end":           None,
        "t_first_response":          None,
        "t_stop_sent":               None,
        "utterance_to_first_audio_ms": None,
        # Frame counts
        "speech_frames_sent":        len(speech_frames),
        "silence_frames_sent":       0,
        "response_frames_received":  0,
        # Per-stage latency (from server logs)
        "stt_ms":                    None,
        "tts_ms":                    None,
        "codec_ms":                  None,
        "pipeline_total_ms":         None,
    }

    try:
        import websockets  # websockets >= 14 / 16

        # Snapshot log file position before this run starts
        log_position = SERVER_LOG.stat().st_size if SERVER_LOG.exists() else 0

        logger.info(
            "[HARNESS] ── Run %d START | call_sid=%s ──",
            run_number, call_sid[:24],
        )

        # We use the legacy connect() API which is stable across websockets 10-16
        async with websockets.connect(
            ws_url,
            ping_interval=None,   # Twilio does not send WS pings
            ping_timeout=None,
            open_timeout=10,
        ) as ws:

            # Shared state for the receiver coroutine
            response_frames: List[dict] = []
            t_first_response: Optional[float] = None

            # ── Receiver task ─────────────────────────────────────────────────
            async def _receiver():
                nonlocal t_first_response
                while True:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=0.05)
                        msg = json.loads(raw)
                        ev  = msg.get("event")
                        if ev == "media":
                            if t_first_response is None:
                                t_first_response = time.monotonic()
                                logger.info(
                                    "[HARNESS] Run %d: ← First response media frame received",
                                    run_number,
                                )
                            response_frames.append(msg)
                        elif ev == "mark":
                            logger.info(
                                "[HARNESS] Run %d: ← Mark event | name=%s",
                                run_number,
                                msg.get("mark", {}).get("name", ""),
                            )
                    except asyncio.TimeoutError:
                        pass
                    except asyncio.CancelledError:
                        break
                    except Exception:
                        break

            receiver_task = asyncio.create_task(_receiver())

            try:
                seq = 1

                # ── Event 1: connected ────────────────────────────────────────
                await ws.send(json.dumps({
                    "event":    "connected",
                    "protocol": "Call",
                    "version":  "1.0.0",
                }))

                # ── Event 2: start ────────────────────────────────────────────
                await ws.send(json.dumps({
                    "event":          "start",
                    "sequenceNumber": str(seq),
                    "start": {
                        "streamSid":  stream_sid,
                        "callSid":    call_sid,
                        "accountSid": "ACbenchmark000000000000000000000",
                        "mediaFormat": {
                            "encoding":   "audio/x-mulaw",
                            "sampleRate": 8000,
                            "channels":   1,
                        },
                        "tracks": ["inbound"],
                    },
                    "streamSid": stream_sid,
                }))
                seq += 1
                logger.info("[HARNESS] Run %d: connected + start events sent", run_number)

                # ── Event 3: speech media frames (fast pacing) ────────────────
                for frame_b64 in speech_frames:
                    await ws.send(json.dumps({
                        "event":          "media",
                        "sequenceNumber": str(seq),
                        "media": {
                            "track":     "inbound",
                            "chunk":     str(seq - 2),
                            "timestamp": str((seq - 2) * 20),
                            "payload":   frame_b64,
                        },
                        "streamSid": stream_sid,
                    }))
                    seq += 1
                    await asyncio.sleep(SPEECH_FRAME_SLEEP_S)

                t_utterance_end = time.monotonic()
                result["t_utterance_end"] = t_utterance_end
                logger.info(
                    "[HARNESS] Run %d: %d speech frames sent → utterance_end marked",
                    run_number, len(speech_frames),
                )

                # ── Event 4: silence frames (real-time pacing for VAD) ─────────
                # Must send at real 20 ms intervals so the wall-clock VAD timer
                # in websocket.py (silence_dur = now - last_speech_time) fires.
                for i in range(SILENCE_FRAMES):
                    await ws.send(json.dumps({
                        "event":          "media",
                        "sequenceNumber": str(seq),
                        "media": {
                            "track":     "inbound",
                            "chunk":     str(seq - 2),
                            "timestamp": str((seq - 2) * 20),
                            "payload":   silence_b64,
                        },
                        "streamSid": stream_sid,
                    }))
                    seq += 1
                    await asyncio.sleep(SILENCE_FRAME_SLEEP_S)

                result["silence_frames_sent"] = SILENCE_FRAMES
                logger.info(
                    "[HARNESS] Run %d: %d silence frames sent (%.1fs) — VAD flush expected",
                    run_number, SILENCE_FRAMES, SILENCE_FRAMES * SILENCE_FRAME_SLEEP_S,
                )

                # ── Wait for server to begin streaming response ────────────────
                wait_start = time.monotonic()
                while (time.monotonic() - wait_start) < MAX_WAIT_RESPONSE_S:
                    if t_first_response is not None:
                        break
                    await asyncio.sleep(0.1)

                if t_first_response is None:
                    logger.warning(
                        "[HARNESS] Run %d: No response received after %.1fs",
                        run_number, MAX_WAIT_RESPONSE_S,
                    )

                # ── Event 5: stop ─────────────────────────────────────────────
                await ws.send(json.dumps({
                    "event":          "stop",
                    "sequenceNumber": str(seq),
                    "stop": {
                        "accountSid": "ACbenchmark000000000000000000000",
                        "callSid":    call_sid,
                    },
                    "streamSid": stream_sid,
                }))
                t_stop_sent = time.monotonic()
                result["t_stop_sent"] = t_stop_sent
                logger.info("[HARNESS] Run %d: stop event sent", run_number)

                # Wait for any trailing frames from the server
                await asyncio.sleep(POST_STOP_WAIT_S)

            finally:
                receiver_task.cancel()
                try:
                    await asyncio.wait_for(receiver_task, timeout=1.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    pass

        # ── Compute client-side metrics ───────────────────────────────────────
        result["t_first_response"]         = t_first_response
        result["response_frames_received"] = len(response_frames)

        if t_first_response is not None and result["t_utterance_end"] is not None:
            delta_ms = int((t_first_response - result["t_utterance_end"]) * 1000)
            result["utterance_to_first_audio_ms"] = delta_ms

        # ── Parse server log for per-stage latencies ──────────────────────────
        log_slice = _log_slice_since(log_position)
        if log_slice:
            metrics = parse_log_metrics(log_slice)
            result.update(metrics)
        else:
            logger.warning(
                "[HARNESS] Run %d: No new log content found — "
                "ensure server logs to %s",
                run_number, SERVER_LOG,
            )

        # ── Verification summary ──────────────────────────────────────────────
        result["success"] = (
            result.get("vad_speech_detected", False)
            and result.get("vad_flush_triggered", False)
            and bool(result.get("transcript"))
            and result.get("ai_ms") is not None
            and result.get("tts_ms") is not None
            and result["response_frames_received"] > 0
            and (
                t_first_response is None
                or t_first_response < result["t_stop_sent"]
            )
        )

        logger.info(
            "[HARNESS] Run %d %s | frames_rx=%d | utt→audio=%sms | "
            "stt=%s ai=%s tts=%s codec=%s total=%s",
            run_number,
            "✓ PASS" if result["success"] else "✗ FAIL",
            result["response_frames_received"],
            result.get("utterance_to_first_audio_ms", "N/A"),
            result.get("stt_ms", "N/A"),
            result.get("ai_ms", "N/A"),
            result.get("tts_ms", "N/A"),
            result.get("codec_ms", "N/A"),
            result.get("pipeline_total_ms", "N/A"),
        )

    except Exception as exc:
        result["error"] = str(exc)
        logger.error("[HARNESS] Run %d EXCEPTION: %s", run_number, exc, exc_info=True)

    return result


# ═════════════════════════════════════════════════════════════════════════════
# Statistics helpers
# ═════════════════════════════════════════════════════════════════════════════

def _stats(values: List[float]) -> Dict:
    """Return mean / min / max / median / p95 for a list of values."""
    if not values:
        return {"mean": None, "min": None, "max": None, "median": None, "p95": None}
    sv  = sorted(values)
    n   = len(sv)
    p95 = sv[max(0, int(0.95 * n) - 1)] if n >= 2 else sv[0]
    return {
        "mean":   round(mean(sv), 1),
        "min":    sv[0],
        "max":    sv[-1],
        "median": round(median(sv), 1),
        "p95":    p95,
    }


# ═════════════════════════════════════════════════════════════════════════════
# Display
# ═════════════════════════════════════════════════════════════════════════════

def _cell(v, width: int = 8) -> str:
    s = str(v) if v is not None else "N/A"
    return f" {s:<{width}} "


def print_results(runs: List[Dict]) -> None:
    """Print a full latency table + attribution + verification results."""

    cols   = ["Run",    "STT ms", "AI ms",  "TTS ms", "Codec ms", "Pipeline", "Utt→Audio"]
    widths = [6,        8,        8,        8,        9,          10,         11]

    def _row(*cells):
        return "|" + "|".join(_cell(c, w) for c, w in zip(cells, widths)) + "|"

    sep = "+" + "+".join("-" * (w + 2) for w in widths) + "+"

    print()
    print("=" * 73)
    print("  TELEPHONY VOICE PIPELINE — BENCHMARK RESULTS")
    print("=" * 73)
    print(sep)
    print(_row(*cols))
    print(sep)

    # Collect columns for stats
    field_cols = ["stt_ms", "ai_ms", "tts_ms", "codec_ms", "pipeline_total_ms",
                  "utterance_to_first_audio_ms"]
    buckets: Dict[str, List[float]] = {f: [] for f in field_cols}

    for r in runs:
        tag = f"#{r['run']}{'✓' if r.get('success') else '✗'}"
        vals = [r.get(f) for f in field_cols]
        print(_row(tag, *vals))
        for f, v in zip(field_cols, vals):
            if v is not None:
                buckets[f].append(float(v))

    print(sep)

    for stat_label, fn in [
        ("Avg", lambda v: round(mean(v)) if v else None),
        ("Min", lambda v: int(min(v)) if v else None),
        ("Max", lambda v: int(max(v)) if v else None),
        ("Med", lambda v: round(median(v)) if v else None),
    ]:
        agg = [fn(buckets[f]) for f in field_cols]
        print(_row(stat_label, *agg))

    print(sep)
    print()

    # ── Latency attribution ───────────────────────────────────────────────────
    stt_v  = buckets["stt_ms"]
    ai_v   = buckets["ai_ms"]
    tts_v  = buckets["tts_ms"]
    utt_v  = buckets["utterance_to_first_audio_ms"]
    pipe_v = buckets["pipeline_total_ms"]

    if stt_v and ai_v and tts_v:
        avg_stt  = mean(stt_v)
        avg_ai   = mean(ai_v)
        avg_tts  = mean(tts_v)
        avg_pipe = mean(pipe_v) if pipe_v else (avg_stt + avg_ai + avg_tts)
        api_total = avg_stt + avg_ai + avg_tts

        print("  LATENCY ATTRIBUTION")
        print("  " + "─" * 55)
        print(f"  Deepgram STT  : {avg_stt:>7.0f} ms  ({avg_stt / api_total * 100:5.1f}% of API time)")
        print(f"  CyberDesk AI  : {avg_ai:>7.0f} ms  ({avg_ai  / api_total * 100:5.1f}% of API time)")
        print(f"  Sarvam TTS    : {avg_tts:>7.0f} ms  ({avg_tts / api_total * 100:5.1f}% of API time)")
        print(f"  ─────────────────────────────────────────────────────────")
        print(f"  Pipeline total: {avg_pipe:>7.0f} ms  (STT + AI + TTS, server-side)")
        if utt_v:
            avg_utt = mean(utt_v)
            overhead = avg_utt - avg_pipe
            print(f"  Utt → Audio   : {avg_utt:>7.0f} ms  (perceived latency, client-side)")
            print(f"  WS+VAD+codec  : {overhead:>7.0f} ms  (overhead beyond API time)")

        print()
        # Verdict
        dominant = max(
            [("STT (Deepgram)", avg_stt),
             ("AI  (CyberDesk / Groq)", avg_ai),
             ("TTS (Sarvam)", avg_tts)],
            key=lambda x: x[1],
        )
        print(f"  ★  PRIMARY LATENCY DRIVER: {dominant[0]} ({dominant[1]:.0f} ms avg)")
        print()

    # ── Verification checklist ────────────────────────────────────────────────
    print("  VERIFICATION CHECKLIST")
    print("  " + "─" * 55)
    check_labels = [
        ("VAD detected speech before stop",                    "vad_speech_detected"),
        ("VAD flushed utterance (silence timeout)",            "vad_flush_triggered"),
        ("Deepgram produced non-empty transcript",             "transcript"),
        ("CyberDesk AI produced a response (ai_ms present)",  "ai_ms"),
        ("Sarvam produced response audio (tts_ms present)",   "tts_ms"),
        ("μ-law frames streamed back to client",               "response_frames_received"),
    ]

    for r in runs:
        passed = 0
        total  = len(check_labels) + 1  # +1 for "audio before stop"
        lines  = []
        for label, key in check_labels:
            val = r.get(key)
            ok  = bool(val) if val is not None else False
            mark = "✓" if ok else "✗"
            if ok:
                passed += 1
            lines.append(f"    {mark} {label}")

        # Audio arrived before stop event
        t_first = r.get("t_first_response")
        t_stop  = r.get("t_stop_sent")
        before_stop = (t_first is not None and t_stop is not None and t_first < t_stop)
        mark = "✓" if before_stop else "✗"
        if before_stop:
            passed += 1
        lines.append(f"    {mark} Response audio started before stop event")

        status = "PASS" if passed == total else f"PARTIAL ({passed}/{total})"
        print(f"  Run #{r['run']}: {status}")
        for line in lines:
            print(line)
        if r.get("transcript"):
            print(f"    → Transcript: {r['transcript']!r}")
        if r.get("error"):
            print(f"    ✗ Error: {r['error']}")
        print()


# ═════════════════════════════════════════════════════════════════════════════
# Save results
# ═════════════════════════════════════════════════════════════════════════════

def save_results(runs: List[Dict], output_path: Path) -> None:
    """Serialise results to JSON (convert non-serialisable float timestamps)."""
    import json

    clean = []
    for r in runs:
        row = {}
        for k, v in r.items():
            # Convert raw monotonic timestamps (not meaningful outside the process)
            if k.startswith("t_") and isinstance(v, float):
                row[k] = None
            else:
                row[k] = v
        clean.append(row)

    output_path.write_text(json.dumps({"runs": clean}, indent=2))
    print(f"  Results saved → {output_path}")


# ═════════════════════════════════════════════════════════════════════════════
# Main entry point
# ═════════════════════════════════════════════════════════════════════════════

async def main(args: argparse.Namespace) -> int:
    ws_url    = args.url
    http_base = ws_url.replace("ws://", "http://").replace("wss://", "https://").rsplit("/telephony/media", 1)[0] + "/"
    audio_path = Path(args.audio)
    n_runs     = args.runs
    out_path   = Path(args.output)

    print()
    print("=" * 73)
    print("  TELEPHONY VOICE PIPELINE — LOCAL BENCHMARK HARNESS")
    print("=" * 73)
    print(f"  WS  endpoint : {ws_url}")
    print(f"  Audio file   : {audio_path}")
    print(f"  Runs         : {n_runs}")
    print(f"  Server log   : {SERVER_LOG}")
    print()

    # ── Pre-flight checks ─────────────────────────────────────────────────────
    print("  [PRE-FLIGHT] Checking server …")
    if not await check_server(http_base):
        print(f"\n  ✗ FastAPI server is NOT running at {http_base}")
        print("    Start it with:  cd backend && uvicorn app:app --reload --port 8000")
        return 1
    print(f"  ✓ Server is running at {http_base}")

    print("  [PRE-FLIGHT] Preparing audio …")
    try:
        speech_frames, mulaw_bytes, audio_dur = prepare_mulaw_frames(audio_path)
    except FileNotFoundError as exc:
        print(f"\n  ✗ {exc}")
        return 1

    print(f"  ✓ Audio ready | {len(speech_frames)} speech frames ({audio_dur:.2f}s of audio)")
    print(f"    Silence frames : {SILENCE_FRAMES} × 20 ms = {SILENCE_FRAMES * 20} ms")
    print(f"    VAD threshold  : {SILENCE_TIMEOUT_SECONDS}s silence → flush")
    print()

    # ── Run iterations ────────────────────────────────────────────────────────
    all_runs: List[Dict] = []

    for i in range(1, n_runs + 1):
        print(f"  ── Running iteration {i}/{n_runs} ──────────────────────────────")
        result = await run_iteration(ws_url, speech_frames, run_number=i)
        all_runs.append(result)

        # Brief inter-run cooldown so the server can fully close the previous session
        if i < n_runs:
            await asyncio.sleep(3.0)

    # ── Display & save ────────────────────────────────────────────────────────
    print_results(all_runs)
    save_results(all_runs, out_path)

    passed = sum(1 for r in all_runs if r.get("success"))
    print(f"  ═══  {passed}/{n_runs} iterations PASSED  ═══")
    print()

    return 0 if passed == n_runs else 1


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Local Twilio Media Stream benchmark harness",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--url",    default=DEFAULT_WS_URL,       help="WebSocket URL of the running server")
    p.add_argument("--audio",  default=str(DEFAULT_AUDIO),   help="Path to the WAV file to use as test audio")
    p.add_argument("--runs",   default=5,  type=int,         help="Number of benchmark iterations")
    p.add_argument("--output", default=str(_BACKEND_DIR / "voice" / "tests" / "benchmark_results.json"),
                   help="Path to save JSON results")
    return p.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
