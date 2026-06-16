"""Mode Detection Service for Aura engine.

Determines user context (Flydubai sales / Aljamri ops / Personal)
based on time of day, device info, and recent interactions.
"""

import json
import logging
from datetime import time, datetime
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class Mode(str, Enum):
    FLYDUBAI = "flydubai"
    ALJAMRI = "aljamri"
    PERSONAL = "personal"


@dataclass
class DetectedMode:
    """Mode detection result with confidence score."""
    mode: Mode
    confidence: float
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "mode": self.mode.value,
            "confidence": self.confidence,
            "reason": self.reason,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())


FLYDUBAI_KEYWORDS = {
    "flight", "booking", "ticket", "customer", "dubai", "flydubai",
    "travel", "holiday", "hotel", "passenger", "check-in", "boarding",
    "reservation", "cancel", "refund", "itinerary", "visa",
}

ALJAMRI_KEYWORDS = {
    "ops", "deploy", "server", "build", "pipeline", "ci/cd", "repo",
    "code", "merge", "pr", "review", "infra", "skyhub", "waselops",
    "uniops", "database", "migration", "monitor", "alert", "fix",
}

HOME_LOCATION_KEYWORDS = {"home", "house", "apartment", "flat"}
OFFICE_LOCATION_KEYWORDS = {"office", "work", "downtown", "dxb"}


class ModeDetector:
    """Detect active mode from context signals.

    Detection priorities:
    1. Recent interaction keywords (strongest signal)
    2. Device location info (medium signal)
    3. Time of day (baseline signal)
    """

    # Time ranges (24-hour)
    FLYDUBAI_HOURS = range(9, 18)     # 9 AM - 5 PM
    ALJAMRI_HOURS = range(18, 23)     # 6 PM - 10 PM
    PERSONAL_HOURS = range(23, 24)    # 11 PM - midnight
    # Midnight to 9 AM is also personal
    PERSONAL_EARLY_HOURS = range(0, 9)

    def detect(
        self,
        current_time: time | None = None,
        device_info: dict | None = None,
        recent_interactions: list[str] | None = None,
    ) -> DetectedMode:
        """Detect the active mode from available signals.

        Args:
            current_time: Current time of day (defaults to now).
            device_info: Optional device context (location, etc.).
            recent_interactions: Optional list of recent interaction strings.

        Returns:
            DetectedMode with mode enum and confidence score.
        """
        if current_time is None:
            current_time = datetime.now().time()

        device_info = device_info or {}
        recent_interactions = recent_interactions or []

        # 1. Check interaction keywords (strongest signal)
        keyword_mode = self._detect_from_keywords(recent_interactions)
        if keyword_mode:
            return DetectedMode(
                mode=keyword_mode,
                confidence=0.9,
                reason=f"Matched keywords in recent interactions",
            )

        # 2. Check device location
        location = device_info.get("location", "").lower()
        if location:
            location_mode = self._detect_from_location(location)
            if location_mode:
                return DetectedMode(
                    mode=location_mode,
                    confidence=0.8,
                    reason=f"Device location: {location}",
                )

        # 3. Fall back to time-based detection
        return self._detect_from_time(current_time)

    def _detect_from_keywords(self, interactions: list[str]) -> Mode | None:
        """Detect mode from interaction keywords."""
        flydubai_score = 0
        aljamri_score = 0

        for text in interactions:
            text_lower = text.lower()
            for kw in FLYDUBAI_KEYWORDS:
                if kw in text_lower:
                    flydubai_score += 1
            for kw in ALJAMRI_KEYWORDS:
                if kw in text_lower:
                    aljamri_score += 1

        if flydubai_score > aljamri_score and flydubai_score > 0:
            return Mode.FLYDUBAI
        if aljamri_score > flydubai_score and aljamri_score > 0:
            return Mode.ALJAMRI
        return None

    def _detect_from_location(self, location: str) -> Mode | None:
        """Detect mode from device location string."""
        for kw in HOME_LOCATION_KEYWORDS:
            if kw in location:
                return Mode.PERSONAL
        for kw in OFFICE_LOCATION_KEYWORDS:
            if kw in location:
                return Mode.FLYDUBAI
        return None

    def _detect_from_time(self, current_time: time) -> DetectedMode:
        """Detect mode based on time of day."""
        hour = current_time.hour

        if hour in self.FLYDUBAI_HOURS:
            return DetectedMode(
                mode=Mode.FLYDUBAI,
                confidence=0.7,
                reason=f"Flydubai working hours ({hour}:00)",
            )
        elif hour in self.ALJAMRI_HOURS:
            return DetectedMode(
                mode=Mode.ALJAMRI,
                confidence=0.7,
                reason=f"Aljamri evening hours ({hour}:00)",
            )
        else:
            return DetectedMode(
                mode=Mode.PERSONAL,
                confidence=0.6,
                reason=f"Personal time ({hour}:00)",
            )
