"""
test_telephony_module.py — Telephony package unit tests.
"""

from voice.telephony.call_session import CallSession
from voice.telephony.twiml import build_error_twiml, build_welcome_twiml


def test_telephony_module_twiml():
    xml = build_welcome_twiml()
    assert "<Response>" in xml
    assert "CyberShield AI" in xml


def test_telephony_module_error_twiml():
    xml = build_error_twiml("Call failed.")
    assert "<Response>" in xml
    assert "Call failed." in xml


def test_telephony_module_call_session():
    s = CallSession(call_sid="CA999", caller_number="+1000000000")
    assert s.call_sid == "CA999"
    s.complete()
    assert s.status == "completed"
