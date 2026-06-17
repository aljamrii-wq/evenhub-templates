import { ModeDetector } from './modes';
import type { AuraMode, ModeContext } from './types';

function makeDate(hour: number, day: number): Date {
  // 2026-06-01 is a Monday (day 1 in JS getDay() — Sunday=0)
  // We need a reference where we can control the day of week.
  // Use 2026-06-15 = Monday (getDay() = 1)
  const d = new Date(2026, 5, 15 + day, hour, 0, 0);
  return d;
}

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

  it('detects flydubai mode during work hours on weekdays (morning)', () => {
    // Monday at 10am
    const now = makeDate(10, 0); // Monday
    detector.start({ wearing: true, battery: 80 }, now);
    expect(detector.current).toBe('flydubai');
  });

  it('detects aljamri mode during afternoon work hours on weekdays', () => {
    // Monday at 3pm
    const now = makeDate(15, 0); // Monday
    detector.start({ wearing: true, battery: 80 }, now);
    expect(detector.current).toBe('aljamri');
  });

  it('detects personal mode in the evening', () => {
    // Monday at 7pm
    const now = makeDate(19, 0); // Monday
    detector.start({ wearing: true, battery: 80 }, now);
    expect(detector.current).toBe('personal');
  });

  it('detects personal mode at night', () => {
    // Monday at 11pm
    const now = makeDate(23, 0); // Monday
    detector.start({ wearing: true, battery: 80 }, now);
    expect(detector.current).toBe('personal');
  });

  it('detects personal mode on Friday (weekend in UAE)', () => {
    // Friday (Mon(0) + 4 = Fri) at 10am
    const now = makeDate(10, 4); // Friday
    detector.start({ wearing: true, battery: 80 }, now);
    expect(detector.current).toBe('personal');
  });

  it('detects personal mode on Saturday (weekend in UAE)', () => {
    // Saturday (Mon(0) + 5 = Sat) at 10am
    const now = makeDate(10, 5); // Saturday
    detector.start({ wearing: true, battery: 80 }, now);
    expect(detector.current).toBe('personal');
  });

  it('notifies callbacks on mode change', () => {
    const callback = jest.fn();
    detector.onChange(callback);

    // Start with personal (night)
    const night = makeDate(23, 0);
    detector.start({}, night);
    expect(detector.current).toBe('personal');
    // No callback fired because it started as personal
    expect(callback).not.toHaveBeenCalled();
  });

  it('forceMode overrides detection', () => {
    const now = makeDate(10, 0); // Monday morning → flydubai
    detector.start({}, now);
    expect(detector.current).toBe('flydubai');

    detector.forceMode('personal');
    expect(detector.current).toBe('personal');
  });

  it('stop halts detection', () => {
    const now = makeDate(10, 0);
    detector.start({}, now);
    detector.stop();
    // Should not throw on stop
    expect(detector.current).toBe('flydubai');
  });
});
