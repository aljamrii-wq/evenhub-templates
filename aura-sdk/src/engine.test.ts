import { EngineClient } from './engine';

describe('EngineClient', () => {
  let client: EngineClient;

  beforeEach(() => {
    client = new EngineClient('https://test.example.com/');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('strips trailing slash from base URL', () => {
      const c = new EngineClient('https://api.example.com/');
      // We can't directly access private baseUrl, but we can test via health
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', version: '1.0', uptime: 0, modes: [] }),
      });
      return c.health().then(() => {
        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/health');
      });
    });
  });

  describe('health', () => {
    it('returns health response on success', async () => {
      const mockResponse = { status: 'ok', version: '1.2.3', uptime: 3600, modes: ['flydubai', 'aljamri', 'personal'] };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.health();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith('https://test.example.com/health');
    });

    it('throws on non-ok response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      await expect(client.health()).rejects.toThrow('Engine health check failed: 503');
    });
  });

  describe('render', () => {
    it('sends render request with correct body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'abc', width: 576, height: 288, format: '4bit' }),
      });

      await client.render({ text: 'مرحبا', lang: 'ar', size: 24, width: 576, height: 288 });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.example.com/render',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toBe('مرحبا');
      expect(body.lang).toBe('ar');
      expect(body.size).toBe(24);
    });

    it('uses defaults for missing size/width/height', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'abc', width: 576, height: 288, format: '4bit' }),
      });

      await client.render({ text: 'test', lang: 'en' });
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.size).toBe(24);
      expect(body.width).toBe(576);
      expect(body.height).toBe(288);
    });

    it('throws on render failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(client.render({ text: '', lang: 'ar' })).rejects.toThrow('Render failed: 400');
    });
  });

  describe('detectMode', () => {
    it('sends mode detection request', async () => {
      const mockMode = { mode: 'flydubai', confidence: 0.9, reason: 'work hours' };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMode),
      });

      const result = await client.detectMode({ hour: 10, day: 0, wearing: true });
      expect(result).toEqual(mockMode);

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.hour).toBe(10);
      expect(body.day).toBe(0);
      expect(body.wearing).toBe(true);
    });

    it('throws on mode detection failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(client.detectMode({ hour: 10, day: 0 })).rejects.toThrow('Mode detection failed: 500');
    });
  });

  describe('translate', () => {
    it('sends translate request', async () => {
      const mockTranslation = { text: 'مرحبا', from: 'ar', to: 'en' };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTranslation),
      });

      const result = await client.translate({ text: 'hello', from: 'en', to: 'ar' });
      expect(result).toEqual(mockTranslation);

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.text).toBe('hello');
      expect(body.from).toBe('en');
      expect(body.to).toBe('ar');
    });

    it('throws on translation failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(client.translate({ text: 'hi', from: 'en', to: 'ar' })).rejects.toThrow('Translation failed: 400');
    });
  });
});
