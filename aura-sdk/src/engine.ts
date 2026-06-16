/**
 * EngineClient — HTTP client for aura-engine REST endpoints.
 *
 * Endpoints:
 *   GET  /health        — engine health + version
 *   POST /render        — render Arabic/RTL text as greyscale pixels
 *   POST /mode          — detect current mode from context
 *   POST /translate     — translate text between languages
 */

import type {
  EngineHealthResponse,
  EngineRenderRequest,
  EngineRenderResponse,
  EngineModeResponse,
  EngineTranslateRequest,
  EngineTranslateResponse,
} from './types';

export class EngineClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** Check engine health */
  async health(): Promise<EngineHealthResponse> {
    const resp = await fetch(`${this.baseUrl}/health`);
    if (!resp.ok) {
      throw new Error(`Engine health check failed: ${resp.status}`);
    }
    return resp.json();
  }

  /** Render text as greyscale pixel data for G2 display */
  async render(req: EngineRenderRequest): Promise<EngineRenderResponse> {
    const resp = await fetch(`${this.baseUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: req.text,
        lang: req.lang,
        size: req.size || 24,
        width: req.width || 576,
        height: req.height || 288,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Render failed: ${resp.status}`);
    }

    return resp.json();
  }

  /** Detect mode from context */
  async detectMode(context: {
    hour: number;
    day: number;
    wearing?: boolean;
  }): Promise<EngineModeResponse> {
    const resp = await fetch(`${this.baseUrl}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    });

    if (!resp.ok) {
      throw new Error(`Mode detection failed: ${resp.status}`);
    }

    return resp.json();
  }

  /** Translate text */
  async translate(req: EngineTranslateRequest): Promise<EngineTranslateResponse> {
    const resp = await fetch(`${this.baseUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!resp.ok) {
      throw new Error(`Translation failed: ${resp.status}`);
    }

    return resp.json();
  }
}
