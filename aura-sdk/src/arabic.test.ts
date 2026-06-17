import { ArabicRenderer } from './arabic';

describe('ArabicRenderer', () => {
  describe('needsImageRender (static)', () => {
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

  describe('render with engine client', () => {
    it('uses engine client when provided', async () => {
      const mockClient = {
        render: jest.fn().mockResolvedValue({
          data: Buffer.from('test-pixel-data').toString('base64'),
          width: 576,
          height: 288,
          format: '4bit' as const,
        }),
      };
      const renderer = new ArabicRenderer('ar', mockClient as any);
      const pixels = await renderer.render('\u0645\u0631\u062D\u0628\u0627'); // مرحبا as unicode escapes
      const expected = new Uint8Array(Buffer.from('test-pixel-data'));
      expect(pixels).toEqual(expected);
      expect(mockClient.render).toHaveBeenCalledWith({
        text: '\u0645\u0631\u062D\u0628\u0627',
        lang: 'ar',
        size: 24,
        width: 576,
        height: 288,
      });
    });

    it('caches results for same key', async () => {
      const mockClient = {
        render: jest.fn().mockResolvedValue({
          data: Buffer.from('cached-data').toString('base64'),
          width: 576,
          height: 288,
          format: '4bit' as const,
        }),
      };
      const renderer = new ArabicRenderer('ar', mockClient as any);

      const p1 = await renderer.render('\u0645\u0631\u062D\u0628\u0627');
      const p2 = await renderer.render('\u0645\u0631\u062D\u0628\u0627');

      expect(mockClient.render).toHaveBeenCalledTimes(1);
      expect(p1).toEqual(p2);
    });

    it('does not cache different text', async () => {
      const callCounts: Array<{ text: string }> = [];
      const mockClient = {
        render: jest.fn().mockImplementation((req: any) => {
          callCounts.push({ text: req.text });
          return Promise.resolve({
            data: Buffer.from('data-' + callCounts.length).toString('base64'),
            width: 576,
            height: 288,
            format: '4bit' as const,
          });
        }),
      };
      const renderer = new ArabicRenderer('ar', mockClient as any);

      await renderer.render('\u0645\u0631\u062D\u0628\u0627');
      await renderer.render('\u0627\u0644\u0639\u0627\u0644\u0645');

      expect(mockClient.render).toHaveBeenCalledTimes(2);
    });
  });

  describe('render without engine client (fetch fallback)', () => {
    it('makes fetch call when no engine client', async () => {
      const mockBinary = new Uint8Array([0x10, 0x20, 0x30]);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBinary.buffer),
      });

      const renderer = new ArabicRenderer('ar');
      const pixels = await renderer.render('test');

      expect(pixels).toEqual(mockBinary);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/render'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      jest.restoreAllMocks();
    });

    it('throws on non-ok fetch response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const renderer = new ArabicRenderer('ar');
      await expect(renderer.render('test')).rejects.toThrow('Render failed: 500');

      jest.restoreAllMocks();
    });
  });
});
