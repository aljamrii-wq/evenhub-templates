"""Aura Engine — FastAPI server entry point.

Endpoints:
- GET  /health      — Health check with component status
- POST /render      — Render text to 4-bit grayscale bitmap (base64)
- POST /mode        — Detect user mode from context
- WS   /ws/aura     — WebSocket bridge for Aura SDK clients

Run:
    python main.py
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

import base64
import logging
import os
import re
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from renderer import ArabicBitmapRenderer, RenderError
from hermes_bridge import (
    AuraMessage, AuraResponse, AuraWebSocketBridge,
    MessageType, ResponseType,
)
from mode_detector import ModeDetector
from session_store import SessionStore

logger = logging.getLogger(__name__)

# Maximum WebSocket message payload size (64KB default)
MAX_WS_MESSAGE_BYTES = int(os.environ.get('AURA_MAX_WS_MESSAGE_BYTES', '65536'))
# Shared secret for WebSocket auth (query param: ?token=...)
# When set, clients must provide matching token. When empty, only localhost allowed.
AURA_AUTH_TOKEN = os.environ.get('AURA_AUTH_TOKEN', '')

# --- Lifespan ---

renderer = ArabicBitmapRenderer()
mode_detector = ModeDetector()
store = SessionStore()
bridge = AuraWebSocketBridge(renderer=renderer, max_message_bytes=MAX_WS_MESSAGE_BYTES)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("Aura Engine starting up")
    yield
    logger.info("Aura Engine shutting down")
    store.close()


app = FastAPI(
    title="Aura Engine",
    description="Backend engine for Aura smart glasses — Arabic rendering, mode detection, Hermes bridge",
    version="0.1.0",
    lifespan=lifespan,
)


# --- Request/Response Models ---

# Maximum text length for /render — prevents PIL decompression bomb
_MAX_RENDER_CHARS = int(os.environ.get("AURA_MAX_RENDER_CHARS", "5000"))

class RenderRequest(BaseModel):
    text: str = Field(..., min_length=0, max_length=_MAX_RENDER_CHARS)
    font_size: int = Field(default=28, ge=1, le=288)


class ModeRequest(BaseModel):
    device_info: dict = Field(default_factory=dict)
    recent_interactions: list[str] = Field(default_factory=list)


class RenderResponse(BaseModel):
    type: str = "bitmap"
    payload: str  # base64-encoded bytes


class ModeResponse(BaseModel):
    mode: str
    confidence: float
    reason: str


class HealthResponse(BaseModel):
    status: str
    version: str
    renderer: str
    mode_detector: str


# --- Endpoints ---

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check with component status."""
    return HealthResponse(
        status="ok",
        version=app.version,
        renderer="available",
        mode_detector="available",
    )


@app.post("/render", response_model=RenderResponse)
async def render_text(req: RenderRequest):
    """Render text to a 4-bit grayscale bitmap for Even G2 display.

    Returns a base64-encoded packed 4-bit grayscale bitmap
    (576x288 pixels, 2 pixels per byte).
    """
    # Use a renderer with the requested font_size for this call
    try:
        if req.font_size != renderer.font_size:
            sized_renderer = ArabicBitmapRenderer(
                width=renderer.width,
                height=renderer.height,
                font_size=req.font_size,
            )
            bitmap_bytes = sized_renderer.render(req.text)
        else:
            bitmap_bytes = renderer.render(req.text)
    except RenderError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    encoded = base64.b64encode(bitmap_bytes).decode("ascii")
    return RenderResponse(payload=encoded)


@app.post("/mode", response_model=ModeResponse)
async def detect_mode(req: ModeRequest):
    """Detect the user's current mode from context signals."""
    from datetime import datetime
    result = mode_detector.detect(
        current_time=datetime.now().time(),
        device_info=req.device_info,
        recent_interactions=req.recent_interactions,
    )
    return ModeResponse(
        mode=result.mode.value,
        confidence=result.confidence,
        reason=result.reason,
    )


def _validate_ws_origin(websocket: WebSocket) -> None:
    """Validate the WebSocket connection is authorized.

    If AURA_AUTH_TOKEN is set, requires ?token=<token> query parameter.
    Otherwise, only allows connections from localhost/127.0.0.1.
    """
    if AURA_AUTH_TOKEN:
        token = websocket.query_params.get("token", "")
        if token != AURA_AUTH_TOKEN:
            raise HTTPException(status_code=403, detail="Invalid or missing auth token")
    else:
        # Localhost-only when no auth token configured
        host = websocket.client.host if websocket.client else ""
        if host not in ("127.0.0.1", "::1", "localhost"):
            raise HTTPException(status_code=403, detail="Remote connections require AURA_AUTH_TOKEN")


@app.websocket("/ws/aura")
async def aura_websocket(websocket: WebSocket):
    """WebSocket endpoint for Aura SDK clients.

    Auth: provide ?token=<AURA_AUTH_TOKEN> if AURA_AUTH_TOKEN is set.
          Otherwise only localhost connections are allowed.

    Accepts JSON AuraMessage frames and returns AuraResponse frames.
    Message format:
        {"type": "query"|"alert"|"mode_switch", "payload": "...", "mode": "personal"}
    """
    # Validate auth/origin before accepting
    try:
        _validate_ws_origin(websocket)
    except HTTPException:
        await websocket.close(code=4003, reason="Forbidden")
        return

    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw.encode("utf-8")) > MAX_WS_MESSAGE_BYTES:
                err = AuraResponse(
                    type=ResponseType.ERROR,
                    payload=f"Message too large: max {MAX_WS_MESSAGE_BYTES} bytes",
                )
                await websocket.send_text(err.to_json())
                continue

            try:
                msg = AuraMessage.from_json(raw)
                response = await bridge.handle_message(msg)
                await websocket.send_text(response.to_json())
            except ValueError as exc:
                err = AuraResponse(type=ResponseType.ERROR, payload=str(exc))
                await websocket.send_text(err.to_json())
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:
        logger.exception("WebSocket error")
        try:
            await websocket.close()
        except Exception:
            pass


# --- Main ---

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("AURA_HOST", "127.0.0.1")
    port = int(os.environ.get("AURA_PORT", "8000"))
    log_level = os.environ.get("AURA_LOG_LEVEL", "info")
    logging.basicConfig(level=log_level.upper())
    uvicorn.run("main:app", host=host, port=port, log_level=log_level)
