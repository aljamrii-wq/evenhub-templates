/**
 * ArabicRenderer — Renders Arabic/RTL text as greyscale images for G2 display.
 *
 * Works by sending text to aura-engine (Python) which uses PIL + arabic_reshaper + python-bidi.
 * The engine returns raw 4-bit greyscale pixel data suitable for updateImageRawData.
 *
 * If an EngineClient is provided, it uses the typed API; otherwise falls back to raw fetch.
 */
import type { Language } from './types';
import type { EngineClient } from './engine';

const ENGINE_URL = 'https://hermes.aljamrigroup.com/aura/render';

export class ArabicRenderer {
  private lang: Language;
  private cache: Map<string, { pixels: Uint8Array; width: number; height: number }> = new Map();
  private engineClient: EngineClient | null = null;

  constructor(lang: Language, engineClient?: EngineClient) {
    this.lang = lang;
    this.engineClient = engineClient || null;
  }

  /** Render text as greyscale pixels for G2 display */
  async render(text: string, size?: number): Promise<Uint8Array> {
    const key = `${this.lang}:${size || 24}:${text}`;
    const cached = this.cache.get(key);
    if (cached) return cached.pixels;

    if (this.engineClient) {
      const result = await this.engineClient.render({
        text,
        lang: this.lang,
        size: size || 24,
        width: 576,
        height: 288,
      });
      const binary = atob(result.data);
      const pixels = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        pixels[i] = binary.charCodeAt(i);
      }
      this.cache.set(key, { pixels, width: result.width, height: result.height });
      this.evictCache();
      return pixels;
    }

    // Fallback: raw fetch
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
      throw new Error(`Render failed: ${resp.status}`);
    }
    const buffer = await resp.arrayBuffer();
    const pixels = new Uint8Array(buffer);
    this.cache.set(key, { pixels, width: 576, height: 288 });
    this.evictCache();
    return pixels;
  }

  /** Evict oldest cache entry when over limit */
  private evictCache(): void {
    if (this.cache.size > 100) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
  }

  /** Check if a language needs image-based rendering */
  static needsImageRender(lang: Language): boolean {
    return ['ar', 'ur', 'fa'].includes(lang);
  }
}
