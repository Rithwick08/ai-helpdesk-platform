"""
incident_workflows.py — Pure data + helpers for Security Incident response.

Mirrors the structure of troubleshooting_workflows.py but for security events.

This module is intentionally side-effect-free:
  - No LLM calls
  - No database access
  - No tool execution
  - No planner or workflow state
  - No imports beyond the Python standard library

Step schema
-----------
{
    "id":                str,   # unique within the workflow
    "title":             str,   # short label for logging / display
    "question":          str,   # exact message shown to the user
    "requires_response": bool,  # True = wait for user reply before advancing
    "action_required":   str | None,  # immediate action the user must take NOW
    "success_next":      str | None,  # step ID if user answers yes / action taken
    "failure_next":      str | None,  # step ID if user answers no / action not taken
}

Special sentinel IDs (same contract as troubleshooting_workflows.py)
    "ESCALATE"  — collect all answers and escalate to SOC team immediately
    "RESOLVED"  — incident handled without SOC escalation (rare for security)

Helper functions
    get_workflow(category)
    get_first_step(category)
    get_step(category, step_id)
    get_next_step(category, current_step_id, success)
    get_all_categories()
    get_step_count(category)
"""

from typing import Optional

# ── Workflow definitions ──────────────────────────────────────────────────────

WORKFLOWS: dict[str, list[dict]] = {

    # ── PHISHING ──────────────────────────────────────────────────────────────
    "phishing": [
        {
            "id":                "clicked_link",
            "title":             "Clicked the Link",
            "question":          "Did you click any link inside the suspicious email?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "entered_credentials",   # yes → more risk
            "failure_next":      "opened_attachment",      # no  → check attachment
        },
        {
            "id":                "entered_credentials",
            "title":             "Entered Credentials",
            "question":          "On the page that opened, did you enter your username, password, or any other credentials?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "disconnect_network",    # yes → high risk, isolate
            "failure_next":      "opened_attachment",     # no  → check next vector
        },
        {
            "id":                "opened_attachment",
            "title":             "Opened Attachment",
            "question":          "Did you open or download any attachment from the email?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "disconnect_network",    # yes → potential malware
            "failure_next":      "forward_email",         # no  → lower risk
        },
        {
            "id":                "disconnect_network",
            "title":             "Disconnect from Network",
            "question":          "IMMEDIATE ACTION REQUIRED: Please disconnect your computer from the network right now — unplug the ethernet cable or turn off Wi-Fi. Have you disconnected?",
            "action_required":   "Disconnect from company network immediately",
            "requires_response": True,
            "success_next":      "mfa_check",
            "failure_next":      "mfa_check",            # proceed regardless
        },
        {
            "id":                "mfa_check",
            "title":             "MFA Status",
            "question":          "Do you have multi-factor authentication (MFA) enabled on the account that may have been compromised?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "ESCALATE",             # MFA helps, but still escalate
            "failure_next":      "ESCALATE",             # no MFA → higher risk, escalate
        },
        {
            "id":                "forward_email",
            "title":             "Preserve the Email",
            "question":          "Good — you did not click any links or attachments. Please do NOT delete the email as it is evidence. Can you forward it to security@company.com and then move it to your Junk folder?",
            "action_required":   "Forward suspicious email to security@company.com",
            "requires_response": True,
            "success_next":      "RESOLVED",             # reported + preserved
            "failure_next":      "ESCALATE",
        },
    ],

    # ── MALWARE ───────────────────────────────────────────────────────────────
    "malware": [
        {
            "id":                "device_powered",
            "title":             "Device Still On",
            "question":          "Is the affected device currently powered on?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "disconnect_network",
            "failure_next":      "other_devices_affected",  # off → check spread
        },
        {
            "id":                "disconnect_network",
            "title":             "Disconnect from Network",
            "question":          "IMMEDIATE ACTION REQUIRED: Disconnect the device from the network right now — unplug ethernet and/or turn off Wi-Fi. Have you disconnected?",
            "action_required":   "Disconnect from network immediately — do NOT shut down the device yet",
            "requires_response": True,
            "success_next":      "antivirus_scan",
            "failure_next":      "antivirus_scan",        # proceed regardless
        },
        {
            "id":                "antivirus_scan",
            "title":             "Antivirus Detection",
            "question":          "Has your antivirus software displayed any alerts or detected any threats? If so, what is the name of the threat shown?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "files_accessible",
            "failure_next":      "files_accessible",
        },
        {
            "id":                "files_accessible",
            "title":             "Files Accessible",
            "question":          "Can you still open and read your files normally, or do any files appear corrupted, missing, or renamed?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "other_devices_affected",
            "failure_next":      "ESCALATE",              # file corruption → ransomware risk
        },
        {
            "id":                "other_devices_affected",
            "title":             "Other Devices Affected",
            "question":          "Are any other computers or devices on the same network showing unusual behaviour — slow performance, strange pop-ups, or unexpected file changes?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "ESCALATE",              # spread detected → urgent
            "failure_next":      "ESCALATE",              # always escalate malware
        },
    ],

    # ── RANSOMWARE ────────────────────────────────────────────────────────────
    "ransomware": [
        {
            "id":                "confirm_encryption",
            "title":             "Confirm File Encryption",
            "question":          "Are your files showing strange extensions (e.g. .locked, .encrypted, .crypted), and are you seeing a ransom note or a message demanding payment?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "disconnect_immediately",
            "failure_next":      "disconnect_immediately",  # always isolate first
        },
        {
            "id":                "disconnect_immediately",
            "title":             "Isolate the Device NOW",
            "question":          "CRITICAL — Disconnect the device from the network IMMEDIATELY. Unplug the ethernet cable AND turn off Wi-Fi. Do NOT shut down. Have you disconnected?",
            "action_required":   "Disconnect from ALL networks immediately — ethernet and Wi-Fi",
            "requires_response": True,
            "success_next":      "shared_drives_check",
            "failure_next":      "shared_drives_check",   # proceed regardless
        },
        {
            "id":                "shared_drives_check",
            "title":             "Shared Drives / Network Shares",
            "question":          "Before being disconnected, was this device connected to any shared drives or network folders? If yes, are those files also affected?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "other_machines_check",
            "failure_next":      "other_machines_check",
        },
        {
            "id":                "other_machines_check",
            "title":             "Other Machines Affected",
            "question":          "Are any other computers on the same network or in the same office showing similar symptoms — encrypted files, ransom notes, or inaccessible data?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "ESCALATE",              # spread → critical
            "failure_next":      "ESCALATE",              # always escalate ransomware
        },
    ],

    # ── ACCOUNT COMPROMISE ────────────────────────────────────────────────────
    "account_compromise": [
        {
            "id":                "still_has_access",
            "title":             "Account Still Accessible",
            "question":          "Can you still log into the compromised account right now?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "change_password",       # has access → change password
            "failure_next":      "recovery_attempted",    # locked out
        },
        {
            "id":                "change_password",
            "title":             "Change Password Immediately",
            "question":          "Please change your password for this account RIGHT NOW to a strong, unique password you haven't used before. Have you changed it?",
            "action_required":   "Change account password immediately",
            "requires_response": True,
            "success_next":      "mfa_enabled",
            "failure_next":      "mfa_enabled",           # proceed regardless
        },
        {
            "id":                "recovery_attempted",
            "title":             "Account Lockout",
            "question":          "Have you tried the account recovery process? If not, please attempt it now using your registered recovery email or phone number.",
            "action_required":   "Attempt account recovery process",
            "requires_response": True,
            "success_next":      "change_password",
            "failure_next":      "mfa_enabled",
        },
        {
            "id":                "mfa_enabled",
            "title":             "MFA Status",
            "question":          "Is multi-factor authentication (MFA/2FA) enabled on this account?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "active_sessions_review",
            "failure_next":      "active_sessions_review",
        },
        {
            "id":                "active_sessions_review",
            "title":             "Review Active Sessions",
            "question":          "Please check the account's active sessions or login history. Are there any sessions from unknown locations, devices, or IP addresses that you do not recognise?",
            "action_required":   "Review all active sessions and sign out of unrecognised ones",
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── SUSPICIOUS LOGIN ──────────────────────────────────────────────────────
    "suspicious_login": [
        {
            "id":                "login_yours",
            "title":             "Was the Login Yours",
            "question":          "The alert shows a login from an unusual location or device. Was this login attempt made by you — for example, were you travelling or using a new device?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "RESOLVED",              # confirmed legitimate → no incident
            "failure_next":      "still_has_access",      # not theirs → investigate
        },
        {
            "id":                "still_has_access",
            "title":             "Account Still Accessible",
            "question":          "Can you still log into the account right now?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "reset_password",
            "failure_next":      "locked_out_recovery",
        },
        {
            "id":                "reset_password",
            "title":             "Reset Password",
            "question":          "Please reset your password immediately to something strong and unique. Have you done this?",
            "action_required":   "Reset account password immediately",
            "requires_response": True,
            "success_next":      "revoke_sessions",
            "failure_next":      "revoke_sessions",
        },
        {
            "id":                "locked_out_recovery",
            "title":             "Account Recovery",
            "question":          "You appear to be locked out. Please use the account recovery option with your registered phone or email. Were you able to regain access?",
            "action_required":   "Attempt account recovery immediately",
            "requires_response": True,
            "success_next":      "reset_password",
            "failure_next":      "ESCALATE",
        },
        {
            "id":                "revoke_sessions",
            "title":             "Revoke All Other Sessions",
            "question":          "In your account security settings, please sign out of ALL other sessions and revoke access to any unrecognised apps. Have you done this?",
            "action_required":   "Sign out of all active sessions and revoke unknown app access",
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── DATA LOSS ─────────────────────────────────────────────────────────────
    "data_loss": [
        {
            "id":                "data_sensitivity",
            "title":             "Data Sensitivity",
            "question":          "Was the data that was exposed, sent, or lost classified as Confidential, Sensitive, or Personal (PII)? Or was it general business information?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "recipient_type",        # sensitive → high priority
            "failure_next":      "recipient_type",        # still needs investigation
        },
        {
            "id":                "recipient_type",
            "title":             "Recipient Type",
            "question":          "Was the data sent or exposed to someone OUTSIDE the company (external), or was it within the company (internal)?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "contact_recipient",     # external → contact them
            "failure_next":      "internal_scope",        # internal → assess scope
        },
        {
            "id":                "contact_recipient",
            "title":             "Contact the Recipient",
            "question":          "Have you already contacted the external recipient and asked them to delete the data and not share it further?",
            "action_required":   "Contact the recipient immediately and request data deletion",
            "requires_response": True,
            "success_next":      "data_deleted_confirmed",
            "failure_next":      "ESCALATE",              # uncontacted → urgent
        },
        {
            "id":                "data_deleted_confirmed",
            "title":             "Deletion Confirmation",
            "question":          "Did the recipient confirm in writing (email or message) that they have deleted the data?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "ESCALATE",              # still log it, even if resolved
            "failure_next":      "ESCALATE",
        },
        {
            "id":                "internal_scope",
            "title":             "Internal Scope",
            "question":          "Has the data been further shared or forwarded internally to people who should not have access to it?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── USB DEVICE ────────────────────────────────────────────────────────────
    "usb_device": [
        {
            "id":                "usb_inserted",
            "title":             "USB Was Inserted",
            "question":          "Was the USB device inserted into a company computer, or did you only find it without connecting it?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "files_executed",        # inserted → higher risk
            "failure_next":      "device_handed_in",      # not inserted → hand it in
        },
        {
            "id":                "files_executed",
            "title":             "Files Executed",
            "question":          "After inserting the USB, did any program launch automatically, did you open or run any files from it?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "disconnect_device_network",   # executed → high risk
            "failure_next":      "remove_usb",            # not executed → lower risk
        },
        {
            "id":                "remove_usb",
            "title":             "Remove the USB",
            "question":          "Please safely eject and remove the USB device from the computer right now. Have you removed it?",
            "action_required":   "Safely eject and remove the USB device immediately",
            "requires_response": True,
            "success_next":      "antivirus_scan",
            "failure_next":      "antivirus_scan",
        },
        {
            "id":                "disconnect_device_network",
            "title":             "Disconnect from Network",
            "question":          "A file was executed from an unknown USB — this is high risk. Please disconnect the computer from the network and remove the USB device now. Have you done both?",
            "action_required":   "Disconnect from network AND remove USB immediately",
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "ESCALATE",
        },
        {
            "id":                "antivirus_scan",
            "title":             "Run Antivirus Scan",
            "question":          "Please run a full antivirus scan on the computer right now. Did the scan find anything suspicious or malicious?",
            "action_required":   "Run a full antivirus scan immediately",
            "requires_response": True,
            "success_next":      "ESCALATE",              # threats found → escalate
            "failure_next":      "device_handed_in",      # clean → hand in USB
        },
        {
            "id":                "device_handed_in",
            "title":             "Hand in the Device",
            "question":          "Please hand the USB device to your IT or Security team so it can be forensically examined. Do NOT plug it into any other device. Have you handed it in, or can you bring it to IT?",
            "action_required":   "Hand the USB device to IT Security for forensic examination",
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── INSIDER THREAT ────────────────────────────────────────────────────────
    "insider_threat": [
        {
            "id":                "activity_observed",
            "title":             "Describe Observed Activity",
            "question":          "Without naming the individual yet, can you describe specifically what activity you observed that concerned you? For example: accessing files they should not have access to, copying data, unusual system access.",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "timeframe",
            "failure_next":      "timeframe",
        },
        {
            "id":                "timeframe",
            "title":             "Timeframe of Activity",
            "question":          "When did you first notice this activity? Please provide an approximate date and time if possible.",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "evidence_available",
            "failure_next":      "evidence_available",
        },
        {
            "id":                "evidence_available",
            "title":             "Evidence Availability",
            "question":          "Do you have any evidence of this activity — for example, screenshots, file access logs, email trails, or system logs? Please do NOT confront the individual or alert them.",
            "action_required":   "Do NOT confront the individual or alter any evidence",
            "requires_response": True,
            "success_next":      "business_impact",
            "failure_next":      "business_impact",
        },
        {
            "id":                "business_impact",
            "title":             "Business Impact",
            "question":          "To your knowledge, has any sensitive data, intellectual property, customer information, or company assets been accessed or removed?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── DEVICE THEFT ──────────────────────────────────────────────────────────
    "device_theft": [
        {
            "id":                "company_device",
            "title":             "Confirm Company Device",
            "question":          "Was the stolen or lost device a company-issued device, or was it your personal device that contained company data?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "encryption_enabled",   # company device → higher risk
            "failure_next":      "personal_data_check",  # personal device
        },
        {
            "id":                "encryption_enabled",
            "title":             "Disk Encryption",
            "question":          "Do you know if the device had full-disk encryption enabled (e.g. BitLocker on Windows, FileVault on Mac)?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "remote_wipe",          # encrypted → lower data risk, still wipe
            "failure_next":      "remote_wipe",          # not encrypted → high data risk, wipe urgent
        },
        {
            "id":                "personal_data_check",
            "title":             "Company Data on Personal Device",
            "question":          "Did your personal device contain company emails, files, VPN credentials, or any other company data?",
            "action_required":   None,
            "requires_response": True,
            "success_next":      "remote_wipe",          # yes data → need to act
            "failure_next":      "report_to_police",     # no data → lower risk
        },
        {
            "id":                "remote_wipe",
            "title":             "Remote Wipe",
            "question":          "A remote wipe of the device is strongly recommended to protect company data. Do you consent to a remote wipe being triggered on this device?",
            "action_required":   "Prepare remote wipe via MDM — awaiting confirmation",
            "requires_response": True,
            "success_next":      "report_to_police",
            "failure_next":      "report_to_police",     # proceed with report regardless
        },
        {
            "id":                "report_to_police",
            "title":             "Police Report",
            "question":          "For a stolen device, you should file a police report and obtain a crime reference number. Have you reported the theft to the police?",
            "action_required":   "File a police report and obtain a crime reference number",
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "ESCALATE",
        },
    ],
}

# ── Helper functions ──────────────────────────────────────────────────────────

def get_workflow(category: str) -> list[dict]:
    """
    Return the full ordered list of steps for a category.
    Returns an empty list if the category is not found.
    """
    return WORKFLOWS.get(category.lower().strip(), [])


def get_first_step(category: str) -> Optional[dict]:
    """Return the first step in a workflow, or None if not found."""
    steps = get_workflow(category)
    return steps[0] if steps else None


def get_step(category: str, step_id: str) -> Optional[dict]:
    """Return a specific step by ID, or None if not found."""
    for step in get_workflow(category):
        if step["id"] == step_id:
            return step
    return None


def get_next_step(category: str, current_step_id: str, success: bool) -> Optional[dict]:
    """
    Resolve the next step based on the user's response.

    Args:
        category:        Incident workflow category (e.g. "phishing")
        current_step_id: ID of the step just completed
        success:         True = user answered yes / action taken
                         False = user answered no / action not taken

    Returns:
        A step dict, or one of the sentinel dicts below:
          {"id": "ESCALATE", ...}  — escalate to SOC
          {"id": "RESOLVED", ...}  — no escalation needed
        Returns None if current_step_id is not found in the workflow.
    """
    current = get_step(category, current_step_id)
    if current is None:
        return None

    next_id = current["success_next"] if success else current["failure_next"]

    if next_id == "ESCALATE":
        return {
            "id":                "ESCALATE",
            "title":             "Escalate to SOC",
            "question":          "",
            "action_required":   None,
            "requires_response": False,
            "success_next":      None,
            "failure_next":      None,
        }

    if next_id == "RESOLVED":
        return {
            "id":                "RESOLVED",
            "title":             "Incident Contained",
            "question":          "",
            "action_required":   None,
            "requires_response": False,
            "success_next":      None,
            "failure_next":      None,
        }

    return get_step(category, next_id)


def get_all_categories() -> list[str]:
    """Return all supported incident workflow categories."""
    return list(WORKFLOWS.keys())


def get_step_count(category: str) -> int:
    """Return the number of steps in a workflow."""
    return len(get_workflow(category))
