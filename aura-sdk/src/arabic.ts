/**
 * ArabicRenderer — Renders Arabic/RTL text as greyscale images for G2 display.
 * 
 * Works by sending text to aura-engine (Python) which uses PIL + arabic_reshaper + python-bidi.
 * The engine returns raw 4-bit greyscale pixel data suitable for updateImageRawData.
 */

import type { Language, RenderResult } from './types';

const ENGINE_URL = 'https://hermes.aljamrigroup.com/aura/render';

export class ArabicRenderer {
  private lang: Language;
  private cache = new Map<string, RenderResult>();

  constructor(lang: Language) {
    this.lang = lang;
  }

  /** Render text as greyscale pixels for G2 display */
  async render(text: string, size?: number): Promise<Uint8Array> {
    const key = `${this.lang}:${size || 24}:${text}`;
    const cached = this.cache.get(key);
    if (cached) return cached.pixels;

    const resp = await fetch(ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        lang: this.lang,
        size: size || 24,
        width: 576,
        height: 288,
      }),
    });

    if (!resp.ok) {
      // Fallback: show as transliterated text
      throw new Error(`Render failed: ${resp.status}`);
    }

    const buffer = await resp.arrayBuffer();
    const pixels = new Uint8Array(buffer);

    this.cache.set(key, { pixels, width: 576, height: 288 });

    // Limit cache size
    if (this.cache.size > 100) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }

    return pixels;
  }

  /** Check if a language needs image-based rendering */
  static needsImageRender(lang: Language): boolean {
    return ['ar', 'ur', 'fa'].includes(lang);
  }
}
