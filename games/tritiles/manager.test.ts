import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { legalPlays, stuckMove } from './rules.ts';
import { tritiles } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

const ROOM = 'tritiles/g1';
// A deal where the second player holds nothing that fits the opening tile
const SEED = 2;

// The same deal on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('two seats join and agree, the opener leads, the other draws, and each sees only their own hand', () => {
  const manager = rememberingKeys(createGameManager([tritiles], seeded(SEED)));
  for (const name of ['A', 'B']) manager.join('tritiles', 'g1', name);
  agreeAll(manager, ROOM);

  const table = manager.getState(ROOM, null) as PublicGameState;
  const opener = table.currentPlayer ?? assert.fail('nobody to move');
  const other = opener === 1 ? 2 : 1;
  const view = manager.getState(ROOM, opener) as PublicGameState;
  assert.equal(view.hand.length, 9);
  assert.equal(view.poolCount, 56 - 18);
  const lead = legalPlays(view.board, [view.leadTile ?? assert.fail('no lead tile')])[0];
  ok(manager.move(ROOM, opener, lead));

  const after = manager.getState(ROOM, other) as PublicGameState;
  assert.equal(after.board.length, 1);
  assert.equal(stuckMove(after.board, after.hand, after.poolCount, after.drawsThisTurn), 'draw');
  const drawn = ok(manager.move(ROOM, other, { type: 'draw' }));
  assert.equal(drawn.hand.length, 10);
  assert.equal(drawn.poolCount, 56 - 19);
  assert.equal(drawn.drawsThisTurn, 1);

  for (const seat of [1, 2]) {
    const seen = manager.getState(ROOM, seat) as PublicGameState;
    assert.equal(seen.hand.length, seen.handCounts[seat]);
    for (const key of ['hands', 'pool']) assert.equal(key in seen, false);
  }
  assert.deepEqual((manager.getState(ROOM, null) as PublicGameState).hand, []);
});
