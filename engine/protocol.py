"""Aura protocol version negotiation and capability discovery.

Defines the wire protocol version, HELLO handshake messages,
and capability constants shared between the Python engine and
TypeScript SDK.

Bump PROTOCOL_VERSION whenever the wire format changes in a
backward-incompatible way. Add old versions to SUPPORTED_VERSIONS
to maintain backward compatibility.
"""

from typing import Optional

# Current wire protocol version.
# Bump when message field names, types, or semantics change.
PROTOCOL_VERSION = 1

# All protocol versions this server accepts.
# Older versions can be deprecated and eventually removed.
SUPPORTED_VERSIONS: list[int] = [1]

# Server capabilities advertised to clients.
SERVER_CAPABILITIES: dict = {
    "protocol_version": PROTOCOL_VERSION,
    "supported_versions": SUPPORTED_VERSIONS,
    "render": {
        "arabic": True,
        "max_text_length": 5000,
        "max_font_size": 288,
    },
    "mode_detection": True,
    "bridge": {
        "modes": ["flydubai", "aljamri", "personal"],
        "max_message_bytes": 65536,
    },
}

_REQUIRED_HELLO_FIELDS = {"type", "version", "client", "capabilities"}


def negotiate_version(client_version: int) -> Optional[int]:
    if client_version in SUPPORTED_VERSIONS:
        return client_version
    common = sorted(set(SUPPORTED_VERSIONS) & {client_version}, reverse=True)
    return common[0] if common else None


def is_supported_version(version: int) -> bool:
    return version in SUPPORTED_VERSIONS


def validate_hello(raw: dict) -> Optional[str]:
    if not isinstance(raw, dict):
        return "HELLO must be a JSON object"
    missing = _REQUIRED_HELLO_FIELDS - set(raw.keys())
    if missing:
        return f"HELLO missing required fields: {', '.join(sorted(missing))}"
    if raw.get("type") != "hello":
        return f"HELLO type must be 'hello', got {raw.get('type')!r}"
    if not isinstance(raw.get("version"), int) or raw["version"] < 1:
        return f"Invalid protocol version: {raw.get('version')!r}"
    if not isinstance(raw.get("client"), str) or not raw["client"].strip():
        return "HELLO must include a non-empty 'client' identifier"
    return None


def build_hello_response(client_version: int) -> dict:
    return {
        "type": "hello_ack",
        "version": client_version,
        "server": "aura-engine",
        "capabilities": SERVER_CAPABILITIES,
    }


def build_hello_error(reason: str) -> dict:
    return {
        "type": "hello_error",
        "server": "aura-engine",
        "supported_versions": SUPPORTED_VERSIONS,
        "error": reason,
    }
