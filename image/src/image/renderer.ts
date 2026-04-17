// Image pipeline for the G2 display.
//
// The G2 panel is 576x288, 4-bit greyscale (16 shades of green on black).
// `bridge.updateImageRawData` accepts a `Uint8Array` (among other formats)
// of source pixel data and handles the greyscale conversion internally —
// if the SDK can't convert your image it returns `imageToGray4Failed`.
//
// ─────────────────────────────────────────────────────────────────────
// preprocessing is optional
// ─────────────────────────────────────────────────────────────────────
// You don't *need* to pre-grayscale or dither anything. For photos you'll
// usually get better results by pre-processing (contrast boost + Floyd–
// Steinberg dithering sharpens mid-tones on a 16-shade display), but line
// art, icons, and QR codes render fine raw. Try the naive path first; only
// add a dither pass if the output looks muddy on glass.
// ─────────────────────────────────────────────────────────────────────

// Generates a diagonal gradient test pattern so this template runs without
// any bundled image asset. Swap this for `loadImageBytes()` below once you
// have a real image to display.
export function makeTestPattern(width: number, height: number): Uint8Array {
  // 2 pixels per byte (4-bit packed). Higher nibble = left pixel, lower = right.
  const out = new Uint8Array(Math.ceil((width * height) / 2))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shade = Math.floor(((x + y) / (width + height)) * 15) & 0x0f
      const idx = (y * width + x) >> 1
      out[idx] |= (x & 1) === 0 ? shade << 4 : shade
    }
  }
  return out
}

// Reference path for loading a real asset. Drop an image into `public/`,
// fetch it here, and feed the bytes into `bridge.updateImageRawData`.
// The SDK will attempt greyscale conversion on common formats; if that
// fails (`imageToGray4Failed`), pre-process to 4-bit packed bytes yourself.
export async function loadImageBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${res.statusText}`)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}
