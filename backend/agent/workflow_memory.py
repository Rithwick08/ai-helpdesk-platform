"""
workflow_memory.py — Structured workflow context store.

Every tool defines its required fields.
The agent knows exactly what is known, what is missing, and what has been tried.

Transport-independent: no I/O here, just pure data helpers.

IT Support workflow fields (added in Step 3):
    current_category  — e.g. "outlook", "vpn"
    current_step      — step ID currently being worked on
    completed_steps   — list of step IDs already presented
    failed_steps      — list of step IDs the user said did NOT work
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

    Full schema:
    {
        # ── General fields ─────────────────────────────────────────────────────
        "problem":           str | null,
        "account_type":      str | null,
        "operating_system":  str | null,
        "device":            str | null,
        "application":       str | null,
        "error_message":     str | null,
        "incident_type":     str | null,
        "urgency":           str | null,
        "missing_fields":    list[str],
        "confidence":        int (0-10),

        # ── IT Support workflow tracking ────────────────────────────────────────
        "it_category":       str | null,   # classifier output: "outlook", "vpn", etc.
        "current_step":      str | null,   # step ID currently presented to user
        "completed_steps":   list[str],    # step IDs presented (success or failure)
        "failed_steps":      list[str],    # step IDs the user said didn't work

        # ── Security Incident workflow tracking ─────────────────────────────────
        "incident_category":          str | null,  # e.g. "phishing", "ransomware"
        "current_incident_step":      str | null,  # step ID currently being worked
        "completed_incident_steps":   list[str],   # all step IDs presented
        "failed_incident_steps":      list[str],   # steps user answered 'no' to
        "incident_severity":          str | null,  # "Low" | "Medium" | "High" | "Critical"
    }
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

        # ── IT Support workflow tracking fields ────────────────────────────────
        self._data.setdefault("it_category",     None)
        self._data.setdefault("current_step",    None)
        self._data.setdefault("completed_steps",  [])
        self._data.setdefault("failed_steps",     [])

        # ── Security Incident workflow tracking fields ──────────────────────────
        self._data.setdefault("incident_category",         None)
        self._data.setdefault("current_incident_step",     None)
        self._data.setdefault("completed_incident_steps",  [])
        self._data.setdefault("failed_incident_steps",     [])
        self._data.setdefault("incident_severity",         None)

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

    @property
    def incident_category(self) -> Optional[str]:
        """Resolved incident category (e.g. 'phishing', 'ransomware')."""
        return self._data.get("incident_category")

    @property
    def current_incident_step(self) -> Optional[str]:
        """Step ID of the incident-response question currently being asked."""
        return self._data.get("current_incident_step")

    @property
    def completed_incident_steps(self) -> list:
        """All incident-response step IDs that have been presented."""
        return self._data.get("completed_incident_steps", [])

    @property
    def failed_incident_steps(self) -> list:
        """Incident-response step IDs the user answered 'no' to."""
        return self._data.get("failed_incident_steps", [])

    @property
    def incident_severity(self) -> Optional[str]:
        """Severity level: 'Low' | 'Medium' | 'High' | 'Critical'."""
        return self._data.get("incident_severity")

    # ── Security Incident workflow mutators ───────────────────────────────────

    def set_incident_category(self, category: str):
        """Store the resolved incident category."""
        self._data["incident_category"] = category.lower().strip()

    def set_current_incident_step(self, step_id: str):
        """Mark which incident-response step is currently being worked on."""
        self._data["current_incident_step"] = step_id

    def set_incident_severity(self, severity: str):
        """Store the incident severity level."""
        self._data["incident_severity"] = severity

    def mark_incident_step_completed(self, step_id: str):
        """Record that an incident-response step has been presented."""
        normalised = step_id.lower().strip()
        existing   = [s.lower().strip() for s in self._data.get("completed_incident_steps", [])]
        if normalised not in existing:
            self._data.setdefault("completed_incident_steps", []).append(step_id)

    def mark_incident_step_failed(self, step_id: str):
        """Record that the user answered 'no' to an incident-response step."""
        normalised = step_id.lower().strip()
        existing   = [s.lower().strip() for s in self._data.get("failed_incident_steps", [])]
        if normalised not in existing:
            self._data.setdefault("failed_incident_steps", []).append(step_id)
        self.mark_incident_step_completed(step_id)

    def has_completed_incident_step(self, step_id: str) -> bool:
        """Return True if this incident-response step has already been presented."""
        normalised = step_id.lower().strip()
        return normalised in [s.lower().strip() for s in self.completed_incident_steps]

    # ── Analysis ──────────────────────────────────────────────────────────────

    def missing_for_tool(self, tool_name: str) -> list[str]:
        required = TOOL_REQUIRED_FIELDS.get(tool_name, [])
        return [f for f in required if not self._data.get(f)]

    def is_ready_for_tool(self, tool_name: str) -> bool:
        return len(self.missing_for_tool(tool_name)) == 0

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_json(self) -> str:
        return json.dumps(self._data)

    def to_dict(self) -> dict:
        return dict(self._data)
