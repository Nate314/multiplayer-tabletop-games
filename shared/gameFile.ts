// The saved-game file a player downloads from a finished game and opens later on the landing page.
import { asRecord } from './messages.ts';
import { MAX_NAME_LENGTH } from './types.ts';
import type { HistoryStep } from './types.ts';

export const GAME_FILE_FORMAT = 'multiplayer-tabletop-games';
export const GAME_FILE_VERSION = 2;

const HISTORY_STEPS = ['start', 'move', 'end'];
const NOT_A_SAVED_GAME = 'This file is not a saved game';

// `views` holds the step as each seat saw it, keyed by seat number; version 1 files have none
export type GameFileStep = HistoryStep & { views?: Record<string, HistoryStep> };

// Uploaded pictures a file's steps show, by image id, as base64, so the file shows them on any server or offline
export type EmbeddedImages = Record<string, { mime: string; data: string }>;

export type GameFile = {
  format: typeof GAME_FILE_FORMAT;
  version: 1 | 2;
  gameType: string;
  gameId: string;
  exportedAt: string;
  steps: GameFileStep[];
  images?: EmbeddedImages;
};

// An image id is 128 random bits in lowercase hex
export const isImageId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{32}$/.test(id);

// Only JPEG and PNG, so a file can never put another kind of data URL in the page
export function isEmbeddedImages(value: unknown): value is EmbeddedImages {
  const images = asRecord(value);
  return images !== null && !Array.isArray(value) && Object.entries(images).every(([id, image]) => {
    const { mime, data } = asRecord(image) ?? {};
    return isImageId(id) && (mime === 'image/jpeg' || mime === 'image/png') && typeof data === 'string';
  });
}

// `images` is left out when there are none, so a file without pictures is as before
export function buildGameFile(gameType: string, gameId: string, steps: GameFileStep[], now: Date, images: EmbeddedImages = {}): GameFile {
  return {
    format: GAME_FILE_FORMAT,
    version: GAME_FILE_VERSION,
    gameType,
    gameId,
    exportedAt: now.toISOString(),
    steps,
    ...(Object.keys(images).length > 0 && { images })
  };
}

export function gameFileName(gameType: string, gameId: string): string {
  return `${gameType}-${gameId}`.replace(/[^A-Za-z0-9_-]/g, '-') + '.json';
}

function isHistoryStep(value: unknown): boolean {
  const step = asRecord(value);
  return !Array.isArray(value) && step !== null && HISTORY_STEPS.includes(step.historyStep as string);
}

function isGameFileStep(value: unknown): boolean {
  if (!isHistoryStep(value)) return false;
  const { views } = value as { views?: unknown };
  if (views === undefined) return true;
  const record = asRecord(views);
  return !Array.isArray(views) && record !== null && Object.values(record).every(isHistoryStep);
}

function isGameFile(value: unknown): value is GameFile {
  const file = asRecord(value);
  if (file === null) return false;
  return (
    file.format === GAME_FILE_FORMAT &&
    (file.version === 1 || file.version === GAME_FILE_VERSION) &&
    typeof file.gameType === 'string' &&
    typeof file.gameId === 'string' &&
    file.gameId.length > 0 &&
    file.gameId.length <= MAX_NAME_LENGTH &&
    typeof file.exportedAt === 'string' &&
    Array.isArray(file.steps) &&
    file.steps.length > 0 &&
    file.steps.every(isGameFileStep) &&
    (file.images === undefined || isEmbeddedImages(file.images))
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
