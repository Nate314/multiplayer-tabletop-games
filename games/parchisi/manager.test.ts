import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { NEST } from './rules.ts';
import { parchisi } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'parchisi/g1';
const enter = (pawn: number): Move => ({ type: 'move', pawn, die: 0 });

// Every die comes up 5 then 2, so the second player wins the roll-off and each roll lets a pawn enter
function fiveAndTwo(): Random {
  let index = 0;
  return () => (index++ % 2 === 0 ? 4.5 : 1.5) / 6;
}

function gameWith(...names: string[]): Manager {
  const manager = createGameManager([parchisi], fiveAndTwo());
  for (const name of names) manager.join('parchisi', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Parchisi's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('moves are validated, rolled for, and recorded for undo', () => {
  const manager = gameWith('A', 'B');
  const lobby = manager.getState(ROOM) as PublicGameState;
  assert.deepEqual(lobby.dice.map(die => die.value), [5, 2]);
  assert.equal(lobby.undoAvailable, false);
  assert.deepEqual(manager.move(ROOM, 1, enter(0)), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, 2, { type: 'move', pawn: 0, die: 1 }), { error: 'Invalid move' });

  const entered = ok(manager.move(ROOM, 2, enter(0)));
  assert.equal(entered.undoAvailable, true);
  assert.equal(entered.currentPlayer, 2);
  const passed = ok(manager.move(ROOM, 2, { type: 'move', pawn: 0, die: 1 }));
  assert.equal(passed.currentPlayer, 1);
  assert.deepEqual(passed.dice.map(die => die.value), [5, 2]);
});

test('undo restores the pawns and the dice from before the move', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 2, enter(0)));
  ok(manager.move(ROOM, 2, { type: 'move', pawn: 0, die: 1 }));
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.currentPlayer, 2);
  assert.deepEqual(restored.pawns[2], [0, NEST, NEST, NEST]);
  assert.deepEqual(restored.dice, [{ value: 5, used: true }, { value: 2, used: false }]);
});
