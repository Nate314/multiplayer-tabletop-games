import { randomInt } from 'node:crypto';
import type { Random } from '../../shared/types.ts';

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
const LETTERS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0, O, 1, I or L, which read alike

// One-use codes that let another device join this device's person. A code is a credential, so the default random
// source is crypto; tests pass their own.
// shortcut: kept in memory, so a restart voids open codes; fine for a 10 minute code
export function createLinkCodes(now: () => number = Date.now, random: Random = () => randomInt(2 ** 32) / 2 ** 32) {
  const open = new Map<string, { hash: string; expiresAt: number }>(); // by the code without its dash

  return {
    issue(hash: string): { code: string; expiresAt: number } {
      for (const [key, entry] of open) if (entry.expiresAt <= now()) open.delete(key);
      let key: string;
      do key = Array.from({ length: 7 }, () => LETTERS[Math.floor(random() * LETTERS.length)]).join('');
      while (open.has(key));
      const expiresAt = now() + LINK_CODE_TTL_MS;
      open.set(key, { hash, expiresAt });
      return { code: `${key.slice(0, 3)}-${key.slice(3)}`, expiresAt };
    },

    // The owner's hash, once; null for an unknown, used or expired code
    redeem(code: unknown): string | null {
      if (typeof code !== 'string') return null;
      const key = code.replaceAll('-', '').toUpperCase();
      const entry = open.get(key);
      open.delete(key);
      return entry && entry.expiresAt > now() ? entry.hash : null;
    }
  };
}

export type LinkCodes = ReturnType<typeof createLinkCodes>;
