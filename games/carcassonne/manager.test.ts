import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { placementOptions, tileFeatures } from './board.ts';
import { carcassonne } from './index.ts';
import { meepleError } from './rules.ts';
import type { PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'carcassonne/g1';

// The same draws on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameWith(seed: number, ...names: string[]): Manager {
  const manager = createGameManager([carcassonne], seeded(seed));
  for (const name of names) manager.join('carcassonne', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Carcassonne's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null = null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// A simple player: the first square and turn that fit, then a meeple on the first free feature
function step(manager: Manager): PublicGameState {
  const state = viewOf(manager);
  const seat = state.currentPlayer ?? assert.fail('nobody to act');
  if (!state.placed) {
    const [option] = placementOptions(state.board, state.currentTile ?? assert.fail('no tile to place'));
    return ok(manager.move(ROOM, seat, { type: 'place', x: option.x, y: option.y, rotation: option.rotations[0] }));
  }
  const tile = state.board[state.board.length - 1].tile;
  const feature = tileFeatures(tile).find(ref => meepleError(state, seat, ref) === null) ?? null;
  return ok(manager.move(ROOM, seat, { type: 'meeple', feature }));
}

test('a rejoin mid-turn shows the placed tile still waiting for its meeple', () => {
  const manager = gameWith(3, 'A', 'B');
  const placed = step(manager);
  assert.equal(placed.placed, true);
  const seat = placed.currentPlayer ?? assert.fail('nobody to act');
  manager.disconnect(ROOM, seat);
  const rejoined = manager.join('carcassonne', 'g1', seat === 1 ? 'A' : 'B', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.equal(view.placed, true);
  assert.equal(view.currentPlayer, seat);
  assert.deepEqual(view.board, placed.board);
  const after = ok(manager.move(ROOM, seat, { type: 'meeple', feature: null }));
  assert.equal(after.placed, false);
  assert.notEqual(after.currentPlayer, seat);
});

test('undo takes back a placed tile', () => {
  const manager = gameWith(5, 'A', 'B');
  const before = viewOf(manager);
  const seat = before.currentPlayer ?? assert.fail('nobody to act');
  step(manager);
  ok(manager.requestUndo(ROOM, seat));
  const restored = ok(manager.voteUndo(ROOM, seat === 1 ? 2 : 1, true));
  assert.deepEqual(restored.board, before.board);
  assert.equal(restored.placed, false);
  assert.equal(restored.currentTile, before.currentTile);
});

test('a seeded game plays to the last tile, and no step shows the draw order', () => {
  const manager = gameWith(7, 'A', 'B', 'C');
  let state = viewOf(manager);
  for (let moves = 0; !state.isGameOver && moves < 400; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.equal(state.board.length + state.discarded.length, 72);
  assert.equal(state.tilesLeft, 0);
  assert.notEqual(state.finalScores, null);
  assert.ok(state.winners.length > 0);

  const steps = manager.history('carcassonne', 'g1') ?? assert.fail('no history');
  assert.ok(steps.length > 100);
  for (const past of steps) {
    assert.equal('drawPile' in past, false);
    assert.equal(typeof (past as unknown as PublicGameState).tilesLeft, 'number');
  }
  const file = manager.gameFile('carcassonne', 'g1', new Date());
  assert.ok(file && 'file' in file);
  assert.equal(JSON.stringify(file).includes('drawPile'), false);
});

test('dismissing the player whose meeple is pending passes the turn on', () => {
  const manager = gameWith(11, 'A', 'B', 'C');
  const placed = step(manager);
  const seat = placed.currentPlayer ?? assert.fail('nobody to act');
  manager.disconnect(ROOM, seat);
  const voters = [1, 2, 3].filter(other => other !== seat);
  ok(manager.requestDismiss(ROOM, voters[0], seat));
  const state = ok(manager.voteDismiss(ROOM, voters[1], true));
  assert.equal(state.activePlayers.includes(seat), false);
  assert.equal(state.placed, false);
  assert.ok(state.currentPlayer !== null && voters.includes(state.currentPlayer));
  assert.notEqual(state.currentTile, null);
  step(manager);
});
