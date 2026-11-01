import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys, stepsOf } from '../../server/testing.ts';
import { tictactoe } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'tictactoe/g1';
const place = (cell: number): Move => ({ type: 'place', cell });

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([tictactoe], () => 0));
  for (const name of names) manager.join('tictactoe', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Tic-Tac-Toe's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function playOut(manager: Manager, moves: readonly (readonly [1 | 2, number])[]): PublicGameState {
  let state = ok(manager.move(ROOM, moves[0][0], place(moves[0][1])));
  for (const [seat, cell] of moves.slice(1)) state = ok(manager.move(ROOM, seat, place(cell)));
  return state;
}

const SEAT_1_TOP_ROW = [[1, 0], [2, 3], [1, 1], [2, 4], [1, 2]] as const;

test('a short game to a win, then undo of the winning mark', () => {
  const manager = gameWith('A', 'B');
  const won = playOut(manager, SEAT_1_TOP_ROW);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.deepEqual(won.winningLine, [0, 1, 2]);

  ok(manager.requestUndo(ROOM, 2));
  const restored = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(restored.isGameOver, false);
  assert.equal(restored.winningLine, null);
  assert.equal(restored.board[2], null);
  assert.equal(restored.currentPlayer, 1);
});

test('the history keeps the board of every step', () => {
  const manager = gameWith('A', 'B');
  playOut(manager, [[1, 0], [2, 1]]);
  const steps = stepsOf(manager, 'tictactoe') as unknown as PublicGameState[];
  assert.equal(steps.length, 3);
  assert.equal(steps[1].board[0], 1);
  assert.equal(steps[1].board[1], null);
});

test('a rematch swaps the marks and undo keeps them', () => {
  const manager = gameWith('A', 'B');
  playOut(manager, SEAT_1_TOP_ROW);
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  const second = manager.getState(ROOM) as PublicGameState;
  assert.equal(second.xSeat, 2);
  assert.equal(second.currentPlayer, 2);

  const moved = ok(manager.move(ROOM, 2, place(4)));
  assert.equal(moved.board[4], 2);
  ok(manager.requestUndo(ROOM, 1));
  const undone = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(undone.currentPlayer, 2);
  assert.equal(undone.xSeat, 2);
  assert.ok(undone.board.every(cell => cell === null));
});
