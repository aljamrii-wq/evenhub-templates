"""Arabic Bitmap Renderer for Even G2 smart glasses display.

Produces 576x288 4-bit grayscale bitmaps with proper RTL Arabic shaping.
Output is raw pixel bytes (2 pixels per byte, high nibble first)
consumable directly by the Even G2 display.
"""

import io
import logging
import os
from PIL import Image, ImageDraw, ImageFont

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_ARABIC = True
except ImportError:
    HAS_ARABIC = False

logger = logging.getLogger(__name__)

# Arabic-capable font bundled with the engine. Bundling guarantees correct
# Arabic glyphs regardless of which fonts the host/CI image happens to have
# installed — without it, PIL silently falls back to a Latin-only font and
# every Arabic character renders as a .notdef ("tofu") box.
_BUNDLED_ARABIC_FONT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "fonts", "Amiri-Regular.ttf"
)

# System fonts to try after the bundled font, in order of Arabic coverage.
_SYSTEM_FONT_CANDIDATES = (
    "/usr/share/fonts/opentype/fonts-hosny-amiri/Amiri-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Latin-only last resort
)


class RenderError(Exception):
    """Raised when bitmap rendering fails."""
    pass


class ArabicBitmapRenderer:
    """Render text to 576x288 4-bit grayscale bitmaps for Even G2.

    Uses arabic_reshaper + python-bidi for correct RTL Arabic shaping.
    Output is packed 4-bit grayscale (2 pixels per byte, high nibble first).
    """

    DEFAULT_WIDTH = 576
    DEFAULT_HEIGHT = 288
    DEFAULT_FONT_SIZE = 28
    MAX_FONT_SIZE = 288
    GRAYSCALE_LEVELS = 16

    def __init__(self, width: int = DEFAULT_WIDTH, height: int = DEFAULT_HEIGHT,
                 font_size: int = DEFAULT_FONT_SIZE, font_path: str | None = None):
        if width <= 0 or height <= 0:
            raise ValueError(f"Invalid dimensions: {width}x{height}")
        # Even G2 display packs 2 pixels per byte — total pixels must be even
        if (width * height) % 2 != 0:
            raise ValueError(
                f"Total pixels (width x height) must be even, got {width}x{height} = {width * height}"
            )
        if font_size <= 0 or font_size > self.MAX_FONT_SIZE:
            raise ValueError(
                f"font_size must be between 1 and {self.MAX_FONT_SIZE}, got {font_size}"
            )

        self.width = width
        self.height = height
        self.font_size = font_size
        self.font_path = font_path
        self._font = self._load_font()

    def _load_font(self):
        """Load an Arabic-capable font, falling back to PIL default.

        Resolution order:
          1. Explicit ``font_path`` if provided.
          2. The Amiri font bundled in ``engine/fonts/`` (Arabic-capable).
          3. Known system fonts (Amiri, Noto Naskh Arabic, then DejaVu).
          4. PIL's built-in default (Latin-only — last resort).
        """
        candidates: list[str] = []
        if self.font_path:
            candidates.append(self.font_path)
        candidates.append(_BUNDLED_ARABIC_FONT)
        candidates.extend(_SYSTEM_FONT_CANDIDATES)

        for path in candidates:
            try:
                font = ImageFont.truetype(path, self.font_size)
                self.font_supports_arabic = self._font_has_arabic(font)
                if not self.font_supports_arabic:
                    logger.warning(
                        "Loaded font %s has no Arabic glyphs — Arabic text will "
                        "render as .notdef boxes.", path
                    )
                return font
            except OSError as exc:
                logger.debug("Cannot load font %s: %s", path, exc)

        logger.warning(
            "No TrueType font available; using PIL default (no Arabic support)."
        )
        self.font_supports_arabic = False
        return ImageFont.load_default()

    @staticmethod
    def _font_has_arabic(font) -> bool:
        """Return True if the font renders an Arabic letter to a real glyph.

        Uses Arabic letter heh (U+0647) as a probe: a font without Arabic
        coverage produces an empty mask (no .notdef ink) for it under PIL.
        """
        try:
            mask = font.getmask("ه")  # ARABIC LETTER HEH
            return mask.getbbox() is not None
        except Exception:
            return False

    def _shape_text(self, text: str) -> str:
        """Apply Arabic reshaping and bidirectional reordering."""
        if not HAS_ARABIC:
            return text
        try:
            reshaped = arabic_reshaper.reshape(text)
            return get_display(reshaped)
        except Exception as exc:
            logger.warning("Arabic shaping failed: %s. Using raw text.", exc)
            return text

    def render(self, text: str | None) -> bytes:
        """Render text to a 4-bit grayscale bitmap.

        Args:
            text: The text to render (Arabic or English). None or empty
                  produces a blank bitmap.

        Returns:
            Packed 4-bit grayscale bytes. 2 pixels per byte, high nibble first.
            Total length: (width * height) // 2.

        Raises:
            RenderError: If rendering fails unexpectedly.
        """
        if not text:
            return self._blank_bitmap()

        try:
            shaped = self._shape_text(text)
            img = Image.new("L", (self.width, self.height), 0)
            draw = ImageDraw.Draw(img)

            margin = 8
            max_width = self.width - 2 * margin
            lines_list = self._wrap_text(draw, shaped, max_width)

            y = margin
            line_height = self.font_size + 4
            for line in lines_list:
                if y + line_height > self.height - margin:
                    break
                draw.text((margin, y), line, fill=255, font=self._font)
                y += line_height

            # Convert 8-bit grayscale (0-255) to 4-bit (0-15)
            raw = img.tobytes()
            packed = bytearray(len(raw) // 2)
            for i in range(0, len(raw), 2):
                high = raw[i] >> 4
                low = raw[i + 1] >> 4 if i + 1 < len(raw) else 0
                packed[i // 2] = ((high & 0x0F) << 4) | (low & 0x0F)

            return bytes(packed)
        except Exception as exc:
            raise RenderError(f"Bitmap rendering failed: {exc}") from exc

    def _wrap_text(self, draw, text: str, max_width: int) -> list:
        """Word-wrap text to fit within max_width pixels."""
        lines = []
        for paragraph in text.split("\n"):
            words = paragraph.split(" ")
            current_line = ""
            for word in words:
                test_line = f"{current_line} {word}".strip()
                bbox = draw.textbbox((0, 0), test_line, font=self._font)
                w = bbox[2] - bbox[0]
                if w > max_width and current_line:
                    lines.append(current_line)
                    current_line = word
                else:
                    current_line = test_line
            if current_line:
                lines.append(current_line)
        return lines

    def _blank_bitmap(self) -> bytes:
        """Return an all-zero bitmap of the correct size."""
        return b"\x00" * ((self.width * self.height) // 2)

    def render_png(self, text: str | None) -> bytes:
        """Render text to a PNG image for Even G2 display.

        The Even Hub SDK's updateImageRawData expects encoded image bytes
        (PNG/JPEG), not raw pixel data.
        """
        try:
            if not text:
                img = Image.new("L", (self.width, self.height), 0)
            else:
                shaped = self._shape_text(text)
                img = Image.new("L", (self.width, self.height), 0)
                draw = ImageDraw.Draw(img)
                margin = 8
                max_width = self.width - 2 * margin
                lines_list = self._wrap_text(draw, shaped, max_width)
                y = margin
                line_height = self.font_size + 4
                for line in lines_list:
                    if y + line_height > self.height - margin:
                        break
                    draw.text((margin, y), line, fill=255, font=self._font)
                    y += line_height
            import io
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            return buf.getvalue()
        except Exception as exc:
            raise RenderError(f"PNG rendering failed: {exc}") from exc

    def raw_bytes(self, text: str | None) -> bytes:
        """Convenience alias for render() — raw 4-bit packed bitmap bytes."""
        return self.render(text)
