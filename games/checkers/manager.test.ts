import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { checkers } from './index.ts';
import type { Move, Position, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const at = (row: number, col: number): Position => ({ row, col });
const move = (...path: Position[]): Move => ({ type: 'move', path });

function gameWith(...names: string[]): Manager {
  const manager = createGameManager([checkers]);
  for (const name of names) manager.join('checkers', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Checkers'
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('moves are validated and recorded for undo', () => {
  const manager = gameWith('A', 'B');
  assert.equal(manager.getState('checkers/g1')?.undoAvailable, false);
  assert.deepEqual(manager.move('checkers/g1', 2, move(at(2, 1), at(3, 0))), { error: 'Not your turn' });
  assert.deepEqual(manager.move('checkers/g1', 3, move(at(5, 0), at(4, 1))), { error: 'You are not in this game' });
  assert.equal(ok(manager.move('checkers/g1', 1, move(at(5, 0), at(4, 1)))).undoAvailable, true);
});

test('a third player cannot join', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.join('checkers', 'g1', 'C'), { error: 'Game is full' });
});

test('a capture can be undone', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move('checkers/g1', 1, move(at(5, 2), at(4, 3))));
  ok(manager.move('checkers/g1', 2, move(at(2, 5), at(3, 4))));
  const captured = ok(manager.move('checkers/g1', 1, move(at(4, 3), at(2, 5))));
  assert.equal(captured.board[3][4], null);

  ok(manager.requestUndo('checkers/g1', 2));
  const restored = ok(manager.voteUndo('checkers/g1', 1, true));
  assert.deepEqual(restored.board[3][4], { seat: 2, king: false });
  assert.deepEqual(restored.board[4][3], { seat: 1, king: false });
  assert.equal(restored.currentPlayer, 1);
});

test('the waiting player can resign, and draw offers are answered, through game actions', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move('checkers/g1', 1, move(at(5, 0), at(4, 1))));
  assert.equal(ok(manager.action('checkers/g1', 1, { type: 'offerDraw' })).drawOffer, 1);
  const declined = ok(manager.action('checkers/g1', 2, { type: 'answerDraw', accept: false }));
  assert.equal(declined.drawOffer, null);
  assert.equal(declined.gameStatus, 'B declined the draw');

  const resigned = ok(manager.action('checkers/g1', 1, { type: 'resign' }));
  assert.equal(resigned.isGameOver, true);
  assert.deepEqual(resigned.winners, [2]);
  assert.equal(resigned.moveCount, 1);
});
