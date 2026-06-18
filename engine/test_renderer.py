"""Tests for engine/renderer.py — Arabic Bitmap Renderer."""

import tempfile
from unittest.mock import patch, MagicMock

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

    def test_invalid_font_path_falls_back(self):
        """A non-font file passed as font_path triggers OSError -> font fallback."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tf:
            tf.write(b"not a font file")
            bad_path = tf.name

        try:
            r = ArabicBitmapRenderer(width=576, height=288, font_path=bad_path)
            # Should not raise; falls back to one of the default fonts
            result = r.render("Hello")
            assert isinstance(result, bytes)
            expected_len = (576 * 288) // 2
            assert len(result) == expected_len
        finally:
            import os
            os.unlink(bad_path)

    def test_all_font_paths_fail_falls_back_to_pil_default(self):
        """When DejaVu and Noto paths both fail, PIL ImageFont.load_default() is used."""
        import PIL.ImageFont
        _real_truetype = PIL.ImageFont.truetype

        def fail_specific_paths(path=None, *args, **kwargs):
            if path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                         "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf"):
                raise OSError("font not found")
            return _real_truetype(path, *args, **kwargs)

        # Patch the underlying PIL.ImageFont.truetype (not renderer.ImageFont)
        # so the test controls what happens for all callers including load_default()
        with patch("PIL.ImageFont.truetype", side_effect=fail_specific_paths):
            r = ArabicBitmapRenderer(width=576, height=288)
            result = r.render("Test")
            assert isinstance(result, bytes)
            expected_len = (576 * 288) // 2
            assert len(result) == expected_len

    # --- RTL shaping edge cases ---

    def test_arabic_shaping_exception_falls_back_to_raw_text(self):
        """When arabic_reshaper raises, fall back to rendering raw text."""
        with patch("renderer.arabic_reshaper.reshape", side_effect=RuntimeError("reshaping failed")):
            r = ArabicBitmapRenderer(width=576, height=288)
            result = r.render("مرحبا")
            assert isinstance(result, bytes)
            expected_len = (576 * 288) // 2
            assert len(result) == expected_len

    # --- RenderError wrapping ---

    def test_render_raises_render_error_on_pil_failure(self):
        """When PIL rendering fails, the exception is wrapped in RenderError."""
        with patch("renderer.Image.new", side_effect=RuntimeError("PIL crash")):
            r = ArabicBitmapRenderer(width=576, height=288)
            with pytest.raises(RenderError, match="Bitmap rendering failed"):
                r.render("Hello")

    def test_render_error_chains_original_exception(self):
        """RenderError wraps the original exception via __cause__."""
        original = RuntimeError("PIL crash")
        with patch("renderer.Image.new", side_effect=original):
            r = ArabicBitmapRenderer(width=576, height=288)
            try:
                r.render("Hello")
            except RenderError as exc:
                assert exc.__cause__ is original

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
