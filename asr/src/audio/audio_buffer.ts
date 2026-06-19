// Audio packet buffer with sequence numbering, gap detection, and reorder detection.
//
// The Even Hub SDK's AudioEventPayload carries only `audioPcm: Uint8Array` — no
// sequence number, timestamp, or frame identifier from the hardware. PCM chunks
// arrive via the Flutter→WebView bridge and are forwarded directly to the STT
// engine. If BLE drops a packet or the bridge delivers out of order, the STT
// engine sees a seamless concatenated stream with hidden corruption and produces
// garbled output without any error signal.
//
// AudioPacketBuffer wraps every incoming PCM chunk with a sequence number:
//
//   • Application-assigned monotonically increasing counter (default)
//   • Hardware-assigned sequence number when `externalSeq` is passed
//
// When hardware sequence numbers are available (via `externalSeq`), the buffer
// detects:
//
//   • Gaps (seq > expected) — BLE or bridge drops
//   • Reordering (seq < expected) — bridge out-of-order delivery
//   • Duplicates (seq === lastSeq) — repeated delivery
//
// When using the local counter (no externalSeq), the counter is self-consistent
// and detection is naturally dormant — gap/reorder/duplicate cannot occur with a
// self-assigned counter. The `externalSeq` parameter is the API surface for
// future Even SDK hardware sequence fields.

export interface AudioPacket {
  /** Sequence number — application-assigned counter by default, or
   *  hardware-assigned when externalSeq was passed to wrap(). */
  seq: number
  /** Raw PCM s16le data (16 kHz, mono). */
  pcm: Uint8Array
  /** Wall-clock reception timestamp (ms since epoch). */
  receivedAt: number
  /** Milliseconds since the previous packet (0 for the first). */
  deltaMs: number
}

export interface AudioBufferStats {
  packetsReceived: number
  gapsDetected: number
  reordersDetected: number
  duplicatesDetected: number
  bytesReceived: number
  /** Highest accepted sequence number. */
  lastSeq: number
}

export interface GapDetail {
  /** Expected sequence number. */
  expected: number
  /** Sequence number that actually arrived. */
  received: number
  /** Number of missing packets. */
  missing: number
}

/** Callback invoked when the buffer detects a problem. */
export type GapHandler = (detail: GapDetail) => void

export class AudioPacketBuffer {
  private seq = 0
  private lastReceivedAt = 0
  private stats: AudioBufferStats = {
    packetsReceived: 0,
    gapsDetected: 0,
    reordersDetected: 0,
    duplicatesDetected: 0,
    bytesReceived: 0,
    lastSeq: 0,
  }

  private onGap: GapHandler | null

  constructor(onGap?: GapHandler) {
    this.onGap = onGap ?? null
  }

  /**
   * Wrap an incoming PCM chunk with metadata and advance the sequence counter.
   *
   * @param pcm - Raw PCM s16le data.
   * @param externalSeq - Optional hardware-assigned sequence number. When
   *   provided, enables gap/reorder/duplicate detection. When absent, the
   *   buffer assigns its own monotonically increasing counter.
   * @returns The wrapped AudioPacket with sequence metadata.
   */
  wrap(pcm: Uint8Array, externalSeq?: number): AudioPacket {
    const now = Date.now()
    // Use external sequence when available; otherwise auto-increment locally.
    const seq = externalSeq ?? this.seq + 1

    // First packet — no sequence check needed
    if (this.stats.packetsReceived === 0) {
      this.seq = seq
      this.lastReceivedAt = now
      this.stats.packetsReceived = 1
      this.stats.bytesReceived = pcm.byteLength
      this.stats.lastSeq = externalSeq === undefined ? seq : Math.max(this.stats.lastSeq, seq)
      return { seq, pcm, receivedAt: now, deltaMs: 0 }
    }

    const deltaMs = now - this.lastReceivedAt
    const pkt: AudioPacket = { seq, pcm, receivedAt: now, deltaMs }

    // Gap/reorder/duplicate detection — only fires when externalSeq is
    // provided. With a local counter, seq always equals expected and
    // these branches are naturally dormant.
    if (externalSeq !== undefined) {
      const expected = this.stats.lastSeq + 1

      if (seq > expected) {
        // Gap: one or more packets were dropped before this one
        const detail: GapDetail = { expected, received: seq, missing: seq - expected }
        this.stats.gapsDetected++
        this.onGap?.(detail)
      } else if (seq === this.stats.lastSeq) {
        // Duplicate: same seq as the last packet we processed
        this.stats.duplicatesDetected++
      } else if (seq < expected) {
        // Reorder: this packet belongs before one we already processed
        this.stats.reordersDetected++
        this.onGap?.({ expected, received: seq, missing: 0 })
      }
    }

    this.seq = seq
    this.lastReceivedAt = now
    this.stats.packetsReceived++
    this.stats.bytesReceived += pcm.byteLength
    this.stats.lastSeq = externalSeq === undefined ? seq : Math.max(this.stats.lastSeq, seq)

    return pkt
  }

  /** Return a snapshot of the current stream statistics. */
  getStats(): Readonly<AudioBufferStats> {
    return { ...this.stats }
  }

  /** Reset all state for microphone restart lifecycle. */
  reset(): void {
    this.seq = 0
    this.lastReceivedAt = 0
    this.stats = {
      packetsReceived: 0,
      gapsDetected: 0,
      reordersDetected: 0,
      duplicatesDetected: 0,
      bytesReceived: 0,
      lastSeq: 0,
    }
  }
}
