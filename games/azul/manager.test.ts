import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { azul } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'azul/g1';
const acknowledge = { type: 'acknowledgeRound' };

function gameWith(...names: string[]): Manager {
  const manager = createGameManager([azul]);
  for (const name of names) manager.join('azul', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Azul's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function current(manager: Manager): PublicGameState {
  const state = manager.getState(ROOM);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// A move that is always legal: one colour from the first pile with tiles, to the floor
function anyMove(state: PublicGameState): Move {
  const index = state.factories.findIndex(tiles => tiles.length > 0);
  if (index < 0) return { source: { type: 'center' }, color: state.center[0], line: 'floor' };
  return { source: { type: 'factory', index }, color: state.factories[index][0], line: 'floor' };
}

// Plays legal moves, in turn, until the round has been scored
function playRound(manager: Manager): PublicGameState {
  let state = current(manager);
  while (!state.roundSummary) {
    if (state.currentPlayer === null) assert.fail('nobody to move');
    state = ok(manager.move(ROOM, state.currentPlayer, anyMove(state)));
  }
  return state;
}

test('what browsers receive never includes the bag or the lid', () => {
  const manager = createGameManager([azul]);
  const first = manager.join('azul', 'g1', 'A');
  const second = manager.join('azul', 'g1', 'B');
  if ('error' in first || 'error' in second) assert.fail('join failed');
  const afterMove = ok(manager.move(ROOM, 1, anyMove(second.state as PublicGameState)));
  const three = gameWith('A', 'B', 'C').leave(ROOM, 3);
  assert.ok(three, 'expected the game to still exist');
  for (const state of [first.state, second.state, afterMove, three.state, current(manager)]) {
    assert.equal('bag' in state, false);
    assert.equal('lid' in state, false);
  }
  assert.equal((second.state as PublicGameState).factories.length, 5);
});

test('moves are validated', () => {
  const manager = gameWith('A', 'B');
  const move = anyMove(current(manager));
  assert.deepEqual(manager.move('nope', 1, move), { error: 'Game not found' });
  assert.deepEqual(manager.move(ROOM, 3, move), { error: 'You are not in this game' });
  assert.deepEqual(manager.move(ROOM, 2, move), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, 1, { nonsense: true }), { error: 'Invalid move' });
  assert.deepEqual(manager.move(ROOM, 1, null), { error: 'Invalid move' });

  const state = ok(manager.move(ROOM, 1, move));
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.started, true);
  assert.deepEqual(state.factories[0], []);
  assert.deepEqual(current(manager), state);
});

test('leaving mid-game hands the win to the last player', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, anyMove(current(manager))));
  const left = manager.leave(ROOM, 2);
  assert.ok(left, 'expected the game to still exist');
  const state = left.state as PublicGameState;
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.deepEqual(manager.move(ROOM, 1, anyMove(state)), { error: 'The game is over' });
});

test('the next round waits for every player to acknowledge the summary', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.action(ROOM, 1, acknowledge), { error: 'Nothing to continue' });

  const scored = playRound(manager);
  assert.equal(scored.round, 1);
  assert.equal(scored.currentPlayer, null);
  assert.deepEqual(Object.keys(scored.roundSummary?.seats ?? {}), ['1', '2']);
  assert.deepEqual(manager.action(ROOM, 3, acknowledge), { error: 'You are not in this game' });

  const waiting = ok(manager.action(ROOM, 1, acknowledge));
  assert.deepEqual(waiting.roundSummary?.acknowledged, [1]);
  assert.equal(waiting.round, 1);

  const next = ok(manager.action(ROOM, 2, acknowledge));
  assert.equal(next.roundSummary, null);
  assert.equal(next.round, 2);
  assert.equal(next.factories.flat().length, 20);
  assert.equal('bag' in next, false);
});

test('undoing the move that ended a round brings the round back', () => {
  const manager = gameWith('A', 'B');
  const scored = playRound(manager);
  assert.ok(scored.roundSummary);
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.roundSummary, null);
  assert.equal(restored.round, 1);
  assert.notEqual(restored.currentPlayer, null);
  assert.ok(restored.center.length + restored.factories.flat().length > 0);

  // And after the next round has been dealt
  playRound(manager);
  ok(manager.action(ROOM, 1, acknowledge));
  assert.equal(ok(manager.action(ROOM, 2, acknowledge)).round, 2);
  ok(manager.requestUndo(ROOM, 2));
  const back = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(back.round, 1);
  assert.equal(back.roundSummary, null);
  assert.equal(playRound(manager).round, 1);
});

test('an unknown action is refused', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.action(ROOM, 1, { type: 'nonsense' }), { error: 'Unknown action' });
  assert.deepEqual(manager.action(ROOM, 1, null), { error: 'Unknown action' });
});
