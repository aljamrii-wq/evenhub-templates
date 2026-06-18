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
    """Test /render POST endpoint — returns PNG image bytes."""

    def test_render_text_returns_png(self, client):
        response = client.post("/render", json={"text": "Hello"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content[:4] == b"\x89PNG"

    def test_render_arabic_text(self, client):
        response = client.post("/render", json={"text": "\u0645\u0631\u062d\u0628\u0627"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content[:4] == b"\x89PNG"

    def test_render_empty_text(self, client):
        response = client.post("/render", json={"text": ""})
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content[:4] == b"\x89PNG"

    def test_render_missing_text_field(self, client):
        response = client.post("/render", json={})
        assert response.status_code == 422

    def test_render_invalid_json(self, client):
        response = client.post("/render", content="not json")
        assert response.status_code == 422

    def test_render_with_font_size(self, client):
        response = client.post("/render", json={"text": "Test", "font_size": 18})
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content[:4] == b"\x89PNG"

    def test_render_error_returns_400(self, client, monkeypatch):
        """When the renderer raises RenderError, the endpoint returns 400."""
        from unittest.mock import MagicMock
        from renderer import RenderError

        mock_renderer = MagicMock()
        mock_renderer.render_png.side_effect = RenderError("simulated render failure")
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
        assert response.headers["content-type"] == "image/png"

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


class TestSanitizeModeInputs:
    """Test _sanitize_mode_inputs — input bounding and truncation."""

    def test_device_info_truncation_excess_keys(self):
        """Keys beyond MAX_DEVICE_INFO_KEYS (10) are dropped."""
        from main import _sanitize_mode_inputs
        device_info = {f'key_{i}': f'val_{i}' for i in range(20)}
        safe_device_info, _ = _sanitize_mode_inputs(device_info, [])
        assert len(safe_device_info) == 10

    def test_device_info_value_truncation(self):
        """Values longer than MAX_DEVICE_INFO_VALUE_CHARS (500) are truncated."""
        from main import _sanitize_mode_inputs
        device_info = {'long_key': 'A' * 600}
        safe_device_info, _ = _sanitize_mode_inputs(device_info, [])
        assert len(safe_device_info['long_key']) == 500

    def test_interactions_truncation_excess_items(self):
        """Interactions beyond MAX_INTERACTIONS (50) are dropped."""
        from main import _sanitize_mode_inputs
        interactions = [f'interaction_{i}' for i in range(100)]
        _, safe_interactions = _sanitize_mode_inputs({}, interactions)
        assert len(safe_interactions) == 50

    def test_interaction_value_truncation(self):
        """Interaction strings longer than MAX_INTERACTION_CHARS (1000) are truncated."""
        from main import _sanitize_mode_inputs
        interactions = ['A' * 1500]
        _, safe_interactions = _sanitize_mode_inputs({}, interactions)
        assert len(safe_interactions[0]) == 1000

    def test_handles_non_string_values(self):
        """Non-string device_info values are coerced to strings."""
        from main import _sanitize_mode_inputs
        device_info = {'num': 42, 'bool': True, 'none': None}
        safe_device_info, _ = _sanitize_mode_inputs(device_info, [])
        assert safe_device_info['num'] == '42'
        assert safe_device_info['bool'] == 'True'
        assert safe_device_info['none'] == 'None'


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
    """Test WebSocket auth/origin gating — fail-closed, header-based."""

    def test_ws_valid_bearer_token_allows_connection(self):
        """Valid Authorization: Bearer *** allows connection."""
        import main
        from main import _validate_ws_origin
        from unittest.mock import MagicMock
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.headers = {"authorization": "Bearer secret123", "x-aura-token": ""}
            # Should not raise
            _validate_ws_origin(ws)
        finally:
            main.AURA_AUTH_TOKEN = original_token

    def test_ws_valid_x_aura_token_allows_connection(self):
        """Valid X-Aura-Token custom header allows connection."""
        import main
        from main import _validate_ws_origin
        from unittest.mock import MagicMock
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.headers = {"authorization": "", "x-aura-token": "secret123"}
            # Should not raise
            _validate_ws_origin(ws)
        finally:
            main.AURA_AUTH_TOKEN = original_token

    def test_ws_blocked_when_token_not_configured(self):
        """Fail-closed: 503 when AURA_AUTH_TOKEN is empty."""
        import main
        from main import _validate_ws_origin
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        import pytest
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = ""
            ws = MagicMock()
            ws.headers = {"authorization": "", "x-aura-token": ""}
            with pytest.raises(HTTPException) as exc:
                _validate_ws_origin(ws)
            assert exc.value.status_code == 503
            assert "not configured" in exc.value.detail
        finally:
            main.AURA_AUTH_TOKEN = original_token

    def test_ws_wrong_token_rejected(self):
        """Wrong token returns 403."""
        import main
        from main import _validate_ws_origin
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        import pytest
        original_token = main.AURA_AUTH_TOKEN
        try:
            main.AURA_AUTH_TOKEN = "secret123"
            ws = MagicMock()
            ws.headers = {"authorization": "Bearer wrongtoken", "x-aura-token": ""}
            with pytest.raises(HTTPException) as exc:
                _validate_ws_origin(ws)
            assert exc.value.status_code == 403
            assert "Invalid" in exc.value.detail
        finally:
            main.AURA_AUTH_TOKEN = original_token


@pytest.fixture
def authed_client():
    """A TestClient with WS auth configured, plus a Bearer header helper."""
    import main
    original_token = main.AURA_AUTH_TOKEN
    main.AURA_AUTH_TOKEN = "test-secret"
    try:
        yield TestClient(app), {"authorization": "Bearer test-secret"}
    finally:
        main.AURA_AUTH_TOKEN = original_token


class TestWebSocketLifecycle:
    """End-to-end WebSocket connection lifecycle over the FastAPI endpoint.

    Covers the handshake, error recovery without dropping the socket, oversized
    frames, clean disconnect, and reconnect (a fresh connection after close).
    """

    def test_hello_handshake_returns_ack(self, authed_client):
        client, headers = authed_client
        with client.websocket_connect("/ws/aura", headers=headers) as ws:
            ws.send_json({"type": "hello", "version": 1, "client": "aura-sdk", "capabilities": {}})
            ack = ws.receive_json()
            assert ack["type"] == "hello_ack"
            assert ack["version"] == 1
            assert ack["server"] == "aura-engine"

    def test_hello_version_mismatch_returns_error(self, authed_client):
        client, headers = authed_client
        with client.websocket_connect("/ws/aura", headers=headers) as ws:
            ws.send_json({"type": "hello", "version": 99, "client": "aura-sdk"})
            resp = ws.receive_json()
            assert resp["type"] == "hello_error"
            assert 1 in resp["supported_versions"]

    def test_invalid_frame_returns_error_and_keeps_socket_open(self, authed_client):
        client, headers = authed_client
        with client.websocket_connect("/ws/aura", headers=headers) as ws:
            ws.send_text("not valid json")
            err = ws.receive_json()
            assert err["type"] == "error"
            # Socket stays open: a subsequent valid HELLO still works.
            ws.send_json({"type": "hello", "version": 1})
            ack = ws.receive_json()
            assert ack["type"] == "hello_ack"

    def test_oversized_frame_rejected(self, authed_client, monkeypatch):
        import main
        monkeypatch.setattr(main, "MAX_WS_MESSAGE_BYTES", 16)
        client, headers = authed_client
        with client.websocket_connect("/ws/aura", headers=headers) as ws:
            ws.send_json({"type": "query", "payload": "x" * 100, "mode": "personal"})
            err = ws.receive_json()
            assert err["type"] == "error"
            assert "too large" in err["payload"].lower()

    def test_query_round_trip(self, authed_client, monkeypatch):
        """A query is routed through the bridge and a TEXT response returns."""
        import main
        monkeypatch.setattr(main.bridge, "hermes_command", "echo")
        client, headers = authed_client
        with client.websocket_connect("/ws/aura", headers=headers) as ws:
            ws.send_json({"type": "query", "payload": "ping", "mode": "personal"})
            resp = ws.receive_json()
            assert resp["type"] == "text"
            assert "ping" in resp["payload"]

    def test_clean_disconnect_then_reconnect(self, authed_client):
        """Closing the socket is handled cleanly and a new connection works."""
        client, headers = authed_client
        # First connection — disconnect cleanly via context manager exit.
        with client.websocket_connect("/ws/aura", headers=headers) as ws:
            ws.send_json({"type": "hello", "version": 1})
            assert ws.receive_json()["type"] == "hello_ack"
        # Reconnect — server accepts a fresh connection without lingering state.
        with client.websocket_connect("/ws/aura", headers=headers) as ws:
            ws.send_json({"type": "hello", "version": 1})
            assert ws.receive_json()["type"] == "hello_ack"

    def test_unauthorized_connection_closed(self):
        """Without a valid token the connection is refused (closed)."""
        import main
        from starlette.websockets import WebSocketDisconnect
        original = main.AURA_AUTH_TOKEN
        main.AURA_AUTH_TOKEN = "the-secret"
        try:
            client = TestClient(app)
            with pytest.raises(WebSocketDisconnect):
                with client.websocket_connect(
                    "/ws/aura", headers={"authorization": "Bearer wrong"}
                ) as ws:
                    ws.receive_json()
        finally:
            main.AURA_AUTH_TOKEN = original
