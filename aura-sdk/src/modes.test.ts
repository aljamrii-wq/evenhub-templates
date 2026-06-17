/**
 * Tests for ModeDetector: time-based mode detection.
 */
import { ModeDetector } from './modes';
import type { AuraMode } from './types';

describe('ModeDetector', () => {
  let detector: ModeDetector;

  beforeEach(() => {
    detector = new ModeDetector();
  });

  afterEach(() => {
    detector.stop();
  });

  it('defaults to personal mode', () => {
    expect(detector.current).toBe('personal');
  });

  // --- UAE weekday (Sunday-Thursday) ---

  it('detects flydubai during morning work hours on a weekday', () => {
    const callbacks: Array<{ mode: AuraMode; reason: string }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode, reason: ctx.reason }));
    // Sunday (0) 10am — June 14, 2026
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0));
    expect(callbacks.length).toBe(1);
    expect(callbacks[0].mode).toBe('flydubai');
    expect(callbacks[0].reason).toContain('Flydubai');
  });

  it('detects aljamri during afternoon work hours on a weekday', () => {
    const callbacks: Array<{ mode: AuraMode }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode }));
    // Monday (1) 2pm
    detector.start({}, new Date(2026, 5, 15, 14, 0, 0));
    expect(callbacks[0].mode).toBe('aljamri');
  });

  it('detects personal during evening on a weekday', () => {
    // Default is already personal, so start at flydubai time then switch to evening
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0)); // Sunday 10am → flydubai
    expect(detector.current).toBe('flydubai');

    const callbacks: Array<{ mode: AuraMode }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode }));
    // Tuesday (2) 7pm
    detector.start({}, new Date(2026, 5, 16, 19, 0, 0));
    expect(callbacks[0].mode).toBe('personal');
  });

  it('detects personal during late night on a weekday', () => {
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0)); // flydubai
    expect(detector.current).toBe('flydubai');

    const callbacks: Array<{ mode: AuraMode }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode }));
    // Wednesday (3) 11pm
    detector.start({}, new Date(2026, 5, 17, 23, 0, 0));
    expect(callbacks[0].mode).toBe('personal');
  });

  it('detects personal on Friday (weekend)', () => {
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0)); // Sunday → flydubai
    expect(detector.current).toBe('flydubai');

    const callbacks: Array<{ mode: AuraMode; reason: string }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode, reason: ctx.reason }));
    // Friday (5) 10am
    detector.start({}, new Date(2026, 5, 19, 10, 0, 0));
    expect(callbacks[0].mode).toBe('personal');
    expect(callbacks[0].reason).toBe('weekend');
  });

  it('detects personal on Saturday (weekend)', () => {
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0)); // Sunday → flydubai
    expect(detector.current).toBe('flydubai');

    const callbacks: Array<{ mode: AuraMode }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode }));
    // Saturday (6) 2pm
    detector.start({}, new Date(2026, 5, 20, 14, 0, 0));
    expect(callbacks[0].mode).toBe('personal');
  });

  // --- Boundary hours ---

  it('treats 9am as flydubai (inclusive lower bound)', () => {
    const callbacks: Array<{ mode: AuraMode }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode }));
    // Sunday 9:00am
    detector.start({}, new Date(2026, 5, 14, 9, 0, 0));
    expect(callbacks[0].mode).toBe('flydubai');
  });

  it('treats 2pm exactly as aljamri', () => {
    const callbacks: Array<{ mode: AuraMode }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode }));
    // Sunday 2:00pm (hour 14)
    detector.start({}, new Date(2026, 5, 14, 14, 0, 0));
    expect(callbacks[0].mode).toBe('aljamri');
  });

  it('treats 6pm as personal (evening start)', () => {
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0)); // Sunday 10am → flydubai
    expect(detector.current).toBe('flydubai');

    const callbacks: Array<{ mode: AuraMode }> = [];
    detector.onChange((ctx) => callbacks.push({ mode: ctx.mode }));
    // Sunday 6:00pm (hour 18)
    detector.start({}, new Date(2026, 5, 14, 18, 0, 0));
    expect(callbacks[0].mode).toBe('personal');
  });

  // --- No callback if mode doesn't change ---

  it('does not fire callback when mode stays the same', () => {
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0)); // Sunday 10am → flydubai
    const callbacks: number[] = [];
    detector.onChange(() => callbacks.push(1));
    // Same mode again — still flydubai
    detector.start({}, new Date(2026, 5, 14, 11, 0, 0));
    expect(callbacks.length).toBe(0);
  });

  // --- forceMode ---

  it('forceMode overrides detected mode', () => {
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0));
    expect(detector.current).toBe('flydubai');
    detector.forceMode('personal');
    expect(detector.current).toBe('personal');
  });

  // --- Multiple callbacks ---

  it('fires all registered callbacks on mode change', () => {
    const results: string[] = [];
    detector.onChange(() => results.push('cb1'));
    detector.onChange(() => results.push('cb2'));
    detector.onChange(() => results.push('cb3'));
    detector.start({}, new Date(2026, 5, 14, 10, 0, 0));
    expect(results).toEqual(['cb1', 'cb2', 'cb3']);
  });
});
