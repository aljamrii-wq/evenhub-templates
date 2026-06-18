"""Tests for engine/mode_detector.py — Mode Detection Service."""

import json
from datetime import time, datetime
from mode_detector import ModeDetector, DetectedMode, Mode


class TestDetectedMode:
    """Test detection result model."""

    def test_detected_mode_creation(self):
        dm = DetectedMode(mode=Mode.FLYDUBAI, confidence=0.85, reason="Working hours")
        assert dm.mode == Mode.FLYDUBAI
        assert dm.confidence == 0.85
        assert dm.reason == "Working hours"

    def test_to_dict(self):
        dm = DetectedMode(mode=Mode.PERSONAL, confidence=0.5, reason="Unknown")
        d = dm.to_dict()
        assert d["mode"] == "personal"
        assert d["confidence"] == 0.5

    def test_to_json(self):
        dm = DetectedMode(mode=Mode.ALJAMRI, confidence=0.9, reason="Test")
        parsed = json.loads(dm.to_json())
        assert parsed["mode"] == "aljamri"


class TestModeDetector:
    """Test mode detection logic."""

    def test_creation(self):
        md = ModeDetector()
        assert md is not None

    def test_default_mode_is_personal(self):
        md = ModeDetector()
        # Force a personal-mode time to avoid test flakiness
        result = md.detect(current_time=time(3, 0))
        assert result.mode == Mode.PERSONAL

    def test_time_based_flydubai_working_hours(self):
        """During Flydubai working hours, should detect Flydubai mode."""
        md = ModeDetector()
        # 10 AM is within working hours
        result = md.detect(current_time=time(10, 0))
        assert result.mode == Mode.FLYDUBAI
        assert result.confidence > 0.5

    def test_time_based_aljamri_evening(self):
        """Evening hours should lean toward Aljamri ops."""
        md = ModeDetector()
        result = md.detect(current_time=time(19, 0))
        assert result.mode == Mode.ALJAMRI
        assert result.confidence > 0.5

    def test_time_based_personal_late_night(self):
        """Late night should be Personal."""
        md = ModeDetector()
        result = md.detect(current_time=time(2, 0))
        assert result.mode == Mode.PERSONAL
        assert result.confidence > 0.5

    def test_override_from_recent_interactions(self):
        """Recent interactions should override time-based detection."""
        md = ModeDetector()
        result = md.detect(
            current_time=time(10, 0),  # Would normally be Flydubai
            recent_interactions=["ops deploy report", "server check"],
        )
        # Ops-related keywords should push toward Aljamri
        assert result.mode == Mode.ALJAMRI

    def test_device_info_influences_mode(self):
        """Device context can influence detection."""
        md = ModeDetector()
        result = md.detect(device_info={"location": "home"})
        assert result.mode == Mode.PERSONAL

    def test_office_location(self):
        md = ModeDetector()
        result = md.detect(device_info={"location": "office"})
        assert result.mode == Mode.FLYDUBAI

    def test_confidence_is_between_0_and_1(self):
        md = ModeDetector()
        for hour in range(24):
            result = md.detect(current_time=time(hour, 0))
            assert 0.0 <= result.confidence <= 1.0

    def test_flydubai_keywords_detected(self):
        md = ModeDetector()
        result = md.detect(
            current_time=time(14, 0),
            recent_interactions=["check flight EK123", "booking status"],
        )
        assert result.mode == Mode.FLYDUBAI
        assert result.confidence >= 0.8

    def test_empty_interactions_fallback(self):
        md = ModeDetector()
        result = md.detect(current_time=time(14, 0), recent_interactions=[])
        assert result.mode == Mode.FLYDUBAI  # time-based fallback

    def test_unknown_keywords_no_override(self):
        md = ModeDetector()
        result = md.detect(
            current_time=time(10, 0),
            recent_interactions=["xyzzy unknown text"],
        )
        # Should fall back to time-based (Flydubai at 10 AM)
        assert result.mode == Mode.FLYDUBAI
