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

    def test_render_error_returns_400(self, client, monkeypatch):
        """When the renderer raises RenderError, the endpoint returns 400."""
        from unittest.mock import MagicMock
        from renderer import RenderError

        mock_renderer = MagicMock()
        mock_renderer.render.side_effect = RenderError("simulated render failure")
        mock_renderer.font_size = 28
        monkeypatch.setattr("main.renderer", mock_renderer)

        response = client.post("/render", json={"text": "trigger error"})
        assert response.status_code == 400
        assert "simulated render failure" in response.json()["detail"]


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
        # WebSocket routes do not appear in OpenAPI schema (expected)

    def test_docs_accessible(self, client):
        response = client.get("/docs")
        assert response.status_code == 200


class TestWebSocketAuth:
    """Test WebSocket auth/origin gating."""

    def test_ws_localhost_allowed(self):
        """WebSocket from localhost should be allowed without token."""
        # TestClient runs on localhost by default
        from main import _validate_ws_origin
        from unittest.mock import MagicMock
        ws = MagicMock()
        ws.query_params = MagicMock()
        ws.query_params.get.return_value = ""
        ws.client = MagicMock()
        ws.client.host = "127.0.0.1"
        # Should not raise
        _validate_ws_origin(ws)

    def test_ws_remote_blocked_without_token(self):
        """WebSocket from remote IP should be blocked without auth token."""
        from main import _validate_ws_origin
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        import pytest
        ws = MagicMock()
        ws.query_params = MagicMock()
        ws.query_params.get.return_value = ""
        ws.client = MagicMock()
        ws.client.host = "10.0.0.5"
        with pytest.raises(HTTPException) as exc:
            _validate_ws_origin(ws)
        assert exc.value.status_code == 403

    def test_ws_token_bypasses_origin_check(self):
        """Valid token should allow remote connections."""
        import main
        import os
        from unittest.mock import MagicMock
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.query_params = MagicMock()
            ws.query_params.get.return_value = "secret123"
            ws.client = MagicMock()
            ws.client.host = "10.0.0.5"
            # Should not raise
            main._validate_ws_origin(ws)
        finally:
            main.AURA_AUTH_TOKEN = original_token

    def test_ws_wrong_token_rejected(self):
        """Wrong token should be rejected."""
        import main
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        import pytest
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.query_params = MagicMock()
            ws.query_params.get.return_value = "wrong"
            ws.client = MagicMock()
            ws.client.host = "127.0.0.1"
            with pytest.raises(HTTPException) as exc:
                main._validate_ws_origin(ws)
            assert exc.value.status_code == 403
        finally:
            main.AURA_AUTH_TOKEN = original_token
