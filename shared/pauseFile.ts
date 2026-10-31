import { asRecord } from './messages.ts';
import { gameFileName } from './gameFile.ts';
import { MAX_NAME_LENGTH } from './types.ts';
import type { BasePublicState, HistoryStep, Seat } from './types.ts';

export const PAUSE_FILE_FORMAT = 'multiplayer-tabletop-games-pause';
export const PAUSE_FILE_VERSION = 1;

const NOT_A_PAUSE_FILE = 'This file is not a pause file';
const UNKNOWN_GAME = 'This pause file is for a game this site does not have';

// base64 for iv, tag and data; hex for the rest
export type PauseSeal = {
  iv: string;
  tag: string;
  data: string;
  fingerprint: string;
  shareHashes: Record<Seat, string>;
};

export type PauseRecord = { seal: PauseSeal; shares: Record<Seat, string> };

// `hand` is the seat's own private view, null for a game without one; `table` carries the house rules
export type PauseFile = {
  format: typeof PAUSE_FILE_FORMAT;
  version: 1;
  gameType: string;
  gameId: string;
  pausedAt: string;
  seat: Seat;
  playerName: string;
  players: Record<Seat, string>;
  table: BasePublicState;
  hand: unknown;
  history: HistoryStep[];
  seal: PauseSeal;
  share: string;
};

export type ResumeStatus = {
  gameType: string;
  gameId: string;
  players: { seat: Seat; name: string; ready: boolean }[];
  ready: boolean;
  error: string | null;
};

export type ResumeUpload = ResumeStatus & { seat: Seat; seatKey: string; playerName: string };

export function pauseFileName(gameType: string, gameId: string, playerName: string): string {
  return gameFileName(gameType, `${gameId}-${playerName}-paused`);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  const record = asRecord(value);
  return record !== null && !Array.isArray(value) && Object.values(record).every(item => typeof item === 'string');
}

function isPauseSeal(value: unknown): value is PauseSeal {
  const seal = asRecord(value);
  return (
    seal !== null &&
    [seal.iv, seal.tag, seal.data, seal.fingerprint].every(field => typeof field === 'string') &&
    isStringRecord(seal.shareHashes)
  );
}

function isPauseFile(value: unknown): value is PauseFile {
  const file = asRecord(value);
  if (file === null || Array.isArray(value)) return false;
  const table = asRecord(file.table);
  if (
    file.format !== PAUSE_FILE_FORMAT || file.version !== PAUSE_FILE_VERSION ||
    typeof file.gameType !== 'string' ||
    typeof file.gameId !== 'string' || file.gameId.length === 0 || file.gameId.length > MAX_NAME_LENGTH ||
    typeof file.pausedAt !== 'string' || typeof file.playerName !== 'string' || typeof file.share !== 'string' ||
    !Number.isInteger(file.seat) || !isStringRecord(file.players) ||
    table === null || Array.isArray(file.table) || !Array.isArray(file.history) || !isPauseSeal(file.seal)
  ) return false;
  return Object.hasOwn(file.players, file.seat as number) && file.players[file.seat as number] === file.playerName;
}

// The upload is untrusted text: every field is checked and nothing throws
export function parsePauseFile(text: string, knownGameTypes: readonly string[]): { file: PauseFile } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: NOT_A_PAUSE_FILE };
  }
  if (!isPauseFile(parsed)) return { error: NOT_A_PAUSE_FILE };
  if (!knownGameTypes.includes(parsed.gameType)) return { error: UNKNOWN_GAME };
  return { file: parsed };
}
