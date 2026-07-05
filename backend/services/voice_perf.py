"""
voice_perf.py — Voice pipeline performance instrumentation.

Collects per-stage timing for every voice interaction and emits a
structured report at the end.

Usage (in ws_audio.py):
    from services.voice_perf import VoicePerf

    perf = VoicePerf()
    perf.mark("ws_connected")
    ...
    perf.mark("whisper_start")
    perf.mark("whisper_end")
    ...
    perf.report(conv_id=42, whisper_model="base", device="cpu",
                compute_type="int8", audio_bytes=261829,
                num_chunks=55, mime_type="audio/webm;codecs=opus",
                audio_duration_s=16.2, workflow_state="IDLE",
                selected_tool=None, http_fallback=False)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("cyberdesk.voice_perf")

# ── Stage ordering (defines canonical report order) ─────────────────────────
STAGES = [
    # ── Backend stages (marked in ws_audio.py / whisper_service / agent) ──
    "ws_connected",           # WebSocket accepted by Uvicorn
    "auth_ok",                # JWT validated, user resolved
    "first_chunk",            # First binary audio chunk received
    "last_chunk",             # Last chunk received just before stop frame
    "stop_received",          # Stop JSON frame received
    "whisper_start",          # transcribe_audio() called
    "whisper_end",            # transcribe_audio() returned transcript
    "planner_start",          # Planner.decide() called
    "planner_end",            # Planner.decide() returned
    "llm_start",              # chat_with_ai() called (if applicable)
    "llm_end",                # chat_with_ai() returned
    "tool_start",             # ToolExecutor.execute() called (if applicable)
    "tool_end",               # ToolExecutor.execute() returned
    "response_sent",          # WebSocket send_json(response) completed
]

# Pairs of (start_stage, end_stage, label) for the summary table
SEGMENTS = [
    ("ws_connected",  "auth_ok",         "WS Auth"),
    ("auth_ok",       "first_chunk",     "Wait 1st Chunk"),
    ("first_chunk",   "stop_received",   "Recording / Upload"),
    ("stop_received", "whisper_start",   "Pre-Whisper setup"),
    ("whisper_start", "whisper_end",     "Whisper"),
    ("whisper_end",   "planner_start",   "Pre-Planner"),
    ("planner_start", "planner_end",     "Planner"),
    ("planner_end",   "llm_start",       "Pre-LLM"),
    ("llm_start",     "llm_end",         "LLM"),
    ("llm_end",       "tool_start",      "Pre-Tool"),
    ("tool_start",    "tool_end",        "Tool"),
    ("tool_end",      "response_sent",   "Post-Tool"),
    ("planner_end",   "response_sent",   "Planner→Response (no tool)"),
    ("llm_end",       "response_sent",   "LLM→Response (no tool)"),
    ("whisper_end",   "response_sent",   "Agent total"),
    ("ws_connected",  "response_sent",   "TOTAL (backend)"),
]


@dataclass
class VoicePerf:
    """Accumulates per-stage wall-clock timestamps for one voice turn."""

    _marks: dict[str, float] = field(default_factory=dict)

    def mark(self, stage: str) -> None:
        """Record the current monotonic time for a named stage."""
        if stage not in self._marks:
            self._marks[stage] = time.monotonic()
            logger.debug("[PERF] mark %-25s @ t=+%.3fs",
                         stage,
                         self._marks[stage] - self._marks.get("ws_connected", self._marks[stage]))

    def elapsed_ms(self, start: str, end: str) -> Optional[float]:
        """Return elapsed milliseconds between two marks, or None if either is missing."""
        t0 = self._marks.get(start)
        t1 = self._marks.get(end)
        if t0 is None or t1 is None:
            return None
        return (t1 - t0) * 1000.0

    def report(
        self,
        *,
        conv_id: Optional[int],
        whisper_model: str,
        device: str,
        compute_type: str,
        audio_bytes: int,
        num_chunks: int,
        mime_type: str,
        audio_duration_s: float,
        workflow_state: str,
        selected_tool: Optional[str],
        http_fallback: bool,
    ) -> None:
        """Emit a human-readable VOICE PERFORMANCE REPORT to the log."""

        total_ms = self.elapsed_ms("ws_connected", "response_sent")
        if total_ms is None:
            logger.warning("[PERF] Cannot produce report — missing marks: %s",
                           sorted(self._marks.keys()))
            return

        lines = []
        lines.append("")
        lines.append("=" * 55)
        lines.append("  VOICE PERFORMANCE REPORT")
        lines.append("=" * 55)

        # ── Metadata ──────────────────────────────────────────────────────
        lines.append(f"  Conversation   : {conv_id}")
        lines.append(f"  Workflow state : {workflow_state}")
        lines.append(f"  Selected tool  : {selected_tool or '(none)'}")
        lines.append(f"  HTTP fallback  : {'YES' if http_fallback else 'No'}")
        lines.append(f"  Audio          : {audio_bytes:,} bytes  |  {num_chunks} chunks  |  {audio_duration_s:.1f}s  |  {mime_type}")
        lines.append(f"  Whisper        : model={whisper_model}  device={device}  compute={compute_type}")
        lines.append("-" * 55)

        # ── Segment timing ────────────────────────────────────────────────
        lines.append(f"  {'Stage':<30} {'ms':>8}  {'cum ms':>8}  {'%':>5}")
        lines.append(f"  {'-'*30} {'-'*8}  {'-'*8}  {'-'*5}")

        # Choose the right "simple" SEGMENTS to display
        # (skip tool/llm rows if those marks are absent)
        has_llm  = "llm_start"  in self._marks and "llm_end"  in self._marks
        has_tool = "tool_start" in self._marks and "tool_end" in self._marks

        display_segments = [
            ("ws_connected",  "auth_ok",         "WS Auth"),
            ("auth_ok",       "first_chunk",     "Wait for 1st chunk"),
            ("first_chunk",   "stop_received",   "Recording"),
            ("stop_received", "whisper_start",   "Pre-Whisper"),
            ("whisper_start", "whisper_end",     "Whisper transcription"),
            ("whisper_end",   "planner_start",   "Pre-Planner"),
            ("planner_start", "planner_end",     "Planner"),
        ]
        if has_llm:
            display_segments += [
                ("planner_end",  "llm_start",    "Pre-LLM"),
                ("llm_start",    "llm_end",      "LLM"),
            ]
        if has_tool:
            display_segments += [
                ("llm_end",      "tool_start",   "Pre-Tool"),
                ("tool_start",   "tool_end",     "Tool execution"),
                ("tool_end",     "response_sent", "Post-Tool → send"),
            ]
        elif has_llm:
            display_segments.append(("llm_end", "response_sent", "LLM → send"))
        else:
            display_segments.append(("planner_end", "response_sent", "Planner → send"))

        display_segments.append(("ws_connected", "response_sent", "▶ TOTAL (backend)"))

        cumulative_ms = 0.0
        slowest_label = ""
        slowest_ms    = 0.0

        for (s, e, label) in display_segments:
            ms = self.elapsed_ms(s, e)
            if ms is None:
                continue
            pct = (ms / total_ms * 100.0) if total_ms else 0.0
            if label != "▶ TOTAL (backend)":
                cumulative_ms += ms
                if ms > slowest_ms:
                    slowest_ms    = ms
                    slowest_label = label
            marker = "◀ SLOWEST" if (label != "▶ TOTAL (backend)" and ms == slowest_ms) else ""
            lines.append(f"  {label:<30} {ms:>8.1f}  {cumulative_ms:>8.1f}  {pct:>4.1f}%  {marker}")

        lines.append("-" * 55)
        lines.append(f"  Slowest stage  : {slowest_label} ({slowest_ms:.0f} ms, {slowest_ms/total_ms*100:.0f}%)")
        lines.append("=" * 55)
        lines.append("")

        logger.info("\n".join(lines))
