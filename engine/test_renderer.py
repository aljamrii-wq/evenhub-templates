"""Tests for engine/renderer.py — Arabic Bitmap Renderer."""

import pytest
from renderer import ArabicBitmapRenderer, RenderError


class TestArabicBitmapRenderer:
    """TDD tests for ArabicBitmapRenderer."""

    @pytest.fixture
    def renderer(self):
        return ArabicBitmapRenderer(width=576, height=288)

    # --- dimensions ---

    def test_default_dimensions(self, renderer):
        """Verify default 576x288 for Even G2."""
        assert renderer.width == 576
        assert renderer.height == 288

    def test_custom_dimensions(self):
        r = ArabicBitmapRenderer(width=300, height=100)
        assert r.width == 300
        assert r.height == 100

    def test_invalid_dimensions_raises(self):
        with pytest.raises(ValueError):
            ArabicBitmapRenderer(width=0, height=288)
        with pytest.raises(ValueError):
            ArabicBitmapRenderer(width=576, height=0)

    def test_odd_total_pixels_raises(self):
        """Total pixels must be even (2 pixels per packed byte)."""
        with pytest.raises(ValueError, match="must be even"):
            ArabicBitmapRenderer(width=3, height=3)  # 9 pixels, odd
        # Even total pixels should work fine
        r = ArabicBitmapRenderer(width=2, height=3)  # 6 pixels, even
        assert r.width == 2

    # --- basic rendering ---

    def test_render_english_returns_bytes(self, renderer):
        result = renderer.render("Hello")
        assert isinstance(result, bytes)
        expected_len = (576 * 288) // 2
        assert len(result) == expected_len

    def test_render_arabic_returns_bytes(self, renderer):
        result = renderer.render("مرحبا بالعالم")
        assert isinstance(result, bytes)
        expected_len = (576 * 288) // 2
        assert len(result) == expected_len

    def test_render_empty_string_returns_blank_bitmap(self, renderer):
        result = renderer.render("")
        expected_len = (576 * 288) // 2
        assert len(result) == expected_len
        assert all(b == 0 for b in result)

    def test_render_none_returns_blank(self, renderer):
        result = renderer.render(None)
        expected_len = (576 * 288) // 2
        assert len(result) == expected_len

    # --- RTL shaping ---

    def test_arabic_is_reshaped(self, renderer):
        result = renderer.render("السلام")
        assert isinstance(result, bytes)

    def test_arabic_with_english_mixed(self, renderer):
        result = renderer.render("Hello مرحبا World")
        assert isinstance(result, bytes)
        expected_len = (576 * 288) // 2
        assert len(result) == expected_len

    def test_diacritics_rendered(self, renderer):
        result = renderer.render("السَّلَامُ عَلَيْكُمْ")
        assert isinstance(result, bytes)

    # --- font handling ---

    def test_custom_font_size(self):
        r = ArabicBitmapRenderer(width=576, height=288, font_size=24)
        result = r.render("Test")
        assert isinstance(result, bytes)

    def test_font_size_too_large(self):
        with pytest.raises(ValueError):
            ArabicBitmapRenderer(width=576, height=288, font_size=500)

    def test_default_font_fallback(self, renderer):
        result = renderer.render("Test fallback")
        assert isinstance(result, bytes)

    # --- 4-bit grayscale ---

    def test_bitmap_pixel_range(self, renderer):
        """Every nibble must be 0-15 (4-bit grayscale)."""
        result = renderer.render("Test")
        for byte_val in result:
            high_nibble = (byte_val >> 4) & 0x0F
            low_nibble = byte_val & 0x0F
            assert 0 <= high_nibble <= 15
            assert 0 <= low_nibble <= 15

    def test_non_blank_text_produces_non_zero_pixels(self, renderer):
        result = renderer.render("AAAA")
        assert any(b != 0 for b in result)

    # --- edge cases ---

    def test_very_long_text(self, renderer):
        long_text = "نص طويل " * 100
        result = renderer.render(long_text)
        expected_len = (576 * 288) // 2
        assert len(result) == expected_len

    def test_special_characters(self, renderer):
        result = renderer.render("!@#$%^&*()")
        assert isinstance(result, bytes)

    def test_newlines_in_text(self, renderer):
        result = renderer.render("Line1\nLine2\nLine3")
        assert isinstance(result, bytes)

    # --- raw_bytes convenience ---

    def test_raw_bytes_method(self, renderer):
        result = renderer.raw_bytes("مرحبا")
        assert isinstance(result, bytes)
        expected_len = (576 * 288) // 2
        assert len(result) == expected_len


class TestRenderError:
    def test_render_error_is_exception(self):
        err = RenderError("test message")
        assert isinstance(err, Exception)
        assert str(err) == "test message"
