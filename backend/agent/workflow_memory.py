"""
workflow_memory.py — Structured workflow context store.

Every tool defines its required fields.
The agent knows exactly what is known, what is missing, and what has been tried.

Transport-independent: no I/O here, just pure data helpers.

IT Support workflow fields (v3 — reasoning-driven):
    it.phase      — None | "active"
    it.category   — broad category (e.g. "VPN", "Email")
    it.diagnosis  — initial diagnosis summary
    it.priority   — initial priority estimate
    it.facts      — dict of key-value facts extracted by the LLM
    it.attempted  — list of approach summaries already tried

SOC Incident workflow fields (v3 — reasoning-driven):
    soc.phase     — None | "collecting"
    soc.category  — incident category
    soc.severity  — severity estimate
    soc.confidence— classifier confidence score
    soc.evidence  — dict of field_key -> value pairs extracted by the LLM
"""
import json
from typing import Optional


# ── Per-tool required field definitions ───────────────────────────────────────
TOOL_REQUIRED_FIELDS: dict[str, list[str]] = {
    "it_support":         ["problem"],
    "security_incident":  ["problem"],
    "password_reset":     ["account_type"],
    "security_awareness": [],
    "general_question":   [],
}


class WorkflowMemory:
    """
    Wraps the JSON blob stored in conversation.collected_entities.

    General keys (shared):
        problem, account_type, operating_system, device, application,
        error_message, incident_type, urgency, missing_fields, confidence

    IT Support (v3 reasoning-driven):
        it.phase, it.category, it.diagnosis, it.priority, it.facts, it.attempted

    SOC Incident (v3 reasoning-driven):
        soc.phase, soc.category, soc.severity, soc.confidence, soc.evidence

    Password Reset:
        pr.phase  (None | "collecting" | "awaiting_confirmation")

    Ticket Memory:
        ticket_context  (dict containing id, type, category, summary, status, priority)

    All keys accessed via generic .get(key) / .set(key, value).
    Tool-specific properties are convenience wrappers only.
    """

    def __init__(self, raw_json: Optional[str] = None):
        if raw_json:
            try:
                self._data = json.loads(raw_json)
            except Exception:
                self._data = {}
        else:
            self._data = {}

        # ── Ensure all base keys exist ─────────────────────────────────────────
        self._data.setdefault("problem",          None)
        self._data.setdefault("account_type",     None)
        self._data.setdefault("operating_system", None)
        self._data.setdefault("device",           None)
        self._data.setdefault("application",      None)
        self._data.setdefault("error_message",    None)
        self._data.setdefault("incident_type",    None)
        self._data.setdefault("urgency",          None)
        self._data.setdefault("missing_fields",   [])
        self._data.setdefault("confidence",       0)

        # ── IT Support (v3) — reasoning-driven keys ───────────────────────────
        # Legacy step-graph keys kept for backward compatibility during transition
        self._data.setdefault("it_category",     None)
        self._data.setdefault("current_step",    None)
        self._data.setdefault("completed_steps",  [])
        self._data.setdefault("failed_steps",     [])
        # New reasoning-driven keys (dot-namespaced, not touched by old code)
        # it.phase, it.category, it.diagnosis, it.priority, it.facts, it.attempted
        # soc.phase, soc.category, soc.severity, soc.confidence, soc.evidence
        # ticket_context
        # are all set dynamically via .set() — no need for setdefault here



    # ── Generic getters ───────────────────────────────────────────────────────

    @property
    def problem(self) -> Optional[str]:
        return self._data.get("problem")

    @property
    def account_type(self) -> Optional[str]:
        return self._data.get("account_type")

    @property
    def operating_system(self) -> Optional[str]:
        return self._data.get("operating_system")

    @property
    def confidence(self) -> int:
        return self._data.get("confidence", 0)

    def get(self, key: str, default=None):
        return self._data.get(key, default)

    # ── IT Support workflow getters ───────────────────────────────────────────

    @property
    def it_category(self) -> Optional[str]:
        """The issue category resolved by the classifier (e.g. 'outlook')."""
        return self._data.get("it_category")

    @property
    def current_step(self) -> Optional[str]:
        """The step ID currently being presented to the user."""
        return self._data.get("current_step")

    @property
    def completed_steps(self) -> list:
        """All step IDs that have been presented (succeeded or failed)."""
        return self._data.get("completed_steps", [])

    @property
    def failed_steps(self) -> list:
        """Step IDs the user explicitly said did NOT work."""
        return self._data.get("failed_steps", [])

    # ── Generic mutators ──────────────────────────────────────────────────────

    def merge_entities(self, entities: dict):
        """Merge LLM-extracted entities, keeping existing values if new ones are None."""
        for k, v in entities.items():
            if v is not None:
                self._data[k] = v

    def set(self, key: str, value):
        self._data[key] = value

    # ── IT Support workflow mutators ──────────────────────────────────────────

    def set_it_category(self, category: str):
        """Store the resolved issue category."""
        self._data["it_category"] = category.lower().strip()

    def set_current_step(self, step_id: str):
        """Mark which step is currently being worked on."""
        self._data["current_step"] = step_id

    def mark_step_completed(self, step_id: str):
        """
        Record that a step has been presented.
        Does NOT record whether it succeeded or failed — use mark_step_failed for that.
        """
        normalised = step_id.lower().strip()
        existing   = [s.lower().strip() for s in self._data.get("completed_steps", [])]
        if normalised not in existing:
            self._data.setdefault("completed_steps", []).append(step_id)

    def mark_step_failed(self, step_id: str):
        """Record that the user tried this step and it did NOT resolve the issue."""
        normalised = step_id.lower().strip()
        existing   = [s.lower().strip() for s in self._data.get("failed_steps", [])]
        if normalised not in existing:
            self._data.setdefault("failed_steps", []).append(step_id)
        # Also ensure it's in completed_steps
        self.mark_step_completed(step_id)

    def has_completed_step(self, step_id: str) -> bool:
        """Return True if this IT support step has already been presented."""
        normalised = step_id.lower().strip()
        return normalised in [s.lower().strip() for s in self.completed_steps]

    def has_failed_step(self, step_id: str) -> bool:
        """Return True if this IT support step was explicitly tried and failed."""
        normalised = step_id.lower().strip()
        return normalised in [s.lower().strip() for s in self.failed_steps]

    # ── Security Incident workflow getters ────────────────────────────────────



    # ── Analysis ──────────────────────────────────────────────────────────────

    def missing_for_tool(self, tool_name: str) -> list[str]:
        required = TOOL_REQUIRED_FIELDS.get(tool_name, [])
        return [f for f in required if not self._data.get(f)]

    def is_ready_for_tool(self, tool_name: str) -> bool:
        return len(self.missing_for_tool(tool_name)) == 0

    def active_workflow_summary(self, tool_name: str) -> dict:
        """
        Returns the complete active workflow context as a single dict.
        Passed to the reasoning LLM on every turn so it always has full context.
        Covers both IT Support (it.*) and SOC Incident (soc.*) workflows.
        """
        return {
            "tool": tool_name,
            "problem": self.get("problem"),
            "category": self.get("it.category") or self.get("soc.category"),
            "diagnosis": self.get("it.diagnosis"),
            "facts": self.get("it.facts") or self.get("soc.evidence") or {},
            "attempted": self.get("it.attempted") or [],
            "ticket_context": self.get("ticket_context"),
        }

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_json(self) -> str:
        return json.dumps(self._data)

    def to_dict(self) -> dict:
        return dict(self._data)
