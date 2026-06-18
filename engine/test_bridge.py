"""Tests for engine/hermes_bridge.py — Hermes WebSocket Bridge."""

import asyncio
import json
import pytest
from hermes_bridge import (
    AuraMessage, AuraResponse, MessageType, ResponseType,
    Mode, AuraWebSocketBridge,
)


class TestMessageTypes:
    """Test message protocol definitions."""

    def test_message_type_enum(self):
        assert MessageType.QUERY == "query"
        assert MessageType.ALERT == "alert"
        assert MessageType.MODE_SWITCH == "mode_switch"

    def test_response_type_enum(self):
        assert ResponseType.TEXT == "text"
        assert ResponseType.BITMAP == "bitmap"
        assert ResponseType.ERROR == "error"

    def test_mode_enum(self):
        assert Mode.FLYDUBAI == "flydubai"
        assert Mode.ALJAMRI == "aljamri"
        assert Mode.PERSONAL == "personal"


class TestAuraMessage:
    """Test message model."""

    def test_valid_query_message(self):
        msg = AuraMessage(type=MessageType.QUERY, payload="What time is it?", mode=Mode.PERSONAL)
        assert msg.type == MessageType.QUERY
        assert msg.payload == "What time is it?"

    def test_valid_alert_message(self):
        msg = AuraMessage(type=MessageType.ALERT, payload="Flight EK123 delayed", mode=Mode.FLYDUBAI)
        assert msg.type == MessageType.ALERT

    def test_valid_mode_switch_message(self):
        msg = AuraMessage(type=MessageType.MODE_SWITCH, payload=json.dumps({"to": "aljamri"}), mode=Mode.FLYDUBAI)
        assert msg.type == MessageType.MODE_SWITCH

    def test_invalid_message_type_rejected(self):
        with pytest.raises(ValueError):
            AuraMessage(type="invalid", payload="test", mode=Mode.PERSONAL)

    def test_from_json(self):
        data = {"type": "query", "payload": "Hello", "mode": "personal"}
        msg = AuraMessage.from_json(json.dumps(data))
        assert msg.type == MessageType.QUERY
        assert msg.payload == "Hello"
        assert msg.mode == Mode.PERSONAL

    def test_from_json_invalid(self):
        with pytest.raises((ValueError, TypeError)):
            AuraMessage.from_json("not json")


class TestAuraResponse:
    """Test response model."""

    def test_text_response(self):
        resp = AuraResponse(type=ResponseType.TEXT, payload="Hello World")
        data = resp.to_json()
        parsed = json.loads(data)
        assert parsed["type"] == "text"
        assert parsed["payload"] == "Hello World"

    def test_bitmap_response(self):
        resp = AuraResponse(type=ResponseType.BITMAP, payload="base64encoded...")
        data = resp.to_json()
        assert json.loads(data)["type"] == "bitmap"

    def test_error_response(self):
        resp = AuraResponse(type=ResponseType.ERROR, payload="Something went wrong")
        data = resp.to_json()
        assert json.loads(data)["type"] == "error"

    @staticmethod
    def error(msg: str):
        return AuraResponse(type=ResponseType.ERROR, payload=msg)

    def test_error_factory(self):
        resp = self.error("test error")
        assert resp.type == ResponseType.ERROR
        assert resp.payload == "test error"


class TestAuraWebSocketBridge:
    """Test the bridge handler (no actual server)."""

    def test_bridge_creation(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        assert bridge.hermes_command == "echo"

    @pytest.mark.asyncio
    async def test_handle_query(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        msg = AuraMessage(type=MessageType.QUERY, payload="ping", mode=Mode.PERSONAL)
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.TEXT
        assert "ping" in resp.payload

    @pytest.mark.asyncio
    async def test_handle_alert(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        msg = AuraMessage(type=MessageType.ALERT, payload="Test alert", mode=Mode.FLYDUBAI)
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.TEXT

    @pytest.mark.asyncio
    async def test_handle_mode_switch(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        msg = AuraMessage(type=MessageType.MODE_SWITCH, payload='{"to": "aljamri"}', mode=Mode.PERSONAL)
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.TEXT
        assert "aljamri" in resp.payload

    @pytest.mark.asyncio
    async def test_handle_mode_switch_rejects_invalid_mode(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        msg = AuraMessage(type=MessageType.MODE_SWITCH, payload='{"to": "not-a-mode"}', mode=Mode.PERSONAL)
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.ERROR
        assert "invalid mode" in resp.payload.lower()

    @pytest.mark.asyncio
    async def test_handle_unknown_type(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        msg = AuraMessage(type=MessageType.QUERY, payload="test", mode=Mode.PERSONAL)
        msg.type = "unknown_type"
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.ERROR

    @pytest.mark.asyncio
    async def test_hermes_command_timeout(self):
        bridge = AuraWebSocketBridge(hermes_command="sleep", timeout=1)
        msg = AuraMessage(type=MessageType.QUERY, payload="test", mode=Mode.PERSONAL)
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.ERROR

    @pytest.mark.asyncio
    async def test_context_passed_to_hermes(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        bridge.context = {"last_mode": "flydubai"}
        msg = AuraMessage(type=MessageType.QUERY, payload="status", mode=Mode.FLYDUBAI)
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.TEXT

    @pytest.mark.asyncio
    async def test_payload_size_limit(self):
        """Payloads exceeding max_message_bytes should be rejected."""
        bridge = AuraWebSocketBridge(hermes_command="echo", max_message_bytes=10)
        msg = AuraMessage(type=MessageType.QUERY, payload="x" * 20, mode=Mode.PERSONAL)
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.ERROR
        assert "too large" in resp.payload.lower()

    @pytest.mark.asyncio
    async def test_payload_within_limit_accepted(self):
        """Payloads within max_message_bytes should be accepted."""
        bridge = AuraWebSocketBridge(hermes_command="echo", max_message_bytes=1024)
        msg = AuraMessage(type=MessageType.QUERY, payload="small payload", mode=Mode.PERSONAL)
        resp = await bridge.handle_message(msg)
        assert resp.type == ResponseType.TEXT


class TestHelloHandshake:
    """Protocol HELLO handshake (version negotiation)."""

    def test_hello_returns_ack(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        ack = bridge.try_build_hello_ack(json.dumps({"type": "hello", "version": 1}))
        assert ack is not None
        parsed = json.loads(ack)
        assert parsed["type"] == "hello_ack"
        assert parsed["version"] == 1
        assert parsed["capabilities"]["render"] is True

    def test_hello_without_version_defaults_to_current(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        ack = bridge.try_build_hello_ack(json.dumps({"type": "hello"}))
        assert json.loads(ack)["type"] == "hello_ack"

    def test_hello_version_mismatch_returns_error(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        ack = bridge.try_build_hello_ack(json.dumps({"type": "hello", "version": 42}))
        parsed = json.loads(ack)
        assert parsed["type"] == "hello_error"
        assert parsed["supported_versions"] == [1]

    def test_non_hello_frame_returns_none(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        assert bridge.try_build_hello_ack(json.dumps({"type": "query", "payload": "x"})) is None

    def test_malformed_frame_returns_none(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        assert bridge.try_build_hello_ack("not json") is None
        assert bridge.try_build_hello_ack(json.dumps(["not", "a", "dict"])) is None


class _FakeWebSocket:
    """Minimal async-iterable websocket double for handle_websocket tests."""

    def __init__(self, incoming, raise_after=False):
        self._incoming = list(incoming)
        self._raise_after = raise_after
        self.sent: list[str] = []

    def __aiter__(self):
        return self._gen()

    async def _gen(self):
        for item in self._incoming:
            yield item
        if self._raise_after:
            raise ConnectionResetError("client vanished")

    async def send(self, data: str) -> None:
        self.sent.append(data)


class TestHandleWebSocketLifecycle:
    """The standalone handle_websocket connection loop."""

    @pytest.mark.asyncio
    async def test_processes_messages_then_clean_disconnect(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        ws = _FakeWebSocket([
            json.dumps({"type": "hello", "version": 1}),
            json.dumps({"type": "alert", "payload": "hi", "mode": "personal"}),
        ])
        await bridge.handle_websocket(ws)
        assert json.loads(ws.sent[0])["type"] == "hello_ack"
        assert json.loads(ws.sent[1])["type"] == "text"

    @pytest.mark.asyncio
    async def test_invalid_message_sends_error_and_continues(self):
        bridge = AuraWebSocketBridge(hermes_command="echo")
        ws = _FakeWebSocket(["garbage", json.dumps({"type": "hello", "version": 1})])
        await bridge.handle_websocket(ws)
        assert json.loads(ws.sent[0])["type"] == "error"
        assert json.loads(ws.sent[1])["type"] == "hello_ack"

    @pytest.mark.asyncio
    async def test_abrupt_disconnect_is_swallowed(self):
        """A mid-stream connection drop must not propagate out of the handler."""
        bridge = AuraWebSocketBridge(hermes_command="echo")
        ws = _FakeWebSocket([json.dumps({"type": "hello", "version": 1})], raise_after=True)
        # Should not raise despite the ConnectionResetError mid-stream.
        await bridge.handle_websocket(ws)
        assert json.loads(ws.sent[0])["type"] == "hello_ack"
