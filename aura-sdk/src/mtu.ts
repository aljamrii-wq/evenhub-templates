/** BLE MTU and payload-size helpers for Even Realities G2 writes. */

export const BLE_ATT_MTU = 251;
export const BLE_COMMAND_OVERHEAD_BYTES = 1;
export const BLE_PAYLOAD_MTU = BLE_ATT_MTU - BLE_COMMAND_OVERHEAD_BYTES;
export const BLE_MAX_PAYLOAD_BYTES = 64 * 1024;

export interface PayloadValidationOptions {
  /** Human-readable payload name for error/warning messages. */
  context?: string;
  /** Usable bytes per BLE write after command/header overhead. */
  mtu?: number;
  /** Absolute payload ceiling. Defaults to a conservative 64 KiB. */
  maxBytes?: number;
}

export interface PayloadValidation {
  ok: boolean;
  context: string;
  byteLength: number;
  mtu: number;
  maxBytes: number;
  chunkCount: number;
  warnings: string[];
}

type PayloadLike = Uint8Array | number[] | ArrayBuffer | string;

export function payloadByteLength(payload: PayloadLike): number {
  if (typeof payload === 'string') return new TextEncoder().encode(payload).byteLength;
  if (payload instanceof ArrayBuffer) return payload.byteLength;
  if (payload instanceof Uint8Array) return payload.byteLength;
  return payload.length;
}

export function toUint8Array(payload: PayloadLike): Uint8Array {
  if (typeof payload === 'string') return new TextEncoder().encode(payload);
  if (payload instanceof Uint8Array) return payload;
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  return Uint8Array.from(payload);
}

export function chunkBytes(payload: PayloadLike, mtu = BLE_PAYLOAD_MTU): Uint8Array[] {
  if (!Number.isInteger(mtu) || mtu <= 0) {
    throw new Error(`Invalid BLE MTU chunk size: ${mtu}`);
  }
  const bytes = toUint8Array(payload);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += mtu) {
    chunks.push(bytes.slice(offset, offset + mtu));
  }
  return chunks;
}

export function chunkText(text: string, mtu = BLE_PAYLOAD_MTU): Uint8Array[] {
  return chunkBytes(new TextEncoder().encode(text), mtu);
}

export function validatePayload(
  payload: PayloadLike,
  options: PayloadValidationOptions = {},
): PayloadValidation {
  const context = options.context ?? 'BLE payload';
  const mtu = options.mtu ?? BLE_PAYLOAD_MTU;
  const maxBytes = options.maxBytes ?? BLE_MAX_PAYLOAD_BYTES;
  const byteLength = payloadByteLength(payload);
  const chunkCount = byteLength === 0 ? 0 : Math.ceil(byteLength / mtu);
  const warnings: string[] = [];

  if (!Number.isInteger(mtu) || mtu <= 0) {
    throw new Error(`Invalid BLE MTU chunk size for ${context}: ${mtu}`);
  }
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`Invalid BLE maximum payload size for ${context}: ${maxBytes}`);
  }
  if (byteLength > mtu) {
    warnings.push(`${context} is ${byteLength} bytes and will require ${chunkCount} BLE writes at ${mtu} bytes/write`);
  }
  if (byteLength > maxBytes) {
    warnings.push(`${context} exceeds maximum BLE payload size (${byteLength} > ${maxBytes} bytes)`);
  }

  return {
    ok: byteLength <= maxBytes,
    context,
    byteLength,
    mtu,
    maxBytes,
    chunkCount,
    warnings,
  };
}

export function assertPayloadSize(
  payload: PayloadLike,
  options: PayloadValidationOptions = {},
): PayloadValidation {
  const validation = validatePayload(payload, options);
  if (!validation.ok) {
    throw new Error(validation.warnings.at(-1) ?? `${validation.context} exceeds BLE payload limit`);
  }
  return validation;
}
