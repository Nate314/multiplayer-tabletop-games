import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { chess } from './index.ts';
import type { Move, PublicGameState, Square } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const sq = (name: string): Square => ({ row: 8 - Number(name[1]), col: name.charCodeAt(0) - 'a'.charCodeAt(0) });
const mv = (from: string, to: string): Move => ({ type: 'move', from: sq(from), to: sq(to) });

function gameWith(...names: string[]): Manager {
  const manager = createGameManager([chess]);
  for (const name of names) manager.join('chess', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Chess's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('moves are validated and recorded for undo', () => {
  const manager = gameWith('A', 'B');
  assert.equal(manager.getState('chess/g1')?.undoAvailable, false);
  assert.deepEqual(manager.move('chess/g1', 2, mv('e7', 'e5')), { error: 'Not your turn' });
  assert.deepEqual(manager.move('chess/g1', 3, mv('e2', 'e4')), { error: 'You are not in this game' });
  assert.equal(ok(manager.move('chess/g1', 1, mv('e2', 'e4'))).undoAvailable, true);
});

test('a checkmate can be undone', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move('chess/g1', 1, mv('f2', 'f3')));
  ok(manager.move('chess/g1', 2, mv('e7', 'e5')));
  ok(manager.move('chess/g1', 1, mv('g2', 'g4')));
  const mated = ok(manager.move('chess/g1', 2, mv('d8', 'h4')));
  assert.deepEqual(mated.winners, [2]);

  ok(manager.requestUndo('chess/g1', 1));
  const restored = ok(manager.voteUndo('chess/g1', 2, true));
  assert.equal(restored.isGameOver, false);
  assert.deepEqual(restored.winners, []);
  assert.deepEqual(restored.board[0][3], { color: 'black', type: 'queen' });
  assert.equal(restored.currentPlayer, 2);
});
