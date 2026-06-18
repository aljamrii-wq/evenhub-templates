"""Tests for engine/protocol.py — version negotiation and capability discovery."""

import pytest
from protocol import (
    PROTOCOL_VERSION,
    SUPPORTED_VERSIONS,
    SERVER_CAPABILITIES,
    negotiate_version,
    is_supported_version,
    validate_hello,
    build_hello_response,
    build_hello_error,
)


class TestConstants:
    def test_protocol_version_is_positive(self):
        assert PROTOCOL_VERSION >= 1

    def test_current_version_in_supported(self):
        assert PROTOCOL_VERSION in SUPPORTED_VERSIONS

    def test_server_capabilities_has_required_keys(self):
        assert "protocol_version" in SERVER_CAPABILITIES
        assert "supported_versions" in SERVER_CAPABILITIES
        assert "render" in SERVER_CAPABILITIES
        assert "mode_detection" in SERVER_CAPABILITIES
        assert "bridge" in SERVER_CAPABILITIES


class TestNegotiateVersion:
    def test_exact_match(self):
        assert negotiate_version(1) == 1

    def test_no_match_returns_none(self):
        assert negotiate_version(999) is None

    def test_negative_version_returns_none(self):
        assert negotiate_version(-1) is None


class TestIsSupportedVersion:
    def test_current_is_supported(self):
        assert is_supported_version(PROTOCOL_VERSION) is True

    def test_unknown_is_not_supported(self):
        assert is_supported_version(999) is False


class TestValidateHello:
    def test_valid_hello(self):
        hello = {
            "type": "hello",
            "version": 1,
            "client": "aura-sdk/0.1.0",
            "capabilities": {"render": True},
        }
        assert validate_hello(hello) is None

    def test_missing_type(self):
        hello = {"version": 1, "client": "test", "capabilities": {}}
        err = validate_hello(hello)
        assert err is not None
        assert "missing" in err.lower()

    def test_wrong_type_value(self):
        hello = {"type": "query", "version": 1, "client": "test", "capabilities": {}}
        err = validate_hello(hello)
        assert err is not None
        assert "hello" in err.lower()

    def test_invalid_version_string(self):
        hello = {"type": "hello", "version": "v1", "client": "test", "capabilities": {}}
        err = validate_hello(hello)
        assert err is not None

    def test_missing_client(self):
        hello = {"type": "hello", "version": 1, "capabilities": {}}
        err = validate_hello(hello)
        assert err is not None
        assert "missing" in err.lower() or "client" in err.lower()

    def test_empty_client(self):
        hello = {"type": "hello", "version": 1, "client": "", "capabilities": {}}
        err = validate_hello(hello)
        assert err is not None

    def test_non_dict_rejected(self):
        assert validate_hello("not a dict") is not None
        assert validate_hello(None) is not None
        assert validate_hello([]) is not None


class TestBuildHelloResponse:
    def test_response_structure(self):
        resp = build_hello_response(1)
        assert resp["type"] == "hello_ack"
        assert resp["version"] == 1
        assert resp["server"] == "aura-engine"
        assert "capabilities" in resp
        assert resp["capabilities"]["protocol_version"] == PROTOCOL_VERSION

    def test_different_version(self):
        resp = build_hello_response(1)
        assert resp["version"] == 1


class TestBuildHelloError:
    def test_error_structure(self):
        resp = build_hello_error("Version not supported")
        assert resp["type"] == "hello_error"
        assert resp["server"] == "aura-engine"
        assert "supported_versions" in resp
        assert resp["error"] == "Version not supported"
