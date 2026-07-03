"""
tool_response.py — Standardized tool response contract.

Every tool MUST return a ToolResponse.
The agent validates every response before accepting a COMPLETED transition.

A tool may only return completed=True if a real backend action was committed:
  - Ticket row inserted
  - PasswordReset row inserted
  - Incident row inserted

Collecting information, troubleshooting steps, and follow-up questions
must always return completed=False.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ActionCard:
    """Optional structured action card rendered in the frontend."""
    label:  str
    detail: str
    status: str   # "success" | "pending" | "critical"


@dataclass
class ToolResponse:
    """
    Standardized response every tool must return.

    Fields:
        reply          — What to display to the user. Never empty.
        completed      — True ONLY when a real backend record was created.
        action_card    — Optional structured card (ticket/incident/reset).
        workflow_state — Hint to agent: "collecting" | "completed" | "cancelled".
        updated_memory — Updated WorkflowMemory (caller saves it to DB).
    """
    reply:          str
    completed:      bool                = False
    action_card:    Optional[ActionCard] = None
    workflow_state: str                 = "collecting"   # "collecting" | "completed" | "cancelled"
    updated_memory: Optional[dict]      = None


def tool_waiting(reply: str, memory=None) -> dict:
    """Shorthand for a still-in-progress response."""
    assert reply and reply.strip(), "tool_waiting: reply must not be empty"
    return {
        "status":           "waiting",
        "response":         reply,
        "completed":        False,
        "workflow_state":   "collecting",
        "updated_memory":   memory.to_dict() if memory else None,
    }


def tool_completed(reply: str, action_card: Optional[dict] = None, memory=None) -> dict:
    """
    Shorthand for a successfully completed action.
    Caller is responsible for ensuring a real DB record exists before calling this.
    """
    assert reply and reply.strip(), "tool_completed: reply must not be empty"
    return {
        "status":           "completed",
        "response":         reply,
        "completed":        True,
        "action_card":      action_card,
        "workflow_state":   "completed",
        "updated_memory":   memory.to_dict() if memory else None,
    }


def tool_cancelled(reply: str) -> dict:
    """Shorthand for a cancelled workflow."""
    assert reply and reply.strip(), "tool_cancelled: reply must not be empty"
    return {
        "status":           "cancelled",
        "response":         reply,
        "completed":        False,
        "workflow_state":   "cancelled",
        "updated_memory":   None,
    }
