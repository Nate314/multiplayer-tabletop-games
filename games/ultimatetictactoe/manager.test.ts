import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys, stepsOf } from '../../server/testing.ts';
import { ultimatetictactoe } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'ultimatetictactoe/g1';
const place = (board: number, cell: number): Move => ({ type: 'place', board, cell });

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([ultimatetictactoe], () => 0));
  for (const name of names) manager.join('ultimatetictactoe', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to this game's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('a short game with a sent move, then undo restores the forced board', () => {
  const manager = gameWith('A', 'B');
  const first = ok(manager.move(ROOM, 1, place(4, 2)));
  assert.equal(first.forcedBoard, 2);
  assert.equal(first.currentPlayer, 2);
  const second = ok(manager.move(ROOM, 2, place(2, 6)));
  assert.equal(second.forcedBoard, 6);

  ok(manager.requestUndo(ROOM, 1));
  const undone = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(undone.forcedBoard, first.forcedBoard);
  assert.equal(undone.currentPlayer, first.currentPlayer);
  assert.equal(undone.boards[2][6], null);
  assert.deepEqual(undone.lastMove, first.lastMove);
});

test('the history keeps every step', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, place(4, 2)));
  ok(manager.move(ROOM, 2, place(2, 6)));
  const steps = stepsOf(manager, 'ultimatetictactoe') as unknown as PublicGameState[];
  assert.equal(steps.length, 3);
  assert.equal(steps[1].boards[4][2], 1);
  assert.equal(steps[1].boards[2][6], null);
  assert.equal(steps[2].boards[2][6], 2);
});
