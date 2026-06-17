"""Hermes WebSocket Bridge for Aura engine.

Accepts WebSocket connections from Aura SDK clients (smart glasses)
and routes messages to the main Hermes Agent process.
Returns display-ready payloads (text or bitmap).
"""

import asyncio
import json
import logging
import os
import base64
from enum import Enum

from pydantic import BaseModel, Field, ValidationError

from renderer import ArabicBitmapRenderer

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    QUERY = "query"
    ALERT = "alert"
    MODE_SWITCH = "mode_switch"


class ResponseType(str, Enum):
    TEXT = "text"
    BITMAP = "bitmap"
    ERROR = "error"


class Mode(str, Enum):
    FLYDUBAI = "flydubai"
    ALJAMRI = "aljamri"
    PERSONAL = "personal"


class AuraMessage(BaseModel):
    """Incoming message from Aura SDK client."""
    type: MessageType
    payload: str
    mode: Mode = Mode.PERSONAL

    @classmethod
    def from_json(cls, raw: str) -> "AuraMessage":
        try:
            data = json.loads(raw)
            return cls(**data)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ValueError(f"Invalid Aura message: {exc}") from exc


class AuraResponse(BaseModel):
    """Outgoing response to Aura SDK client."""
    type: ResponseType
    payload: str

    def to_json(self) -> str:
        return self.model_dump_json()


class AuraWebSocketBridge:
    """Bridge between Aura WebSocket clients and Hermes Agent.

    Accepts messages from Aura clients (smart glasses), forwards
    queries to the Hermes Agent via subprocess, and returns
    display-ready payloads.

    Args:
        hermes_command: Path to the hermes CLI or a substitute command.
        timeout: Max seconds to wait for Hermes response.
        renderer: Optional ArabicBitmapRenderer for bitmap responses.
    """

    def __init__(
        self,
        hermes_command: str | None = None,
        timeout: int = 30,
        renderer: ArabicBitmapRenderer | None = None,
        max_message_bytes: int = 65536,
    ):
        self.hermes_command = hermes_command or os.environ.get(
            "HERMES_COMMAND", "hermes"
        )
        self.timeout = timeout
        self.renderer = renderer or ArabicBitmapRenderer()
        self.max_message_bytes = max_message_bytes
        self.context: dict = {}

    async def handle_message(self, msg: AuraMessage) -> AuraResponse:
        """Route an incoming Aura message to the appropriate handler."""
        try:
            # Validate payload size
            if len(msg.payload.encode("utf-8")) > self.max_message_bytes:
                return AuraResponse(
                    type=ResponseType.ERROR,
                    payload=f"Payload too large: max {self.max_message_bytes} bytes",
                )

            if msg.type == MessageType.QUERY:
                return await self._handle_query(msg)
            elif msg.type == MessageType.ALERT:
                return await self._handle_alert(msg)
            elif msg.type == MessageType.MODE_SWITCH:
                return await self._handle_mode_switch(msg)
            else:
                return AuraResponse(type=ResponseType.ERROR, payload=f"Unknown message type: {msg.type}")
        except Exception as exc:
            logger.exception("Error handling message type %s", msg.type)
            return AuraResponse(type=ResponseType.ERROR, payload=str(exc))

    async def _handle_query(self, msg: AuraMessage) -> AuraResponse:
        """Forward a query to the Hermes Agent and return the response."""
        prompt = self._build_prompt(msg)
        try:
            response_text = await self._run_hermes(prompt)
            return AuraResponse(type=ResponseType.TEXT, payload=response_text)
        except asyncio.TimeoutError:
            return AuraResponse(type=ResponseType.ERROR, payload="Hermes query timed out")
        except Exception as exc:
            return AuraResponse(type=ResponseType.ERROR, payload=f"Hermes query failed: {exc}")

    async def _handle_alert(self, msg: AuraMessage) -> AuraResponse:
        """Handle an alert/notification message."""
        logger.info("Alert received in mode %s: %s", msg.mode.value, msg.payload[:100])
        return AuraResponse(type=ResponseType.TEXT, payload=f"Alert noted: {msg.payload[:200]}")

    async def _handle_mode_switch(self, msg: AuraMessage) -> AuraResponse:
        """Handle a mode switch request."""
        try:
            switch_data = json.loads(msg.payload)
            raw_mode = switch_data.get("to", msg.mode.value)
        except json.JSONDecodeError:
            raw_mode = msg.payload

        try:
            validated_mode = Mode(raw_mode)
        except ValueError as exc:
            raise ValueError(f"Invalid mode: {raw_mode}") from exc

        mode_value = validated_mode.value
        self.context["last_mode"] = mode_value
        logger.info("Mode switched to: %s", mode_value)
        return AuraResponse(type=ResponseType.TEXT, payload=f"Mode switched to {mode_value}")

    def _build_prompt(self, msg: AuraMessage) -> str:
        """Build a prompt string for Hermes with context."""
        parts = [f"[Aura {msg.mode.value} mode] {msg.payload}"]
        if self.context:
            ctx_str = ", ".join(f"{k}={v}" for k, v in self.context.items())
            parts.insert(0, f"[Context: {ctx_str}]")
        return " ".join(parts)

    async def _run_hermes(self, prompt: str) -> str:
        """Run hermes chat -q and return the response."""
        cmd = [self.hermes_command, "chat", "-q", prompt]
        env = os.environ.copy()
        env.pop("HERMES_PROFILE", None)  # use default profile

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=self.timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise

        if proc.returncode != 0:
            err = stderr.decode("utf-8", errors="replace").strip()
            logger.error("Hermes exited with code %d: %s", proc.returncode, err)
            raise RuntimeError(f"Hermes query failed (exit code {proc.returncode})")

        return stdout.decode("utf-8", errors="replace").strip()

    async def handle_websocket(self, websocket) -> None:
        """Handle a single WebSocket connection lifecycle.

        Args:
            websocket: A websockets.WebSocketServerProtocol instance.
        """
        try:
            async for raw_message in websocket:
                try:
                    msg = AuraMessage.from_json(raw_message)
                    response = await self.handle_message(msg)
                    await websocket.send(response.to_json())
                except ValueError as exc:
                    err = AuraResponse(type=ResponseType.ERROR, payload=str(exc))
                    await websocket.send(err.to_json())
        except Exception as exc:
            logger.exception("WebSocket connection error")
