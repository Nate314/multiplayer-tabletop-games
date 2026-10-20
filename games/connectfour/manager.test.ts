import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { connectfour } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'connectfour/g1';
const drop = (column: number): Move => ({ type: 'drop', column });

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([connectfour]));
  for (const name of names) manager.join('connectfour', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Connect Four's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('moves are validated and recorded for undo', () => {
  const manager = gameWith('A', 'B');
  assert.equal(manager.getState(ROOM)?.undoAvailable, false);
  assert.deepEqual(manager.move(ROOM, 2, drop(0)), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, 3, drop(0)), { error: 'You are not in this game' });
  assert.deepEqual(manager.move(ROOM, 1, drop(9)), { error: 'Invalid column' });
  assert.equal(ok(manager.move(ROOM, 1, drop(0))).undoAvailable, true);
});

test('a third player cannot join', () => {
  assert.deepEqual(gameWith('A', 'B').join('connectfour', 'g1', 'C'), { error: 'Game is full' });
});

test('a rejoin mid-game shows the discs already dropped and whose turn it is', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, drop(3)));
  ok(manager.move(ROOM, 2, drop(3)));
  manager.disconnect(ROOM, 1);
  const rejoined = manager.join('connectfour', 'g1', 'A', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.equal(view.board[5][3], 1);
  assert.equal(view.board[4][3], 2);
  assert.equal(view.currentPlayer, 1);
  assert.deepEqual(view.lastMove, { playerNumber: 2, row: 4, column: 3 });
});

test('a short game to a win, then undo of the winning drop', () => {
  const manager = gameWith('A', 'B');
  for (const [seat, column] of [[1, 0], [2, 6], [1, 1], [2, 6], [1, 2], [2, 6]] as const) ok(manager.move(ROOM, seat, drop(column)));
  const won = ok(manager.move(ROOM, 1, drop(3)));
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.equal(won.winningLine?.length, 4);

  ok(manager.requestUndo(ROOM, 2));
  const restored = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(restored.isGameOver, false);
  assert.equal(restored.winningLine, null);
  assert.equal(restored.board[5][3], null);
  assert.equal(restored.currentPlayer, 1);
});

test('the waiting player can resign, and draw offers are answered, through game actions', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, drop(0)));
  assert.equal(ok(manager.action(ROOM, 1, { type: 'offerDraw' })).drawOffer, 1);
  assert.equal(ok(manager.action(ROOM, 2, { type: 'answerDraw', accept: false })).drawOffer, null);
  const resigned = ok(manager.action(ROOM, 1, { type: 'resign' }));
  assert.deepEqual(resigned.winners, [2]);
  assert.equal(resigned.moveCount, 1);
});

test('the history keeps the board of every step', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, drop(0)));
  ok(manager.move(ROOM, 2, drop(1)));
  const steps = manager.history('connectfour', 'g1') as unknown as PublicGameState[];
  assert.equal(steps.length, 3);
  assert.equal(steps[1].board[5][0], 1);
  assert.equal(steps[1].board[5][1], null);
});
