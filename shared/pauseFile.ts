import type { Seat } from './types.ts';

// base64 for iv, tag and data; hex for the rest
export type PauseSeal = {
  iv: string;
  tag: string;
  data: string;
  fingerprint: string;
  shareHashes: Record<Seat, string>;
};
