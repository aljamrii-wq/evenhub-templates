import { GestureEngine } from './gestures';
import type { GestureEvent } from './types';

describe('GestureEngine', () => {
  let engine: GestureEngine;

  beforeEach(() => {
    engine = new GestureEngine();
  });

  it('returns unknown when fewer than 5 frames', () => {
    const result = engine.process(0, 0, 0);
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('returns unknown for flat IMU data', () => {
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    for (let i = 0; i < 10; i++) {
      result = engine.process(0, 0, 0);
    }
    expect(result.type).toBe('unknown');
  });

  it('detects nod from rapid pitch oscillation', () => {
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    const nodPattern = [0, 1.5, 0, -1.5, 0, 1.5, 0, -1.5, 0, 1.5, 0, -1.5, 0, 0, 0];
    for (const y of nodPattern) {
      result = engine.process(0, y, 0);
    }
    expect(result.type).toBe('nod');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('detects shake from rapid yaw oscillation', () => {
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    const shakePattern = [0, 1.2, 0, -1.2, 0, 1.2, 0, -1.2, 0, 1.2, 0, -1.2, 0];
    for (const x of shakePattern) {
      result = engine.process(x, 0, 0);
    }
    expect(result.type).toBe('shake');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('detects look-down from sustained pitch down', () => {
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    for (let i = 0; i < 15; i++) {
      result = engine.process(0, -1.0, 0);
    }
    expect(result.type).toBe('look-down');
  });

  it('detects look-left from sustained yaw left', () => {
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    for (let i = 0; i < 15; i++) {
      result = engine.process(-1.0, 0, 0);
    }
    expect(result.type).toBe('look-left');
  });

  it('detects look-right from sustained yaw right', () => {
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    for (let i = 0; i < 15; i++) {
      result = engine.process(1.0, 0, 0);
    }
    expect(result.type).toBe('look-right');
  });

  it('returns unknown for borderline movement below thresholds', () => {
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    for (let i = 0; i < 12; i++) {
      result = engine.process(0.3, -0.3, 0.1);
    }
    expect(result.type).toBe('unknown');
  });

  it('nod takes priority over shake detection', () => {
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    for (let i = 0; i < 12; i++) {
      const y = i % 2 === 0 ? 1.5 : -1.5;
      const x = i % 2 === 0 ? 1.2 : -1.2;
      result = engine.process(x, y, 0);
    }
    expect(result.type).toBe('nod');
  });

  it('history is capped and gestures continue to work', () => {
    for (let i = 0; i < 50; i++) {
      const y = i % 2 === 0 ? 1.5 : -1.5;
      engine.process(0, y, 0);
    }
    const result = engine.process(0, 1.5, 0);
    expect(['nod', 'look-down']).toContain(result.type);
  });

  it('returns timestamp in every event', () => {
    const before = Date.now();
    let result: GestureEvent = { type: 'unknown', confidence: 0, timestamp: 0 };
    for (let i = 0; i < 5; i++) {
      result = engine.process(0, 0, 0);
    }
    const after = Date.now();
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });
});
