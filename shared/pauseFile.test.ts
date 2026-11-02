import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAUSE_FILE_FORMAT, parsePauseFile, pauseFileName, type PauseFile } from './pauseFile.ts';
import type { BasePublicState } from './types.ts';

const NOT_A_PAUSE_FILE = 'This file is not a pause file';

function file(): PauseFile {
  return {
    format: PAUSE_FILE_FORMAT,
    version: 1,
    gameType: 'uno',
    gameId: 'g1',
    pausedAt: '2026-10-31T12:00:00.000Z',
    seat: 1,
    playerName: 'Alice',
    players: { 1: 'Alice', 2: 'Bob' },
    table: { gameId: 'g1' } as BasePublicState,
    hand: null,
    history: [],
    seal: { iv: 'a', tag: 'b', data: 'c', fingerprint: 'd', shareHashes: { 1: 'e', 2: 'f' } },
    share: 'xyz'
  };
}

const parse = (value: unknown) => parsePauseFile(typeof value === 'string' ? value : JSON.stringify(value), ['uno']);

test('parsePauseFile accepts a built file', () => {
  assert.deepEqual(parse(file()), { file: file() });
});

test('parsePauseFile refuses broken files', () => {
  const broken: unknown[] = [
    'not json',
    '[]',
    { ...file(), format: 'other' },
    { ...file(), version: 2 },
    { ...file(), seat: 3 },
    { ...file(), seat: 1.5 },
    { ...file(), playerName: 'Bob' },
    { ...file(), players: { 1: 'Alice', 2: 7 } },
    { ...file(), gameId: '' },
    { ...file(), gameId: 'x'.repeat(21) },
    { ...file(), table: [] },
    { ...file(), history: {} },
    { ...file(), share: 5 },
    { ...file(), seal: { ...file().seal, tag: undefined } },
    { ...file(), seal: { ...file().seal, shareHashes: { 1: 'e', 2: 9 } } },
    { ...file(), seal: null }
  ];
  for (const value of broken) assert.deepEqual(parse(value), { error: NOT_A_PAUSE_FILE }, JSON.stringify(value));
});

test('parsePauseFile refuses an unknown game type', () => {
  assert.deepEqual(parsePauseFile(JSON.stringify(file()), ['chess']), { error: 'This pause file is for a game this site does not have' });
});

test('pauseFileName names the file for its game and player', () => {
  assert.equal(pauseFileName('uno', 'g1', 'Alice'), 'uno-g1-Alice-paused.json');
  assert.equal(pauseFileName('uno', 'g/1', 'A b'), 'uno-g-1-A-b-paused.json');
});

test('parsePauseFile round-trips images and refuses broken ones', () => {
  const images = { '0123456789abcdef0123456789abcdef': { mime: 'image/png', data: 'iVBORw0K' } };
  assert.deepEqual(parse({ ...file(), images }), { file: { ...file(), images } });
  for (const bad of [[], { x: { mime: 'image/png', data: 'iVBO' } }, { '0123456789abcdef0123456789abcdef': { mime: 'image/gif', data: 'R0lG' } },
    { '0123456789abcdef0123456789abcdef': { mime: 'image/png', data: 'iVBO");' } }]) {
    assert.deepEqual(parse({ ...file(), images: bad }), { error: NOT_A_PAUSE_FILE }, JSON.stringify(bad));
  }
});
