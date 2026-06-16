/**
 * ModeDetector — Auto-detects which "mode" the user is in.
 * 
 * flydubai: work hours (9am-6pm), standing/walking, sales context
 * aljamri:  anytime, business task context
 * personal: evenings, weekends, family context
 */

import type { AuraMode, ModeContext } from './types';

type ModeCallback = (ctx: ModeContext) => void;

interface DeviceInfo {
  wearing?: boolean;
  battery?: number;
}

export class ModeDetector {
  private _current: AuraMode = 'personal';
  private callbacks: ModeCallback[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  get current(): AuraMode {
    return this._current;
  }

  /** Start mode detection */
  start(deviceInfo: DeviceInfo, now: Date): void {
    this.detect(deviceInfo, now);

    // Re-check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.detect(deviceInfo, new Date());
    }, 5 * 60 * 1000);
  }

  /** Stop detection */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /** Register callback for mode changes */
  onChange(cb: ModeCallback): void {
    this.callbacks.push(cb);
  }

  /** Detect mode from time + context */
  private detect(info: DeviceInfo, now: Date): void {
    const hour = now.getHours();
    const day = now.getDay(); // 0=Sun, 6=Sat (Sunday week start in UAE)
    const isWeekend = day === 5 || day === 6; // Fri-Sat in UAE
    const isWorkHours = hour >= 9 && hour < 18;

    let mode: AuraMode;
    let reason = '';

    if (isWeekend) {
      mode = 'personal';
      reason = 'weekend';
    } else if (isWorkHours && hour < 14) {
      mode = 'flydubai';
      reason = 'work hours — Flydubai shift';
    } else if (isWorkHours) {
      mode = 'aljamri';
      reason = 'afternoon — business mode';
    } else if (hour >= 18 && hour < 22) {
      mode = 'personal';
      reason = 'evening — personal time';
    } else {
      mode = 'personal';
      reason = 'night — quiet mode';
    }

    if (mode !== this._current) {
      const ctx: ModeContext = {
        mode,
        confidence: 0.85,
        reason,
      };
      this._current = mode;
      for (const cb of this.callbacks) {
        cb(ctx);
      }
    }
  }

  /** Force a specific mode */
  forceMode(mode: AuraMode): void {
    this._current = mode;
  }
}
