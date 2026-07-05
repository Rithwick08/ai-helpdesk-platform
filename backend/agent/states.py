"""
states.py — Conversation workflow states & phrase detection.

Transport-independent: works identically whether messages come from
typed text, Whisper transcription, or WebRTC audio streams.
"""
import re


class ConversationState:
    IDLE                    = "IDLE"
    COLLECTING_INFORMATION  = "COLLECTING_INFORMATION"
    READY_TO_EXECUTE        = "READY_TO_EXECUTE"
    AWAITING_CONFIRMATION   = "AWAITING_CONFIRMATION"
    EXECUTING               = "EXECUTING"
    COMPLETED               = "COMPLETED"
    CANCELLED               = "CANCELLED"
    RESOLVED_WITHOUT_ACTION = "RESOLVED_WITHOUT_ACTION"


# ── Phrase lists ──────────────────────────────────────────────────────────────

RESOLVED_PHRASES = [
    r"it.?s working",
    r"its working",
    r"it is working",
    r"it.?s fixed",
    r"its fixed",
    r"it is fixed",
    r"problem.?s? (is |has been |)?solved",
    r"never mind[,.]? it.?s okay",
    r"no issues? now",
    r"don.?t create (a )?ticket",
    r"do not create",
    r"everything.?s? (is )?okay",
    r"all good",
    r"sorted (it|out)",
    r"worked itself out",
    r"fixed itself",
    r"issue (is )?resolved",
    r"problem (is )?resolved",
    r"^resolved$",
]

GLOBAL_CANCEL_PHRASES = [
    r"^cancel[.!?]*$",
    r"^stop[.!?]*$",
    r"^abort[.!?]*$",
    r"never mind[.!?]*$",
    r"^nevermind[.!?]*$",
    r"forget it",
    r"don.?t (do|continue|proceed)",
    r"do not (do|continue|proceed)",
    r"skip (it|this)",
    r"ignore (it|this)",
    r"no,? cancel",
]

SOFT_CANCEL_PHRASES = [
    r"^no[.!?]*$",
    r"^no thanks[.!?]*$",
]

# Explicit confirmation words/phrases — checked only when AWAITING_CONFIRMATION
CONFIRM_PHRASES = [
    r"^yes[.!?]*$",           # "yes", "yes.", "yes!"
    r"^yes please[.!?]*$",
    r"^yeah[.!?]*$",
    r"^yep[.!?]*$",
    r"^yup[.!?]*$",
    r"^sure[.!?]*$",
    r"^ok(ay)?[.!?]*$",
    r"^ok(ay)?[,.]? (go ahead|please|sure|do it|proceed)[.!?]*$",
    r"go ahead",
    r"^proceed[.!?]*$",
    r"^confirm(ed)?[.!?]*$",
    r"create it",
    r"^do it[.!?]*$",
    r"create the ticket",
    r"create the incident",
    r"create the request",
    r"reset it",
    r"^submit[.!?]*$",
    r"^approve(d)?[.!?]*$",
    r"^absolutely[.!?]*$",
    r"^affirmative[.!?]*$",
    r"^please[.!?]*$",
    r"^sounds good[.!?]*$",
    r"^that.?s (correct|fine|good)[.!?]*$",
]


def _match_any(text: str, patterns: list) -> bool:
    lowered = text.lower().strip()
    return any(re.search(p, lowered) for p in patterns)


def is_resolved_without_action(text: str) -> bool:
    return _match_any(text, RESOLVED_PHRASES)


def is_global_cancellation(text: str) -> bool:
    return _match_any(text, GLOBAL_CANCEL_PHRASES)


def is_soft_cancellation(text: str) -> bool:
    return _match_any(text, SOFT_CANCEL_PHRASES)


def is_cancellation(text: str) -> bool:
    return is_global_cancellation(text) or is_soft_cancellation(text)


def is_confirmation(text: str) -> bool:
    return _match_any(text, CONFIRM_PHRASES)
