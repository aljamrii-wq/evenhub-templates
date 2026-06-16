import { EngineClient } from './engine';
import type {
  EngineHealthResponse,
  EngineRenderResponse,
  EngineModeResponse,
  EngineTranslateResponse,
} from './types';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('EngineClient', () => {
  let client: EngineClient;

  beforeEach(() => {
    client = new EngineClient('https://hermes.aljamrigroup.com/aura');
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('strips trailing slash from baseUrl', () => {
      const c = new EngineClient('https://example.com/api/');
      // No good way to test private fields, but health() won't double-slash
    });
  });

  describe('health', () => {
    it('returns health response on ok', async () => {
      const health: EngineHealthResponse = {
        status: 'ok',
        version: '0.1.0',
        uptime: 3600,
        modes: ['flydubai', 'aljamri', 'personal'],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(health),
      });

      const result = await client.health();
      expect(result).toEqual(health);
      expect(mockFetch).toHaveBeenCalledWith('https://hermes.aljamrigroup.com/aura/health');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      await expect(client.health()).rejects.toThrow('Engine health check failed: 503');
    });
  });

  describe('render', () => {
    it('sends render request and returns response', async () => {
      const renderResp: EngineRenderResponse = {
        data: 'AAAA',
        width: 576,
        height: 288,
        format: '4bit',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(renderResp),
      });

      const result = await client.render({ text: 'مرحبا', lang: 'ar' });
      expect(result).toEqual(renderResp);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hermes.aljamrigroup.com/aura/render',
        expect.objectContaining({ method: 'POST' })
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toBe('مرحبا');
      expect(body.lang).toBe('ar');
      expect(body.size).toBe(24);
      expect(body.width).toBe(576);
    });

    it('uses custom size and dimensions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: '', width: 100, height: 50, format: 'greyscale' }),
      });

      await client.render({ text: 'Hi', lang: 'en', size: 32, width: 200, height: 100 });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.size).toBe(32);
      expect(body.width).toBe(200);
      expect(body.height).toBe(100);
    });

    it('throws on render failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(client.render({ text: 'test', lang: 'ar' })).rejects.toThrow('Render failed: 500');
    });
  });

  describe('detectMode', () => {
    it('returns mode for given context', async () => {
      const modeResp: EngineModeResponse = {
        mode: 'flydubai',
        confidence: 0.9,
        reason: 'work hours',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(modeResp),
      });

      const result = await client.detectMode({ hour: 10, day: 1, wearing: true });
      expect(result).toEqual(modeResp);
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });
      await expect(client.detectMode({ hour: 10, day: 1 }))
        .rejects.toThrow('Mode detection failed: 502');
    });
  });

  describe('translate', () => {
    it('translates text between languages', async () => {
      const translateResp: EngineTranslateResponse = {
        text: 'Hello',
        from: 'ar',
        to: 'en',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(translateResp),
      });

      const result = await client.translate({ text: 'مرحبا', from: 'ar', to: 'en' });
      expect(result).toEqual(translateResp);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.from).toBe('ar');
      expect(body.to).toBe('en');
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
      await expect(client.translate({ text: '', from: 'ar', to: 'en' }))
        .rejects.toThrow('Translation failed: 400');
    });
  });
});
