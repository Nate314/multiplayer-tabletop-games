import { createHash } from 'node:crypto';

// Only this hash is ever kept; null for anything that is not a device ID
export function hashDeviceId(raw: unknown): string | null {
  return typeof raw === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(raw) ? createHash('sha256').update(raw).digest('hex') : null;
}
