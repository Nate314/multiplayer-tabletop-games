import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { mancala } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

function gameWith(...names: string[]): Manager {
  const manager = createGameManager([mancala]);
  for (const name of names) manager.join('mancala', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Mancala's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('moves are validated and recorded for undo', () => {
  const manager = gameWith('A', 'B');
  assert.equal(manager.getState('mancala/g1')?.undoAvailable, false);
  assert.deepEqual(manager.move('mancala/g1', 2, { pit: 7 }), { error: 'Not your turn' });
  assert.deepEqual(manager.move('mancala/g1', 3, { pit: 0 }), { error: 'You are not in this game' });
  assert.deepEqual(manager.join('mancala', 'g1', 'C'), { error: 'Game is full' });
  assert.equal(ok(manager.move('mancala/g1', 1, { pit: 0 })).undoAvailable, true);
});

test('an extra turn can be undone back to the start', () => {
  const manager = gameWith('A', 'B');
  const extra = ok(manager.move('mancala/g1', 1, { pit: 2 }));
  assert.equal(extra.currentPlayer, 1);

  ok(manager.requestUndo('mancala/g1', 2));
  const restored = ok(manager.voteUndo('mancala/g1', 1, true));
  assert.equal(restored.board[2], 4);
  assert.equal(restored.board[6], 0);
  assert.equal(restored.lastMove, null);
  assert.equal(restored.currentPlayer, 1);
});
