/**
 * GestureEngine — Detects head gestures from IMU data.
 * 
 * Nod: rapid pitch oscillation (head bobbing up/down)
 * Shake: rapid yaw oscillation (head turning left/right)
 * Look-left/right: sustained yaw offset
 * Look-down: sustained pitch down
 */

import type { GestureEvent, GestureType } from './types';

const HISTORY_SIZE = 30;
const NOD_THRESHOLD = 1.2;    // Pitch change to trigger nod
const SHAKE_THRESHOLD = 1.0;  // Yaw change to trigger shake
const LOOK_THRESHOLD = 0.8;   // Sustained offset for look direction
const CONFIDENCE_DECAY = 0.95;

interface IMUFrame {
  x: number; y: number; z: number;
  timestamp: number;
}

export class GestureEngine {
  private history: IMUFrame[] = [];
  private lastGesture: GestureEvent | null = null;
  private lookTimer: number = 0;

  /** Process a single IMU frame, return gesture if detected */
  process(x: number, y: number, z: number): GestureEvent {
    const now = Date.now();
    this.history.push({ x, y, z, timestamp: now });

    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }

    if (this.history.length < 5) {
      return { type: 'unknown', confidence: 0, timestamp: now };
    }

    // Detect gestures
    const recent = this.history.slice(-10);

    // Nod: pitch (y-axis) oscillates rapidly
    const oscY = this.detectOscillation(recent, 'y', NOD_THRESHOLD, 2);
    if (oscY.detected && oscY.confidence > 0.7) {
      return this.emit('nod', oscY.confidence);
    }

    // Shake: yaw (x-axis) oscillates rapidly
    const oscX = this.detectOscillation(recent, 'x', SHAKE_THRESHOLD, 2);
    if (oscX.detected && oscX.confidence > 0.7) {
      return this.emit('shake', oscX.confidence);
    }

    // Look direction: sustained offset
    const lookDir = this.detectLook(recent);
    if (lookDir !== 'unknown') {
      return this.emit(lookDir, 0.8);
    }

    return { type: 'unknown', confidence: 0, timestamp: now };
  }

  private detectOscillation(
    frames: IMUFrame[],
    axis: 'x' | 'y' | 'z',
    threshold: number,
    minCrossings: number,
  ): { detected: boolean; confidence: number } {
    let crossings = 0;
    let prevDiff = 0;
    let maxAmp = 0;

    for (let i = 1; i < frames.length; i++) {
      const diff = frames[i][axis] - frames[i - 1][axis];
      if (Math.abs(diff) > maxAmp) maxAmp = Math.abs(diff);
      if (prevDiff * diff < 0) crossings++; // Sign change = zero crossing
      prevDiff = diff;
    }

    const confidence = Math.min(crossings / minCrossings, maxAmp / threshold);
    const detected = crossings >= minCrossings && maxAmp > threshold;

    return { detected, confidence };
  }

  private detectLook(frames: IMUFrame[]): GestureType {
    const avgX = frames.reduce((s, f) => s + f.x, 0) / frames.length;
    const avgY = frames.reduce((s, f) => s + f.y, 0) / frames.length;

    if (avgY < -LOOK_THRESHOLD) return 'look-down';
    if (avgX < -LOOK_THRESHOLD) return 'look-left';
    if (avgX > LOOK_THRESHOLD) return 'look-right';

    return 'unknown';
  }

  private emit(type: GestureType, confidence: number): GestureEvent {
    const event: GestureEvent = { type, confidence, timestamp: Date.now() };
    this.lastGesture = event;
    return event;
  }
}
