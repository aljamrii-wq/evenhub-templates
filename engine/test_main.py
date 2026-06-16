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


class TestModeEndpoint:
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
