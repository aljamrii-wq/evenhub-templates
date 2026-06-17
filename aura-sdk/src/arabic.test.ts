import { ArabicRenderer } from './arabic';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ArabicRenderer', () => {
  let renderer: ArabicRenderer;

  beforeEach(() => {
    renderer = new ArabicRenderer("ar", "https://hermes.aljamrigroup.com/aura/render");
    mockFetch.mockReset();
  });

  describe('needsImageRender', () => {
    it('returns true for Arabic', () => {
      expect(ArabicRenderer.needsImageRender('ar')).toBe(true);
    });

    it('returns true for Urdu', () => {
      expect(ArabicRenderer.needsImageRender('ur')).toBe(true);
    });

    it('returns true for Farsi', () => {
      expect(ArabicRenderer.needsImageRender('fa')).toBe(true);
    });

    it('returns false for English', () => {
      expect(ArabicRenderer.needsImageRender('en')).toBe(false);
    });

    it('returns false for Hindi', () => {
      expect(ArabicRenderer.needsImageRender('hi')).toBe(false);
    });
  });

  describe('render', () => {
    it('fetches pixels from the engine and returns Uint8Array', async () => {
      const fakePixels = new Uint8Array([0, 1, 2, 3]).buffer;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(fakePixels),
      });

      const result = await renderer.render('مرحبا');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe('https://hermes.aljamrigroup.com/aura/render');
      expect(call[1].method).toBe('POST');

      const body = JSON.parse(call[1].body);
      expect(body.text).toBe('مرحبا');
      expect(body.lang).toBe('ar');
      expect(body.width).toBe(576);
      expect(body.height).toBe(288);
    });

    it('caches identical render requests', async () => {
      const fakePixels = new Uint8Array([0, 1]).buffer;
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(fakePixels),
      });

      await renderer.render('مرحبا');
      await renderer.render('مرحبا');

      // Only one network call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('uses different cache keys for different languages', async () => {
      const rendererEn = new ArabicRenderer("en", "https://hermes.aljamrigroup.com/aura/render");
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0]).buffer),
      });

      await renderer.render('hello');
      await rendererEn.render('hello');

      // Different languages → different cache keys → 2 calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('per-call lang override uses passed language instead of constructor lang', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0]).buffer),
      });

      // renderer was constructed with 'ar', but override to 'ur'
      await renderer.render('hello', undefined, 'ur');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.lang).toBe('ur');
    });

    it('uses constructor lang when no per-call override given', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0]).buffer),
      });

      await renderer.render('hello');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.lang).toBe('ar');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(renderer.render('مرحبا')).rejects.toThrow('Render failed: 500');
    });
  });
});
