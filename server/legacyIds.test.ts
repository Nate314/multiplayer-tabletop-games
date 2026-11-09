import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renameLegacyGames } from './legacyIds.ts';

test('renameLegacyGames renames stats for every entry and rooms only for saves that still fit', () => {
  const statsCalls: [string, string][] = [];
  const gameCalls: [string, string][] = [];
  const pushCalls: [string, string][] = [];
  renameLegacyGames(
    { renameGameType: (from, to) => (statsCalls.push([from, to]), 0) },
    { renameGameType: (from, to) => (gameCalls.push([from, to]), 0) },
    { renameGameType: (from, to) => (pushCalls.push([from, to]), 0) },
    { oldgame: { id: 'newgame', keepsSaves: true }, oldmap: { id: 'newmap', keepsSaves: false } }
  );
  assert.deepEqual(statsCalls, [['oldgame', 'newgame'], ['oldmap', 'newmap']]);
  assert.deepEqual(gameCalls, [['oldgame', 'newgame']]);
  assert.deepEqual(pushCalls, [['oldgame', 'newgame']]);
});
