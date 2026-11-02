import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGameFile, gameFileName, parseGameFile } from './gameFile.ts';
import type { GameFileStep } from './gameFile.ts';
import type { HistoryStep } from './types.ts';

const steps = [{ historyStep: 'start' }, { historyStep: 'end' }] as unknown as HistoryStep[];
const notSaved = { error: 'This file is not a saved game' };

test('buildGameFile writes version 2', () => {
  assert.equal(buildGameFile('chess', 'friday', steps, new Date()).version, 2);
});

test('buildGameFile records the format, version and export time', () => {
  const file = buildGameFile('chess', 'friday', steps, new Date('2026-10-18T20:15:00.000Z'));
  assert.deepEqual(file, {
    format: 'multiplayer-tabletop-games',
    version: 2,
    gameType: 'chess',
    gameId: 'friday',
    exportedAt: '2026-10-18T20:15:00.000Z',
    steps
  });
});

test('gameFileName replaces each unsafe character with a dash', () => {
  assert.equal(gameFileName('chess', 'friday'), 'chess-friday.json');
  assert.equal(gameFileName('chess', 'a/b\\c:d e?'), 'chess-a-b-c-d-e-.json');
});

test('parseGameFile reads back a file built by buildGameFile', () => {
  const file = buildGameFile('chess', 'friday', steps, new Date('2026-10-18T20:15:00.000Z'));
  assert.deepEqual(parseGameFile(JSON.stringify(file), ['chess']), { file });
});

test('parseGameFile reads a version 1 file', () => {
  const file = { ...buildGameFile('chess', 'friday', steps, new Date('2026-10-18T20:15:00.000Z')), version: 1 };
  assert.deepEqual(parseGameFile(JSON.stringify(file), ['chess']), { file });
});

test('parseGameFile reads a version 2 file with views', () => {
  const withViews = [
    { historyStep: 'start', views: { '1': { historyStep: 'start' }, '2': { historyStep: 'start' } } },
    { historyStep: 'end' }
  ] as unknown as GameFileStep[];
  const file = buildGameFile('chess', 'friday', withViews, new Date('2026-10-18T20:15:00.000Z'));
  assert.deepEqual(parseGameFile(JSON.stringify(file), ['chess']), { file });
});

test('parseGameFile rejects anything that is not a saved game', () => {
  const valid = buildGameFile('chess', 'friday', steps, new Date('2026-10-18T20:15:00.000Z'));
  const withChange = (change: Record<string, unknown>) => JSON.stringify({ ...valid, ...change });
  const without = (key: string) => {
    const copy: Record<string, unknown> = { ...valid };
    delete copy[key];
    return JSON.stringify(copy);
  };
  const cases = [
    'not json',
    '[]',
    'null',
    withChange({ format: 'other' }),
    withChange({ version: 3 }),
    withChange({ steps: [{ historyStep: 'start', views: [] }] }),
    withChange({ steps: [{ historyStep: 'start', views: { '1': 'x' } }] }),
    withChange({ steps: [{ historyStep: 'start', views: { '1': { historyStep: 'middle' } } }] }),
    without('steps'),
    withChange({ steps: [] }),
    withChange({ steps: [1, null] }),
    withChange({ steps: [[{ historyStep: 'start' }]] }),
    withChange({ steps: [{ historyStep: 'middle' }] }),
    withChange({ steps: [{}] }),
    withChange({ gameId: 42 }),
    withChange({ gameId: '' }),
    withChange({ gameId: 'x'.repeat(21) }),
    withChange({ exportedAt: 1234 }),
    withChange({ gameType: 7 })
  ];
  for (const text of cases) {
    assert.deepEqual(parseGameFile(text, ['chess']), notSaved, text);
  }
});

test('parseGameFile accepts a gameId of exactly 20 characters', () => {
  const file = buildGameFile('chess', 'x'.repeat(20), steps, new Date('2026-10-18T20:15:00.000Z'));
  assert.deepEqual(parseGameFile(JSON.stringify(file), ['chess']), { file });
});

test('parseGameFile rejects a game type the site does not have', () => {
  const file = buildGameFile('go', 'friday', steps, new Date('2026-10-18T20:15:00.000Z'));
  assert.deepEqual(parseGameFile(JSON.stringify(file), ['chess']), {
    error: 'This saved game is for a game this site does not have'
  });
});

test('a version 2 file with reactions parses, and one without still does', () => {
  const reaction = { from: 'A', fromSpectator: false, target: 2, emoji: '😂', at: 1 };
  const withReactions = [{ historyStep: 'start', reactions: [reaction] }, { historyStep: 'end' }] as unknown as HistoryStep[];
  for (const list of [withReactions, steps]) {
    const file = buildGameFile('chess', 'friday', list, new Date('2026-10-18T20:15:00.000Z'));
    assert.deepEqual(parseGameFile(JSON.stringify(file), ['chess']), { file });
  }
});

const ID = '0123456789abcdef0123456789abcdef';
const images = { [ID]: { mime: 'image/jpeg', data: '/9j/4AAQ' } };

test('a built game file round-trips its images, and one without images has no field', () => {
  const file = buildGameFile('chess', 'friday', steps, new Date('2026-10-18T20:15:00.000Z'), images);
  assert.deepEqual(file.images, images);
  assert.deepEqual(parseGameFile(JSON.stringify(file), ['chess']), { file });
  assert.equal('images' in buildGameFile('chess', 'friday', steps, new Date(), {}), false);
});

test('parseGameFile refuses images that are not JPEG or PNG data under an image id', () => {
  const valid = buildGameFile('chess', 'friday', steps, new Date('2026-10-18T20:15:00.000Z'));
  for (const bad of [
    [], 'x', { [ID]: { mime: 'text/html', data: 'PGI+' } }, { [ID]: { mime: 'image/png' } }, { [ID]: null },
    { 'not-an-id': { mime: 'image/png', data: 'iVBO' } },
    { [ID]: { mime: 'image/png', data: 'iVBO"),alert(1)//' } }, { [ID]: { mime: 'image/jpeg', data: '/9j/ 4AA' } }
  ]) {
    assert.deepEqual(parseGameFile(JSON.stringify({ ...valid, images: bad }), ['chess']), notSaved, JSON.stringify(bad));
  }
});
