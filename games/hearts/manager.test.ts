import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { playError } from './rules.ts';
import { hearts } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'hearts/g1';
const NAMES = ['A', 'B', 'C', 'D'];

function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([hearts], seeded(1)));
  for (const name of names) manager.join('hearts', 'g1', name);
  return manager;
}

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// One step: everyone continues after a hand, or the next player who has not passed passes their first three cards,
// or the current player plays their first legal card
function step(manager: Manager): PublicGameState {
  const state = viewOf(manager, null);
  if (state.roundSummary) {
    for (const seat of state.activePlayers) ok(manager.action(ROOM, seat, { type: 'acknowledgeRound' }));
    return viewOf(manager, null);
  }
  if (state.phase === 'passing') {
    const seat = state.activePlayers.find(other => !state.passed.includes(other)) ?? assert.fail('everyone passed');
    return ok(manager.action(ROOM, seat, { type: 'pass', cards: [0, 1, 2] }));
  }
  const seat = state.currentPlayer ?? assert.fail('nobody to move');
  const { hand } = viewOf(manager, seat);
  const card = hand.find(held => playError(hand, held, state) === null) ?? assert.fail(`seat ${seat} has nothing to play`);
  return ok(manager.move(ROOM, seat, { type: 'play', card }));
}

test('the pass waits for four players, and the first pass locks the seats', () => {
  const manager = gameWith('A', 'B', 'C');
  assert.deepEqual(manager.action(ROOM, 1, { type: 'pass', cards: [0, 1, 2] }), { error: 'Waiting for more players' });
  manager.join('hearts', 'g1', 'D');
  assert.equal(viewOf(manager, 1).hand.length, 13);
  assert.equal(viewOf(manager, null).started, false);
  step(manager);
  assert.equal(viewOf(manager, null).started, true);
  assert.equal('error' in manager.join('hearts', 'g1', 'E'), true);
});

test('a short game: each player sees only their own hand, the table sees none', () => {
  const manager = gameWith(...NAMES);
  // The pass and two tricks
  for (let i = 0; i < 4 + 8; i++) step(manager);
  const views = [1, 2, 3, 4].map(seat => viewOf(manager, seat));
  views.forEach((view, index) => assert.equal(view.hand.length, view.handCounts[index + 1]));
  assert.notDeepEqual(views[0].hand, views[1].hand);
  const history = manager.history('hearts', 'g1') as unknown as PublicGameState[];
  assert.equal(history.length, 9);
  for (const state of [...history, viewOf(manager, null)]) {
    assert.deepEqual(state.hand, []);
    assert.deepEqual(state.myPass, []);
    for (const key of ['hands', 'passes']) assert.equal(key in state, false);
  }
});

test('a rejoin mid-trick and mid-pass shows the same half-finished turn', () => {
  const manager = gameWith(...NAMES);
  for (let i = 0; i < 4 + 2; i++) step(manager);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const before = viewOf(manager, seat);
  assert.equal(before.trick.length, 2);
  manager.disconnect(ROOM, seat);
  const back = manager.join('hearts', 'g1', NAMES[seat - 1], true);
  if ('error' in back) assert.fail(back.error);
  const after = back.state as PublicGameState;
  assert.deepEqual(after.hand, before.hand);
  assert.deepEqual(after.trick, before.trick);
  assert.equal(after.currentPlayer, seat);

  // Play out the hand and into the second hand's pass, where seat 1 has passed
  while (viewOf(manager, null).phase !== 'passing') step(manager);
  step(manager);
  const passing = viewOf(manager, 1);
  assert.equal(passing.myPass.length, 3);
  manager.disconnect(ROOM, 1);
  const again = manager.join('hearts', 'g1', 'A', true);
  if ('error' in again) assert.fail(again.error);
  const view = again.state as PublicGameState;
  assert.deepEqual(view.myPass, passing.myPass);
  assert.deepEqual(view.hand, passing.hand);
  assert.deepEqual(view.passed, [1]);
});

test('a rejoin after passing in the first hand keeps the seat and the pass', () => {
  const manager = gameWith(...NAMES);
  step(manager);
  const before = viewOf(manager, 1);
  assert.equal(before.myPass.length, 3);
  manager.disconnect(ROOM, 1);
  assert.deepEqual(viewOf(manager, null).disconnected, [1]);
  const back = manager.join('hearts', 'g1', 'A', true);
  if ('error' in back) assert.fail(back.error);
  const after = back.state as PublicGameState;
  assert.deepEqual(after.myPass, before.myPass);
  assert.deepEqual(after.hand, before.hand);
  assert.deepEqual(after.passed, [1]);
  // A started game with no moves yet has a one-step history with no cards in it
  const history = manager.history('hearts', 'g1') as unknown as PublicGameState[];
  assert.equal(history.length, 1);
  assert.deepEqual(history[0].hand, []);
  assert.deepEqual(history[0].myPass, []);
});

test('undo restores the trick', () => {
  const manager = gameWith(...NAMES);
  for (let i = 0; i < 4 + 1; i++) step(manager);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  step(manager);
  ok(manager.requestUndo(ROOM, seat));
  for (const other of [1, 2, 3, 4].filter(s => s !== seat)) manager.voteUndo(ROOM, other, true);
  const restored = viewOf(manager, null);
  assert.equal(restored.currentPlayer, seat);
  assert.equal(restored.trick.length, 1);
});

test('a whole game played with legal moves ends when someone reaches 100', () => {
  const manager = gameWith(...NAMES);
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 20000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.ok(Math.max(...Object.values(state.scores)) >= 100);
  const low = Math.min(...Object.values(state.scores));
  assert.deepEqual(state.winners, [1, 2, 3, 4].filter(seat => state.scores[seat] === low));
  assert.ok(state.handNumber > 1);
  const file = manager.gameFile('hearts', 'g1', new Date());
  assert.ok(file && 'file' in file);
});

test('dismissing a player mid-game ends it and the lowest score wins', () => {
  const manager = gameWith(...NAMES);
  for (let i = 0; i < 5; i++) step(manager);
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.voteDismiss(ROOM, 3, true));
  const state = ok(manager.voteDismiss(ROOM, 4, true));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1, 3, 4]);
});
