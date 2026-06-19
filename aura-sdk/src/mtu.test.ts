import {
  BLE_MAX_PAYLOAD_BYTES,
  BLE_PAYLOAD_MTU,
  assertPayloadSize,
  chunkBytes,
  chunkText,
  payloadByteLength,
  validatePayload,
} from './mtu';

describe('MTU verification', () => {
  test('reports byte length for binary and UTF-8 text payloads', () => {
    expect(payloadByteLength(Uint8Array.from([1, 2, 3]))).toBe(3);
    expect(payloadByteLength('مرحبا')).toBeGreaterThan('مرحبا'.length);
  });

  test('chunks binary payloads into BLE-safe writes', () => {
    const chunks = chunkBytes(new Uint8Array(BLE_PAYLOAD_MTU * 2 + 7));
    expect(chunks).toHaveLength(3);
    expect(chunks[0].byteLength).toBe(BLE_PAYLOAD_MTU);
    expect(chunks[1].byteLength).toBe(BLE_PAYLOAD_MTU);
    expect(chunks[2].byteLength).toBe(7);
  });

  test('chunks UTF-8 text by encoded byte length', () => {
    const chunks = chunkText('🙂'.repeat(200));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.byteLength <= BLE_PAYLOAD_MTU)).toBe(true);
  });

  test('warns when a payload needs multiple BLE writes', () => {
    const result = validatePayload(new Uint8Array(BLE_PAYLOAD_MTU + 1), { context: 'frame' });
    expect(result.ok).toBe(true);
    expect(result.chunkCount).toBe(2);
    expect(result.warnings[0]).toContain('2 BLE writes');
  });

  test('rejects payloads above the hard maximum', () => {
    const payload = new Uint8Array(BLE_MAX_PAYLOAD_BYTES + 1);
    expect(() => assertPayloadSize(payload, { context: 'huge frame' })).toThrow(/maximum BLE payload size/);
  });
});
