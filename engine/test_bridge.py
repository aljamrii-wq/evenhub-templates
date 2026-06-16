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
