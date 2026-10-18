import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { backgammon } from './index.ts';
import { pointIndex } from './rules.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'backgammon/g1';

// Each value is one die, read in order and then repeated
function dice(...values: number[]): Random {
  let next = 0;
  return () => (values[next++ % values.length] - 0.5) / 6;
}

// Seat 1 opens with 3 and 1, every later roll is 6 and 5
function gameWith(...names: string[]): Manager {
  const manager = createGameManager([backgammon], dice(3, 1, 6, 5));
  for (const name of names) manager.join('backgammon', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Backgammon's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

const move = (from: number, to: number): Move => ({ type: 'move', from, to });

test('a third player is refused', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.join('backgammon', 'g1', 'C'), { error: 'Game is full' });
});

test('checker moves are validated and each one is recorded for undo', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.getState(ROOM)?.undoAvailable, false);
  assert.deepEqual(manager.move(ROOM, 2, move(0, 3)), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, 1, move(pointIndex(1, 8), pointIndex(1, 2))), { error: 'Invalid move' });

  const half = ok(manager.move(ROOM, 1, move(pointIndex(1, 8), pointIndex(1, 5))));
  assert.equal(half.undoAvailable, true);
  assert.equal(half.currentPlayer, 1);
  const done = ok(manager.move(ROOM, 1, move(pointIndex(1, 6), pointIndex(1, 5))));
  assert.equal(done.currentPlayer, 2);
  assert.deepEqual(done.dice, [6, 5]);

  ok(manager.requestUndo(ROOM, 2));
  const restored = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(restored.currentPlayer, 1);
  assert.deepEqual(restored.remaining, [1]);
  assert.deepEqual(restored.points[pointIndex(1, 5)], { seat: 1, count: 1 });
});
