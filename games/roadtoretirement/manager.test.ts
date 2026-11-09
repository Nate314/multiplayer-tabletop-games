import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { HAPPY_OLD_AGE } from './checkered.ts';
import { roadtoretirement } from './index.ts';
import type { GameState, Move, PublicGameState, Random, Result } from './types.ts';

type Manager = ReturnType<typeof createGameManager>;
const ROOM = 'roadtoretirement/g1';

// The same spins on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameWith(seed: number, values?: Record<string, string | number>): Manager {
  const manager = rememberingKeys(createGameManager([roadtoretirement], seeded(seed)));
  manager.join('roadtoretirement', 'g1', 'A');
  manager.join('roadtoretirement', 'g1', 'B');
  if (values) ok(manager.setHouseRules(ROOM, 1, { values, maxPlayers: null }));
  agreeAll(manager, ROOM);
  return manager;
}

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

const viewOf = (manager: Manager): PublicGameState => manager.getState(ROOM, null) as PublicGameState;
const rawOf = (manager: Manager): GameState => manager.rawState(ROOM) as unknown as GameState;

// A simple road player: work, the first career offered, no house, the safe road
function roadMove(state: PublicGameState): Move {
  const road = state.road!;
  switch (road.phase) {
    case 'route': return { type: 'route', choice: 'work' };
    case 'career': return { type: 'career', pick: road.offer[0] };
    case 'house': return { type: 'buyHouse', pick: null };
    case 'fork': return { type: 'fork', road: 'safe' };
    default: return { type: 'spin' };
  }
}

// An 1860 player: spin, then step to the option nearest the goal
function checkeredMove(state: PublicGameState): Move {
  const board = state.checkered!;
  if (board.phase === 'spin') return { type: 'spin' };
  const far = (c: { row: number; col: number }) => c.row + (HAPPY_OLD_AGE.col - c.col);
  return { type: 'step', to: [...board.options].sort((a, b) => far(a) - far(b))[0] };
}

function play(manager: Manager, choose: (state: PublicGameState) => Move, before?: () => void): PublicGameState {
  let state = viewOf(manager);
  for (let moves = 0; !state.isGameOver && moves < 20000; moves++) {
    before?.();
    state = ok(manager.move(ROOM, state.currentPlayer ?? assert.fail('nobody to act'), choose(viewOf(manager))));
  }
  return state;
}

test('a short road game plays to retirement', () => {
  const manager = gameWith(3, { length: 'short' });
  const state = play(manager, roadMove);
  assert.ok(state.isGameOver);
  const worths = state.activePlayers.map(seat => state.road!.players[seat].worth!);
  const standings = roadtoretirement.finalStandings!(rawOf(manager));
  assert.equal(standings[0].seat, state.winners[0]);
  assert.equal(state.road!.players[standings[0].seat].worth, Math.max(...worths));
});

test('an 1860 game plays to Happy Old Age', () => {
  const manager = gameWith(4, { board: 'checkered' });
  // Points sit at 50 so that arriving at the goal (worth 50) wins
  const state = play(manager, checkeredMove, () => {
    const board = rawOf(manager).checkered!;
    board.points = Object.fromEntries(Object.keys(board.points).map(seat => [seat, 50]));
  });
  assert.ok(state.isGameOver);
  assert.deepEqual(state.checkered!.pieces[state.winners[0]], HAPPY_OLD_AGE);
});

test('switching the board in the lobby rebuilds the state', () => {
  const manager = rememberingKeys(createGameManager([roadtoretirement], seeded(1)));
  manager.join('roadtoretirement', 'g1', 'A');
  manager.join('roadtoretirement', 'g1', 'B');
  assert.ok(viewOf(manager).road);
  ok(manager.setHouseRules(ROOM, 1, { values: { board: 'checkered' }, maxPlayers: null }));
  assert.ok(viewOf(manager).checkered);
  assert.equal(viewOf(manager).road, null);
  ok(manager.setHouseRules(ROOM, 1, { values: { board: 'road' }, maxPlayers: null }));
  assert.equal(viewOf(manager).checkered, null);
});

test('a spin and a fork choice are undone by vote', () => {
  const manager = gameWith(5);
  let state = viewOf(manager);
  for (let moves = 0; state.road!.phase !== 'fork' && moves < 5000; moves++) {
    state = ok(manager.move(ROOM, state.currentPlayer!, roadMove(state)));
  }
  assert.equal(state.road!.phase, 'fork');
  const { stepsLeft } = state.road!;
  const seat = state.currentPlayer!;
  ok(manager.move(ROOM, seat, { type: 'fork', road: 'fast' }));
  ok(manager.requestUndo(ROOM, seat));
  const restored = ok(manager.voteUndo(ROOM, seat === 1 ? 2 : 1, true));
  assert.equal(restored.road!.phase, 'fork');
  assert.equal(restored.road!.stepsLeft, stepsLeft);
  assert.equal(restored.currentPlayer, seat);
});

test('every step is recorded', () => {
  const manager = gameWith(6);
  for (let n = 1; n <= 6; n++) {
    const state = viewOf(manager);
    ok(manager.move(ROOM, state.currentPlayer!, roadMove(state)));
    assert.equal(stepsOf(manager, 'roadtoretirement')!.length, n + 1);
  }
});
