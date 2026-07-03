"""
troubleshooting_workflows.py — Pure data + helpers for IT troubleshooting.

This module is intentionally side-effect-free:
  - No LLM calls
  - No database access
  - No tool execution
  - No planner or workflow state
  - No imports beyond the Python standard library

Each step follows this schema:
    {
        "id":               str,   # unique within the workflow
        "title":            str,   # short label (for logging / UI)
        "question":         str,   # the exact message sent to the user
        "requires_response": bool, # True = wait for user reply before moving on
        "success_next":     str | None,  # step ID to go to if user says it worked
        "failure_next":     str | None,  # step ID to go to if user says it didn't
    }

When success_next or failure_next is None it means the workflow ends
(either resolved or escalate to ticket).

Special sentinel IDs
  "RESOLVED"  — issue fixed, no ticket needed
  "ESCALATE"  — all self-service options exhausted, create ticket

Helper functions
  get_workflow(category)               → list of steps  | []
  get_first_step(category)             → step dict      | None
  get_step(category, step_id)          → step dict      | None
  get_next_step(category, step_id, success: bool) → step dict | None
"""

from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# Workflow definitions
# ─────────────────────────────────────────────────────────────────────────────

WORKFLOWS: dict[str, list[dict]] = {

    # ── OUTLOOK ───────────────────────────────────────────────────────────────
    "outlook": [
        {
            "id":                "restart_outlook",
            "title":             "Restart Outlook",
            "question":          "Let's start with a full restart. Close Outlook completely — including from the system tray — then reopen it. Is the issue still happening?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "safe_mode",
        },
        {
            "id":                "safe_mode",
            "title":             "Open Outlook in Safe Mode",
            "question":          "Press Win + R, type `outlook.exe /safe`, and press Enter. Did Outlook open without the issue in Safe Mode?",
            "requires_response": True,
            "success_next":      "disable_addins",
            "failure_next":      "repair_office",
        },
        {
            "id":                "disable_addins",
            "title":             "Disable Add-ins",
            "question":          "Safe Mode worked, which means an add-in is likely the cause. Go to File → Options → Add-Ins → Manage: COM Add-Ins → Go, then uncheck all add-ins and click OK. Restart Outlook normally. Is it working now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "repair_office",
        },
        {
            "id":                "repair_office",
            "title":             "Run Office Quick Repair",
            "question":          "Go to Control Panel → Programs → Microsoft 365 → Change → Quick Repair. Run it and restart Outlook once it finishes. Has the issue been resolved?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "new_profile",
        },
        {
            "id":                "new_profile",
            "title":             "Create a New Outlook Profile",
            "question":          "Go to Control Panel → Mail → Show Profiles → Add, create a new profile with your company email, and set it as default. Does Outlook work correctly with the new profile?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "update_office",
        },
        {
            "id":                "update_office",
            "title":             "Check for Office Updates",
            "question":          "In Outlook go to File → Office Account → Update Options → Update Now. Install any available updates and restart. Is the issue resolved after updating?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── VPN ───────────────────────────────────────────────────────────────────
    "vpn": [
        {
            "id":                "internet_check",
            "title":             "Verify Internet Connectivity",
            "question":          "Before troubleshooting VPN, can you confirm your internet is working? Try opening a website like google.com. Is your internet connection working?",
            "requires_response": True,
            "success_next":      "restart_vpn_client",
            "failure_next":      "network_adapter_reset",
        },
        {
            "id":                "restart_vpn_client",
            "title":             "Restart VPN Client",
            "question":          "Disconnect from the VPN, close the VPN client completely, wait 10 seconds, then reopen and reconnect. Did that fix the connection?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "credential_check",
        },
        {
            "id":                "credential_check",
            "title":             "Re-enter VPN Credentials",
            "question":          "Try signing out of the VPN client and signing back in with your company username and password. Are you able to connect now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "gateway_ping",
        },
        {
            "id":                "gateway_ping",
            "title":             "Check VPN Gateway Reachability",
            "question":          "Open Command Prompt and run `ping vpn.company.com` (or the VPN gateway address shown in the client). Are you getting replies, or does it time out?",
            "requires_response": True,
            "success_next":      "vpn_logs",
            "failure_next":      "network_adapter_reset",
        },
        {
            "id":                "vpn_logs",
            "title":             "Check VPN Client Logs",
            "question":          "Open the VPN client, go to its log or diagnostics section, and look for any error codes. Do you see a specific error message or code?",
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "network_adapter_reset",
        },
        {
            "id":                "network_adapter_reset",
            "title":             "Reset Network Adapter",
            "question":          "Open Settings → Network & Internet → Adapter Options, right-click your Wi-Fi or Ethernet adapter, click Disable, wait 5 seconds, then Enable. Try VPN again. Is it connecting?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "reinstall_vpn",
        },
        {
            "id":                "reinstall_vpn",
            "title":             "Reinstall VPN Client",
            "question":          "Uninstall the VPN client from Control Panel → Programs, restart your PC, then reinstall the latest version from the company software portal. Can you connect now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── NETWORK ───────────────────────────────────────────────────────────────
    "network": [
        {
            "id":                "other_devices",
            "title":             "Check Other Devices",
            "question":          "Is the network issue affecting only your device, or are other devices on the same network also affected?",
            "requires_response": True,
            "success_next":      "restart_adapter",   # only my device
            "failure_next":      "escalate_infra",    # multiple devices → infra issue
        },
        {
            "id":                "restart_adapter",
            "title":             "Restart Network Adapter",
            "question":          "Go to Settings → Network & Internet → Adapter Options, right-click your Wi-Fi or Ethernet adapter → Disable, wait 5 seconds, then Enable. Is the connection restored?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "ipconfig_renew",
        },
        {
            "id":                "ipconfig_renew",
            "title":             "Release and Renew IP Address",
            "question":          "Open Command Prompt as administrator and run these two commands:\n1. `ipconfig /release`\n2. `ipconfig /renew`\nIs your network working after that?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "dns_flush",
        },
        {
            "id":                "dns_flush",
            "title":             "Flush DNS Cache",
            "question":          "In the same administrator Command Prompt, run `ipconfig /flushdns`. Then try accessing a website. Is the connection working now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "winsock_reset",
        },
        {
            "id":                "winsock_reset",
            "title":             "Reset Winsock",
            "question":          "Run `netsh winsock reset` in an administrator Command Prompt, then restart your PC. Is the network working after the restart?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "ESCALATE",
        },
        {
            "id":                "escalate_infra",
            "title":             "Infrastructure Issue Detected",
            "question":          "Since multiple devices are affected this is likely a network infrastructure issue rather than your device. I'll escalate this to the network team immediately. Can you confirm how many devices are affected and which floor/location you're on?",
            "requires_response": True,
            "success_next":      "ESCALATE",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── PRINTER ───────────────────────────────────────────────────────────────
    "printer": [
        {
            "id":                "online_check",
            "title":             "Check Printer Online Status",
            "question":          "Is the printer showing as Online in Settings → Bluetooth & devices → Printers & scanners? If it says Offline, is it powered on and connected to the network?",
            "requires_response": True,
            "success_next":      "test_print",
            "failure_next":      "paper_jam_check",
        },
        {
            "id":                "paper_jam_check",
            "title":             "Check for Paper Jam or Low Supplies",
            "question":          "Check the printer's display panel or indicator lights. Is there a paper jam, low toner, or any error light showing?",
            "requires_response": True,
            "success_next":      "restart_spooler",
            "failure_next":      "restart_spooler",
        },
        {
            "id":                "test_print",
            "title":             "Send a Test Print",
            "question":          "Right-click the printer in Settings → Printers & scanners → Printer properties → Print Test Page. Did the test page print successfully?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "restart_spooler",
        },
        {
            "id":                "restart_spooler",
            "title":             "Restart Print Spooler",
            "question":          "Press Win + R, type `services.msc`, find Print Spooler in the list, right-click it and select Restart. Then try printing again. Did that resolve the issue?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "remove_add_printer",
        },
        {
            "id":                "remove_add_printer",
            "title":             "Remove and Re-add Printer",
            "question":          "Go to Settings → Printers & scanners, click your printer, select Remove, then add it again using Add a printer or scanner. Is it printing now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "reinstall_driver",
        },
        {
            "id":                "reinstall_driver",
            "title":             "Reinstall Printer Driver",
            "question":          "Search for your printer model on the manufacturer's website, download the latest driver, install it, and restart your PC. Is the printer working now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── TEAMS ─────────────────────────────────────────────────────────────────
    "teams": [
        {
            "id":                "restart_teams",
            "title":             "Restart Microsoft Teams",
            "question":          "Right-click the Teams icon in the system tray and select Quit. Then reopen Teams from the Start menu. Is the issue resolved after a fresh start?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "sign_out_in",
        },
        {
            "id":                "sign_out_in",
            "title":             "Sign Out and Sign Back In",
            "question":          "In Teams click your profile picture → Sign Out. Wait 10 seconds then sign back in with your company account. Did that fix the issue?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "clear_cache",
        },
        {
            "id":                "clear_cache",
            "title":             "Clear Teams Cache",
            "question":          "Quit Teams completely. Open File Explorer and navigate to `%appdata%\\Microsoft\\Teams`. Delete the contents of these folders: `Cache`, `blob_storage`, `databases`, `GPUCache`, `IndexedDB`, `Local Storage`, `tmp`. Reopen Teams. Is it working now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "network_check",
        },
        {
            "id":                "network_check",
            "title":             "Check Network Connectivity",
            "question":          "Can you open a browser and load a website like outlook.office.com? I want to confirm your internet is working before we go further.",
            "requires_response": True,
            "success_next":      "update_teams",
            "failure_next":      "ESCALATE",
        },
        {
            "id":                "update_teams",
            "title":             "Update Microsoft Teams",
            "question":          "In Teams, click your profile picture → Check for updates. Install any available updates and restart. Is the issue resolved after updating?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "reinstall_teams",
        },
        {
            "id":                "reinstall_teams",
            "title":             "Reinstall Microsoft Teams",
            "question":          "Uninstall Teams from Control Panel → Programs, restart your PC, then download and install the latest Teams client from aka.ms/getteams. Is it working correctly now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── OFFICE ────────────────────────────────────────────────────────────────
    "office": [
        {
            "id":                "restart_app",
            "title":             "Restart the Application",
            "question":          "Close the Office application completely — including from the taskbar — and reopen it. Is the issue still occurring?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "safe_mode",
        },
        {
            "id":                "safe_mode",
            "title":             "Open in Safe Mode",
            "question":          "Press Win + R and run the app in safe mode:\n• Word: `winword /safe`\n• Excel: `excel /safe`\n• PowerPoint: `powerpnt /safe`\nDoes the issue happen in Safe Mode too?",
            "requires_response": True,
            "success_next":      "disable_addins",
            "failure_next":      "repair_office",
        },
        {
            "id":                "disable_addins",
            "title":             "Disable Add-ins",
            "question":          "Safe Mode worked — an add-in is the likely cause. Go to File → Options → Add-Ins → Manage: COM Add-Ins → Go, uncheck all add-ins, click OK, and restart the application. Is it working now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "repair_office",
        },
        {
            "id":                "repair_office",
            "title":             "Run Office Quick Repair",
            "question":          "Go to Control Panel → Programs → Microsoft 365 → Change → Quick Repair. Run it and reopen the application once done. Is the issue resolved?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "update_office",
        },
        {
            "id":                "update_office",
            "title":             "Update Office",
            "question":          "In any Office app go to File → Account → Update Options → Update Now. Install all available updates and restart. Did that fix the issue?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "online_repair",
        },
        {
            "id":                "online_repair",
            "title":             "Run Office Online Repair",
            "question":          "Go to Control Panel → Programs → Microsoft 365 → Change → Online Repair (note: this takes longer and requires internet). After it finishes, restart your PC and reopen the app. Is it working now?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "ESCALATE",
        },
    ],

    # ── WINDOWS ───────────────────────────────────────────────────────────────
    "windows": [
        {
            "id":                "restart_pc",
            "title":             "Restart the Computer",
            "question":          "Please do a full restart (not Sleep or Shut down → Fast Startup — use Restart specifically). Is the issue still present after the restart?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "windows_update",
        },
        {
            "id":                "windows_update",
            "title":             "Check for Windows Updates",
            "question":          "Go to Settings → Windows Update → Check for updates. Install all available updates and restart. Is the issue resolved after updating?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "safe_mode",
        },
        {
            "id":                "safe_mode",
            "title":             "Boot into Safe Mode",
            "question":          "Go to Settings → System → Recovery → Advanced Startup → Restart now → Troubleshoot → Advanced options → Startup Settings → Restart → press 4 for Safe Mode. Does the issue occur in Safe Mode too?",
            "requires_response": True,
            "success_next":      "sfc_scan",    # issue in safe mode = OS/driver problem
            "failure_next":      "sfc_scan",    # issue NOT in safe mode = software conflict
        },
        {
            "id":                "sfc_scan",
            "title":             "Run System File Checker",
            "question":          "Open Command Prompt as administrator and run `sfc /scannow`. This checks for and repairs corrupted Windows files. When it finishes, did it report any integrity violations or did it repair any files?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "dism_repair",
        },
        {
            "id":                "dism_repair",
            "title":             "Run DISM Repair",
            "question":          "In the same administrator Command Prompt run:\n`DISM /Online /Cleanup-Image /RestoreHealth`\nThis may take 10–20 minutes. Did it complete successfully?",
            "requires_response": True,
            "success_next":      "system_restore",
            "failure_next":      "ESCALATE",
        },
        {
            "id":                "system_restore",
            "title":             "System Restore",
            "question":          "Search for 'Create a restore point' in the Start menu → System Restore → choose a restore point from before the issue started. Note: this won't delete your files. Did restoring to an earlier point fix the issue?",
            "requires_response": True,
            "success_next":      "RESOLVED",
            "failure_next":      "ESCALATE",
        },
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────────────────────────────────────

def get_workflow(category: str) -> list[dict]:
    """
    Return the full ordered list of steps for a category.
    Returns an empty list if the category is not found.
    """
    return WORKFLOWS.get(category.lower(), [])


def get_first_step(category: str) -> Optional[dict]:
    """
    Return the first step in a workflow, or None if the category is unsupported.
    """
    steps = get_workflow(category)
    return steps[0] if steps else None


def get_step(category: str, step_id: str) -> Optional[dict]:
    """
    Return a specific step by ID within a workflow.
    Returns None if not found.
    """
    for step in get_workflow(category):
        if step["id"] == step_id:
            return step
    return None


def get_next_step(category: str, current_step_id: str, success: bool) -> Optional[dict]:
    """
    Resolve the next step based on the user's outcome.

    Args:
        category:        The workflow category (e.g. "outlook")
        current_step_id: The ID of the step that was just completed
        success:         True if the step resolved the issue, False if it didn't

    Returns:
        - A step dict if there is a next step
        - {"id": "RESOLVED", ...}  if the workflow is complete without escalation
        - {"id": "ESCALATE", ...}  if the workflow should create a ticket
        - None if the step_id wasn't found

    Special sentinel steps:
        RESOLVED  → issue fixed
        ESCALATE  → create ticket / hand off to engineer
    """
    current = get_step(category, current_step_id)
    if current is None:
        return None

    next_id = current["success_next"] if success else current["failure_next"]

    if next_id == "RESOLVED":
        return {
            "id":                "RESOLVED",
            "title":             "Issue Resolved",
            "question":          "",
            "requires_response": False,
            "success_next":      None,
            "failure_next":      None,
        }

    if next_id == "ESCALATE":
        return {
            "id":                "ESCALATE",
            "title":             "Escalate to IT Engineer",
            "question":          "",
            "requires_response": False,
            "success_next":      None,
            "failure_next":      None,
        }

    return get_step(category, next_id)


def get_all_categories() -> list[str]:
    """Return the list of all supported workflow categories."""
    return list(WORKFLOWS.keys())


def get_step_count(category: str) -> int:
    """Return the number of steps in a workflow."""
    return len(get_workflow(category))
