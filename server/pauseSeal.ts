import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { PauseSeal } from '../shared/pauseFile.ts';
import type { BaseGameState, Seat } from '../shared/types.ts';

export type SealedRoom = { state: BaseGameState; history: BaseGameState[]; timeline: BaseGameState[] };

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
// A crafted small payload must not inflate into a huge buffer.
const MAX_INFLATED_BYTES = 32 * 1024 * 1024;

const subkey = (key: Buffer, info: string) => Buffer.from(hkdfSync('sha256', key, '', info, KEY_BYTES));

// Strict base64: decodes to exactly `bytes` bytes and round-trips, else null.
function decode(text: unknown, bytes: number): Buffer | null {
  if (typeof text !== 'string') return null;
  const buffer = Buffer.from(text, 'base64');
  return buffer.length === bytes && buffer.toString('base64') === text ? buffer : null;
}

export function shareHash(share: string): string {
  return createHash('sha256').update(Buffer.from(share, 'base64')).digest('hex');
}

export function sealRoom(room: SealedRoom, seats: Seat[]): { seal: PauseSeal; shares: Record<Seat, string> } {
  const key = randomBytes(KEY_BYTES);
  const last = Buffer.from(key);
  const shares: Record<Seat, string> = {};
  seats.forEach((seat, index) => {
    if (index === seats.length - 1) return;
    const share = randomBytes(KEY_BYTES);
    for (let i = 0; i < KEY_BYTES; i++) last[i] ^= share[i];
    shares[seat] = share.toString('base64');
  });
  shares[seats[seats.length - 1]] = last.toString('base64');

  const plain = JSON.stringify(room);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', subkey(key, 'pause-encrypt'), iv);
  const data = Buffer.concat([cipher.update(deflateRawSync(plain)), cipher.final()]);
  const fingerprint = createHmac('sha256', subkey(key, 'pause-fingerprint')).update(plain).digest('hex');
  const shareHashes: Record<Seat, string> = {};
  for (const seat of seats) shareHashes[seat] = shareHash(shares[seat]);
  return {
    seal: { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64'), fingerprint, shareHashes },
    shares,
  };
}

// Every failure, hostile input included, is null.
export function openSeal(seal: PauseSeal, shares: Record<Seat, string>): SealedRoom | null {
  try {
    const iv = decode(seal.iv, IV_BYTES);
    const tag = decode(seal.tag, TAG_BYTES);
    const fingerprint = typeof seal.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(seal.fingerprint) ? Buffer.from(seal.fingerprint, 'hex') : null;
    const seats = Object.keys(seal.shareHashes ?? {});
    if (!iv || !tag || !fingerprint || typeof seal.data !== 'string' || seats.length === 0) return null;
    const key = Buffer.alloc(KEY_BYTES);
    for (const seat of seats) {
      const share = decode(shares?.[Number(seat)], KEY_BYTES);
      if (!share) return null;
      for (let i = 0; i < KEY_BYTES; i++) key[i] ^= share[i];
    }
    const decipher = createDecipheriv('aes-256-gcm', subkey(key, 'pause-encrypt'), iv);
    decipher.setAuthTag(tag);
    const deflated = Buffer.concat([decipher.update(Buffer.from(seal.data, 'base64')), decipher.final()]);
    const plain = inflateRawSync(deflated, { maxOutputLength: MAX_INFLATED_BYTES });
    const expected = createHmac('sha256', subkey(key, 'pause-fingerprint')).update(plain).digest();
    if (!timingSafeEqual(expected, fingerprint)) return null;
    return JSON.parse(plain.toString('utf8')) as SealedRoom;
  } catch {
    return null;
  }
}
