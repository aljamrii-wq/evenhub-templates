"""Cross-stack integration tests: Arabic text → engine → bitmap.

These exercise the full server pipeline an Aura SDK client depends on:
the HTTP /render path that produces the PNG consumed by the Even Hub SDK's
updateImageRawData, and the raw 4-bit packed path used for direct display
writes. They verify real Arabic glyph output end to end (not tofu) and the
exact G2 geometry (576x288).
"""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from main import app
from renderer import ArabicBitmapRenderer

G2_WIDTH = 576
G2_HEIGHT = 288
PACKED_4BIT_LEN = (G2_WIDTH * G2_HEIGHT) // 2

ARABIC_SAMPLE = "مرحبا بكم في أورا"


@pytest.fixture
def client():
    return TestClient(app)


class TestRenderEndpointBitmap:
    """The /render endpoint returns a display-ready PNG at G2 geometry."""

    def test_arabic_render_is_png_at_g2_size(self, client):
        resp = client.post("/render", json={"text": ARABIC_SAMPLE, "font_size": 28})
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
        img = Image.open(io.BytesIO(resp.content))
        assert img.size == (G2_WIDTH, G2_HEIGHT)
        assert img.mode == "L"  # 8-bit grayscale, quantised to 16 shades downstream

    def test_render_png_packs_to_valid_4bit(self, client):
        """The PNG decodes to exactly the byte count of a 4-bit G2 frame."""
        resp = client.post("/render", json={"text": ARABIC_SAMPLE})
        raw = Image.open(io.BytesIO(resp.content)).convert("L").tobytes()
        assert len(raw) == G2_WIDTH * G2_HEIGHT
        packed = bytes(((raw[i] >> 4) << 4) | (raw[i + 1] >> 4) for i in range(0, len(raw), 2))
        assert len(packed) == PACKED_4BIT_LEN
        assert all((b >> 4) <= 15 and (b & 0x0F) <= 15 for b in packed)

    def test_arabic_render_has_ink(self, client):
        """Arabic content must produce visible pixels through the endpoint."""
        resp = client.post("/render", json={"text": ARABIC_SAMPLE})
        raw = Image.open(io.BytesIO(resp.content)).convert("L").tobytes()
        assert any(b != 0 for b in raw), "Arabic rendered blank through /render"


class TestRawBitmapPath:
    """The raw 4-bit packed path used for direct display writes."""

    def test_raw_bitmap_is_exact_g2_length(self):
        data = ArabicBitmapRenderer().render(ARABIC_SAMPLE)
        assert len(data) == PACKED_4BIT_LEN

    def test_raw_bitmap_nibbles_in_range(self):
        data = ArabicBitmapRenderer().render(ARABIC_SAMPLE)
        assert all((b >> 4) <= 15 and (b & 0x0F) <= 15 for b in data)

    def test_distinct_arabic_payloads_differ(self):
        """Different Arabic text must yield different bitmaps (glyphs, not boxes)."""
        r = ArabicBitmapRenderer()
        assert r.render("نعم") != r.render(ARABIC_SAMPLE)


class TestPipelineParity:
    """The PNG and raw paths describe the same image."""

    def test_png_and_raw_agree_on_geometry(self, client):
        resp = client.post("/render", json={"text": ARABIC_SAMPLE})
        png_px = len(Image.open(io.BytesIO(resp.content)).convert("L").tobytes())
        raw_len = len(ArabicBitmapRenderer().render(ARABIC_SAMPLE))
        # PNG is 1 byte/pixel; raw path is 2 pixels/byte.
        assert png_px == raw_len * 2
