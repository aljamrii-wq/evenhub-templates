"""Tests for engine/main.py — FastAPI server entry point."""

import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestHealthEndpoint:
    """Test /health endpoint."""

    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_json(self, client):
        response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert data["status"] == "ok"

    def test_health_includes_version(self, client):
        response = client.get("/health")
        data = response.json()
        assert "version" in data
        assert "protocol_version" in data
        assert data["protocol_version"] >= 1

    def test_health_includes_components(self, client):
        response = client.get("/health")
        data = response.json()
        assert "renderer" in data
        assert "mode_detector" in data


class TestRenderEndpoint:
    """Test /render POST endpoint."""

    def test_render_text_returns_bitmap(self, client):
        response = client.post("/render", json={"text": "Hello"})
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "bitmap"
        assert "payload" in data
        # Payload should be base64-encoded bytes
        assert len(data["payload"]) > 0

    def test_render_arabic_text(self, client):
        response = client.post("/render", json={"text": "\u0645\u0631\u062d\u0628\u0627"})
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "bitmap"

    def test_render_empty_text(self, client):
        response = client.post("/render", json={"text": ""})
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "bitmap"

    def test_render_missing_text_field(self, client):
        response = client.post("/render", json={})
        assert response.status_code == 422

    def test_render_invalid_json(self, client):
        response = client.post("/render", content="not json")
        assert response.status_code == 422

    def test_render_with_font_size(self, client):
        response = client.post("/render", json={"text": "Test", "font_size": 18})
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "bitmap"


class TestModeEndpoint:
    def test_render_oversized_text_rejected(self, client):
        """Oversized text should be rejected (422) before hitting PIL."""
        big_text = "A" * 5001  # exceeds default _MAX_RENDER_CHARS of 5000
        response = client.post("/render", json={"text": big_text})
        assert response.status_code == 422

    def test_render_max_boundary_ok(self, client):
        """Text at exactly the max length should work."""
        text = "A" * 5000
        response = client.post("/render", json={"text": text})
        assert response.status_code == 200

    """Test /mode endpoint."""

    def test_mode_detect_defaults(self, client):
        response = client.post("/mode", json={})
        assert response.status_code == 200
        data = response.json()
        assert "mode" in data
        assert "confidence" in data
        assert data["mode"] in ("flydubai", "aljamri", "personal")

    def test_mode_detect_with_interactions(self, client):
        response = client.post(
            "/mode",
            json={"recent_interactions": ["check flight EK123", "booking status"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "flydubai"
        assert data["confidence"] >= 0.8



class TestCapsEndpoint:
    """Test /caps endpoint."""

    def test_caps_returns_200(self, client):
        response = client.get("/caps")
        assert response.status_code == 200

    def test_caps_returns_json(self, client):
        response = client.get("/caps")
        data = response.json()
        assert data["server"] == "aura-engine"
        assert "protocol_version" in data
        assert data["protocol_version"] >= 1

    def test_caps_includes_supported_versions(self, client):
        response = client.get("/caps")
        data = response.json()
        assert "supported_versions" in data
        assert isinstance(data["supported_versions"], list)
        assert data["protocol_version"] in data["supported_versions"]

    def test_caps_includes_capabilities(self, client):
        response = client.get("/caps")
        data = response.json()
        assert "capabilities" in data
        caps = data["capabilities"]
        assert "render" in caps
        assert "mode_detection" in caps
        assert "bridge" in caps


class TestServerInfo:
    """Test server metadata."""

    def test_app_title(self):
        assert app.title == "Aura Engine"

    def test_openapi_schema(self, client):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "/render" in schema["paths"]
        assert "/mode" in schema["paths"]
        assert "/health" in schema["paths"]
        assert "/caps" in schema["paths"]
        # WebSocket routes do not appear in OpenAPI schema (expected)

    def test_docs_accessible(self, client):
        response = client.get("/docs")
        assert response.status_code == 200


class TestWebSocketAuth:
    """Test WebSocket auth/origin gating."""

    def test_ws_rejected_when_no_token_configured(self):
        """Fail-closed: when AURA_AUTH_TOKEN is empty, ALL connections rejected."""
        # Even localhost should be rejected when no token is set
        from main import _validate_ws_origin
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        import main
        import pytest
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = ""
            ws = MagicMock()
            ws.headers = MagicMock()
            ws.headers.get.return_value = ""
            with pytest.raises(HTTPException) as exc:
                _validate_ws_origin(ws)
            assert exc.value.status_code == 503
        finally:
            main.AURA_AUTH_TOKEN = original_token

    def test_ws_blocked_when_no_auth_header(self):
        """When AURA_AUTH_TOKEN is set but no auth header provided, blocked."""
        from main import _validate_ws_origin
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        import main
        import pytest
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.headers = MagicMock()
            ws.headers.get.return_value = ""  # no auth header
            with pytest.raises(HTTPException) as exc:
                _validate_ws_origin(ws)
            assert exc.value.status_code == 403
        finally:
            main.AURA_AUTH_TOKEN = original_token

    def test_ws_auth_bearer_header_allowed(self):
        """Valid Bearer token in Authorization header should allow connection."""
        import main
        from unittest.mock import MagicMock
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.headers = MagicMock()
            ws.headers.get.side_effect = lambda key, default="": (
                "Bearer secret123" if key == "authorization" else default
            )
            # Should not raise
            main._validate_ws_origin(ws)
        finally:
            main.AURA_AUTH_TOKEN = original_token

    def test_ws_auth_x_aura_token_header_allowed(self):
        """Valid token in X-Aura-Token custom header should allow connection."""
        import main
        from unittest.mock import MagicMock
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.headers = MagicMock()
            ws.headers.get.side_effect = lambda key, default="": (
                "secret123" if key == "x-aura-token" else default
            )
            # Should not raise
            main._validate_ws_origin(ws)
        finally:
            main.AURA_AUTH_TOKEN = original_token

    def test_ws_wrong_token_rejected(self):
        """Wrong token should be rejected (header auth)."""
        import main
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        import pytest
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.headers = MagicMock()
            ws.headers.get.side_effect = lambda key, default="": (
                "Bearer wrong" if key == "authorization" else default
            )
            with pytest.raises(HTTPException) as exc:
                main._validate_ws_origin(ws)
            assert exc.value.status_code == 403
        finally:
            main.AURA_AUTH_TOKEN = original_token
