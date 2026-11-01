import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { go } from './index.ts';
import type { Move, PublicGameState, Seat } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;
const ROOM = 'go/g1';

const place = (row: number, col: number): Move => ({ type: 'place', row, col });
const PASS: Move = { type: 'pass' };
const KO_REFUSED = { error: 'Ko: play elsewhere before retaking' };

// The manager is generic over games, so tests narrow the public state to Go's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function gameOn9(): Manager {
  const manager = rememberingKeys(createGameManager([go]));
  manager.join('go', 'g1', 'A');
  manager.join('go', 'g1', 'B');
  ok(manager.setHouseRules(ROOM, 1, { values: { boardSize: 9 }, maxPlayers: null }));
  agreeAll(manager, ROOM);
  return manager;
}

function moves(manager: Manager, list: [Seat, Move][]): void {
  for (const [seat, move] of list) ok(manager.move(ROOM, seat, move));
}

function toMarking(manager: Manager): PublicGameState {
  moves(manager, [[1, place(4, 4)], [2, place(4, 5)], [1, PASS]]);
  return ok(manager.move(ROOM, 2, PASS));
}

test('a 9x9 game plays to a counted score', () => {
  const manager = gameOn9();
  assert.equal(toMarking(manager).phase, 'marking');
  ok(manager.action(ROOM, 1, { type: 'agree' }));
  const done = ok(manager.action(ROOM, 2, { type: 'agree' }));
  assert.equal(done.isGameOver, true);
  assert.equal(done.winners.length, 1);
  assert.ok(done.score);
});

test('marks and resume are not moves', () => {
  const manager = gameOn9();
  const count = toMarking(manager).moveCount;
  assert.equal(ok(manager.action(ROOM, 1, { type: 'mark', row: 4, col: 5 })).moveCount, count);
  assert.equal(ok(manager.action(ROOM, 2, { type: 'resume' })).moveCount, count);
});

test('the counted end can be undone by vote back to marking', () => {
  const manager = gameOn9();
  toMarking(manager);
  ok(manager.action(ROOM, 1, { type: 'agree' }));
  assert.equal(ok(manager.action(ROOM, 2, { type: 'agree' })).isGameOver, true);
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.isGameOver, false);
  assert.equal(restored.phase, 'marking');
  assert.deepEqual(restored.agreed, [1]);
  assert.equal(restored.score, null);
});

test('an undone ko capture keeps the ko rule as it was', () => {
  const manager = gameOn9();
  // Black B(0,1) (1,0) (2,1) and White (0,2) (2,2) (1,3) surround White's (1,1), which has one liberty at (1,2)
  moves(manager, [
    [1, place(0, 1)], [2, place(0, 2)],
    [1, place(1, 0)], [2, place(2, 2)],
    [1, place(2, 1)], [2, place(1, 3)],
    [1, place(8, 8)], [2, place(1, 1)]
  ]);
  ok(manager.move(ROOM, 1, place(1, 2))); // Black captures (1,1)
  assert.deepEqual(manager.move(ROOM, 2, place(1, 1)), KO_REFUSED);
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  ok(manager.move(ROOM, 1, place(1, 2))); // Black captures again
  assert.deepEqual(manager.move(ROOM, 2, place(1, 1)), KO_REFUSED);
});

test('an undone move after a ko capture still leaves the retake refused', () => {
  const manager = gameOn9();
  moves(manager, [
    [1, place(0, 1)], [2, place(0, 2)],
    [1, place(1, 0)], [2, place(2, 2)],
    [1, place(2, 1)], [2, place(1, 3)],
    [1, place(8, 8)], [2, place(1, 1)],
    [1, place(1, 2)], // Black captures the ko
    [2, place(7, 7)] // White plays elsewhere
  ]);
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  assert.deepEqual(manager.move(ROOM, 2, place(1, 1)), KO_REFUSED);
});

test('resign is an action, not a move', () => {
  const manager = gameOn9();
  moves(manager, [[1, place(4, 4)]]);
  const resigned = ok(manager.action(ROOM, 1, { type: 'resign' }));
  assert.equal(resigned.isGameOver, true);
  assert.deepEqual(resigned.winners, [2]);
  assert.equal(resigned.moveCount, 1);
});
