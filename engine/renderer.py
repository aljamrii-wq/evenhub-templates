"""Arabic Bitmap Renderer for Even G2 smart glasses display.

Produces 576x288 4-bit grayscale bitmaps with proper RTL Arabic shaping.
Output is raw pixel bytes (2 pixels per byte, high nibble first)
consumable directly by the Even G2 display.
"""

import logging
from PIL import Image, ImageDraw, ImageFont

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_ARABIC = True
except ImportError:
    HAS_ARABIC = False

logger = logging.getLogger(__name__)


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
        """Load the configured font, falling back to PIL default."""
        if self.font_path:
            try:
                return ImageFont.truetype(self.font_path, self.font_size)
            except OSError as exc:
                logger.warning(
                    "Cannot load font %s: %s. Falling back to default.",
                    self.font_path, exc
                )
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                                      self.font_size)
        except OSError:
            pass
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
                                      self.font_size)
        except OSError:
            pass
        return ImageFont.load_default()

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

    def raw_bytes(self, text: str | None) -> bytes:
        """Convenience alias for render()."""
        return self.render(text)
