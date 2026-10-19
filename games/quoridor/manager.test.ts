import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { quoridor } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const step = (row: number, col: number): Move => ({ type: 'move', row, col });

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([quoridor]));
  for (const name of names) manager.join('quoridor', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Quoridor's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('moves are validated and recorded for undo', () => {
  const manager = gameWith('A', 'B');
  assert.equal(manager.getState('quoridor/g1')?.undoAvailable, false);
  assert.deepEqual(manager.move('quoridor/g1', 2, step(1, 4)), { error: 'Not your turn' });
  assert.deepEqual(manager.move('quoridor/g1', 3, step(1, 4)), { error: 'You are not in this game' });
  assert.deepEqual(manager.move('nope', 1, step(7, 4)), { error: 'Game not found' });
  assert.equal(ok(manager.move('quoridor/g1', 1, step(7, 4))).undoAvailable, true);
});

test('the winning move can be undone', () => {
  const manager = gameWith('A', 'B');
  let p2Col = 4;
  for (let row = 7; row >= 1; row--) {
    ok(manager.move('quoridor/g1', 1, step(row, 4)));
    p2Col = p2Col === 4 ? 3 : 4;
    ok(manager.move('quoridor/g1', 2, step(0, p2Col)));
  }
  const won = ok(manager.move('quoridor/g1', 1, step(0, 4)));
  assert.deepEqual(won.winners, [1]);

  ok(manager.requestUndo('quoridor/g1', 2));
  const restored = ok(manager.voteUndo('quoridor/g1', 1, true));
  assert.equal(restored.isGameOver, false);
  assert.deepEqual(restored.winners, []);
  assert.deepEqual(restored.pawns[1], { row: 1, col: 4 });
  assert.equal(restored.currentPlayer, 1);
});
