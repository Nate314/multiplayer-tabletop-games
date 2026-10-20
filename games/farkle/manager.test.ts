import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { farkle } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

const ROOM = 'farkle/g1';

// Each value is one die, read in order
function dice(...values: number[]): Random {
  let next = 0;
  return () => (values[next++ % values.length] - 0.5) / 6;
}

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

// Throws: seat 1 rolls 1 5 2 3 4 6 and then 2 3 4 1 on four dice; seat 2 rolls 2 2 3 4 6 6, a farkle
function game() {
  const manager = rememberingKeys(createGameManager([farkle], dice(1, 5, 2, 3, 4, 6, 2, 3, 4, 1, 2, 2, 3, 4, 6, 6)));
  manager.join('farkle', 'g1', 'A');
  manager.join('farkle', 'g1', 'B');
  return manager;
}

test('a short game: roll, set aside, bank, farkle and undo', () => {
  const manager = game();
  assert.equal(ok(manager.move(ROOM, 1, { type: 'roll', keep: [] })).dice.length, 6);
  const kept = ok(manager.move(ROOM, 1, { type: 'roll', keep: [0, 1] }));
  assert.equal(kept.turnTotal, 150);
  assert.deepEqual(kept.setAside, [1, 5]);

  // A refresh mid-turn shows the same half-finished turn
  manager.disconnect(ROOM, 1);
  const rejoined = manager.join('farkle', 'g1', 'A', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.deepEqual(view.dice, kept.dice);
  assert.deepEqual(view.setAside, [1, 5]);
  assert.equal(view.turnTotal, 150);
  assert.equal(view.currentPlayer, 1);

  // Undo takes the set-aside dice back
  ok(manager.requestUndo(ROOM, 2));
  const undone = ok(manager.voteUndo(ROOM, 1, true));
  assert.deepEqual(undone.setAside, []);
  assert.equal(undone.dice.length, 6);

  const banked = ok(manager.move(ROOM, 1, { type: 'bank', keep: [0] }));
  assert.equal(banked.scores[1], 100);
  assert.equal(banked.currentPlayer, 2);

  const farkled = ok(manager.move(ROOM, 2, { type: 'roll', keep: [] }));
  assert.equal(farkled.currentPlayer, 1);
  assert.equal(farkled.scores[2], 0);
  assert.equal(farkled.lastMove?.type === 'roll' && farkled.lastMove.farkle, true);
});
