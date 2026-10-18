// The saved-game file a player downloads from a finished game and opens later on the landing page.
import { asRecord } from './messages.ts';
import type { HistoryStep } from './types.ts';

export const GAME_FILE_FORMAT = 'multiplayer-tabletop-games';
export const GAME_FILE_VERSION = 1;

const MAX_GAME_ID_LENGTH = 20; // matches the game ID limit in server/games.ts
const HISTORY_STEPS = ['start', 'move', 'end'];
const NOT_A_SAVED_GAME = 'This file is not a saved game';

export type GameFile = {
  format: typeof GAME_FILE_FORMAT;
  version: typeof GAME_FILE_VERSION;
  gameType: string;
  gameId: string;
  exportedAt: string;
  steps: HistoryStep[];
};

export function buildGameFile(gameType: string, gameId: string, steps: HistoryStep[], now: Date): GameFile {
  return {
    format: GAME_FILE_FORMAT,
    version: GAME_FILE_VERSION,
    gameType,
    gameId,
    exportedAt: now.toISOString(),
    steps
  };
}

export function gameFileName(gameType: string, gameId: string): string {
  return `${gameType}-${gameId}`.replace(/[^A-Za-z0-9_-]/g, '-') + '.json';
}

function isHistoryStep(value: unknown): boolean {
  const step = asRecord(value);
  return !Array.isArray(value) && step !== null && HISTORY_STEPS.includes(step.historyStep as string);
}

function isGameFile(value: unknown): value is GameFile {
  const file = asRecord(value);
  if (file === null) return false;
  return (
    file.format === GAME_FILE_FORMAT &&
    file.version === GAME_FILE_VERSION &&
    typeof file.gameType === 'string' &&
    typeof file.gameId === 'string' &&
    file.gameId.length > 0 &&
    file.gameId.length <= MAX_GAME_ID_LENGTH &&
    typeof file.exportedAt === 'string' &&
    Array.isArray(file.steps) &&
    file.steps.length > 0 &&
    file.steps.every(isHistoryStep)
  );
}

export function parseGameFile(text: string, knownGameTypes: readonly string[]): { file: GameFile } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: NOT_A_SAVED_GAME };
  }
  if (!isGameFile(value)) return { error: NOT_A_SAVED_GAME };
  if (!knownGameTypes.includes(value.gameType)) {
    return { error: 'This saved game is for a game this site does not have' };
  }
  return { file: value };
}
