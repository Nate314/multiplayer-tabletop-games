import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_INFOS } from './infos.ts';
import { GAMES } from './registry.ts';

test('GAME_INFOS lists every registered game\'s own info, in registry order', () => {
  assert.deepEqual(GAME_INFOS.map(i => i.id), GAMES.map(g => g.info.id));
  GAME_INFOS.forEach((info, i) => assert.equal(info, GAMES[i].info, info.id));
});
