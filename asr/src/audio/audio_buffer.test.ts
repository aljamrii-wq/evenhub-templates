import { describe, expect, it, vi } from 'vitest'
import { AudioPacketBuffer, type GapDetail } from './audio_buffer'

const pcm = (byteLength = 4) => new Uint8Array(byteLength)

describe('AudioPacketBuffer', () => {
  it('assigns local sequence numbers without reporting transport anomalies', () => {
    const gaps: GapDetail[] = []
    const buffer = new AudioPacketBuffer(gap => gaps.push(gap))

    expect(buffer.wrap(pcm()).seq).toBe(1)
    expect(buffer.wrap(pcm(2)).seq).toBe(2)

    expect(buffer.getStats()).toMatchObject({
      packetsReceived: 2,
      gapsDetected: 0,
      reordersDetected: 0,
      duplicatesDetected: 0,
      bytesReceived: 6,
      lastSeq: 2,
    })
    expect(gaps).toEqual([])
  })

  it('reports missing external sequence numbers as gaps', () => {
    const gaps: GapDetail[] = []
    const buffer = new AudioPacketBuffer(gap => gaps.push(gap))

    buffer.wrap(pcm(), 10)
    buffer.wrap(pcm(), 13)

    expect(buffer.getStats()).toMatchObject({
      gapsDetected: 1,
      reordersDetected: 0,
      duplicatesDetected: 0,
      lastSeq: 13,
    })
    expect(gaps).toEqual([{ expected: 11, received: 13, missing: 2 }])
  })

  it('reports reordered external packets without moving the high-water sequence backward', () => {
    const gaps: GapDetail[] = []
    const buffer = new AudioPacketBuffer(gap => gaps.push(gap))

    buffer.wrap(pcm(), 1)
    buffer.wrap(pcm(), 3)
    buffer.wrap(pcm(), 2)
    buffer.wrap(pcm(), 4)

    expect(buffer.getStats()).toMatchObject({
      gapsDetected: 1,
      reordersDetected: 1,
      duplicatesDetected: 0,
      lastSeq: 4,
    })
    expect(gaps).toEqual([
      { expected: 2, received: 3, missing: 1 },
      { expected: 4, received: 2, missing: 0 },
    ])
  })

  it('reports duplicate external packets separately from reordered packets', () => {
    const gaps: GapDetail[] = []
    const buffer = new AudioPacketBuffer(gap => gaps.push(gap))

    buffer.wrap(pcm(), 7)
    buffer.wrap(pcm(), 7)

    expect(buffer.getStats()).toMatchObject({
      gapsDetected: 0,
      reordersDetected: 0,
      duplicatesDetected: 1,
      lastSeq: 7,
    })
    expect(gaps).toEqual([])
  })

  it('records packet timing deltas', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1_000)
      const buffer = new AudioPacketBuffer()

      expect(buffer.wrap(pcm()).deltaMs).toBe(0)

      vi.setSystemTime(1_120)

      expect(buffer.wrap(pcm()).deltaMs).toBe(120)
    } finally {
      vi.useRealTimers()
    }
  })
})
