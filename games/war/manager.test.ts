import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { war } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'war/g1';
const FLIP = { type: 'flip' };

// The same deal on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameWith(seed: number): Manager {
  const manager = createGameManager([war], seeded(seed));
  manager.join('war', 'g1', 'Alice');
  manager.join('war', 'g1', 'Bob');
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

function step(manager: Manager): PublicGameState {
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to flip');
  return ok(manager.move(ROOM, seat, FLIP));
}

test('a seeded game plays to the end and its file has a view per seat', () => {
  const manager = gameWith(1);
  assert.deepEqual(viewOf(manager, null).pileCounts, { 1: 26, 2: 26 });
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 20000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.equal(state.pileCounts[state.winners[0]], 52);

  const file = manager.gameFile('war', 'g1', new Date(0));
  if (!file || 'error' in file) assert.fail('expected a game file');
  const views = file.file.steps[1].views ?? assert.fail('expected views');
  assert.deepEqual(Object.keys(views), ['1', '2']);
  for (const past of manager.history('war', 'g1') as unknown as PublicGameState[]) assert.equal('piles' in past, false);
});

test('a rejoin mid-battle shows the card already turned up', () => {
  const manager = gameWith(2);
  const flipped = step(manager);
  assert.equal(flipped.currentPlayer, 2);
  const up = flipped.battle?.cards[1];
  assert.equal(up?.length, 1);

  manager.disconnect(ROOM, 1);
  const rejoined = manager.join('war', 'g1', 'Alice', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.deepEqual(view.battle?.cards[1], up);
  assert.equal(view.currentPlayer, 2);
  assert.deepEqual(manager.move(ROOM, 1, FLIP), { error: 'Not your turn' });
  const settled = ok(manager.move(ROOM, 2, FLIP));
  assert.equal(settled.lastMove?.playerNumber, 2);
});

test('undo takes back a flip', () => {
  const manager = gameWith(3);
  step(manager);
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  const restored = viewOf(manager, 1);
  assert.equal(restored.battle, null);
  assert.deepEqual(restored.pileCounts, { 1: 26, 2: 26 });
  assert.equal(restored.currentPlayer, 1);
});

test('dismissing a player mid-game ends it and the other player wins', () => {
  const manager = gameWith(4);
  step(manager);
  manager.disconnect(ROOM, 2);
  const state = ok(manager.requestDismiss(ROOM, 1, 2));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});
