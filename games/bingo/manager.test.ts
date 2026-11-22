import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { bingo } from './index.ts';
import { createGameState, FINAL_WINDOW_MS, PLACE_WINDOW_MS, resumeClock } from './rules.ts';
import type { Card, GameState, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'bingo/g1';
const CALL = { type: 'call' };
const BINGO = { type: 'bingo' };

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

// Column B holds 1..5, so squares 0, 5, 10, 15 and 20 are a Line once those are called
const FIXED: Card = Array.from({ length: 25 }, (_, i) => (i % 5) * 15 + Math.floor(i / 5) + 1);
FIXED[12] = 0;
const LINE_SQUARES = [0, 5, 10, 15, 20];

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

const viewOf = (manager: Manager): PublicGameState => manager.getState(ROOM, null) as PublicGameState;
const rawOf = (manager: Manager): GameState => manager.rawState(ROOM) as GameState;

// Every seat holds the fixed card, 1 to 4 are out and 5 is the next call, so 5 completes the Line
function startedGame(names: string[], playUntil: number): Manager {
  const manager = rememberingKeys(createGameManager([bingo], seeded(1)));
  for (const name of names) manager.join('bingo', 'g1', name);
  ok(manager.setHouseRules(ROOM, 1, { values: { playUntil }, maxPlayers: null }));
  agreeAll(manager, ROOM);
  const state = rawOf(manager);
  const called = [1, 2, 3, 4];
  assert.ok(manager.replaceState(ROOM, {
    ...state,
    called,
    pool: [5, ...state.pool.filter(n => n > 5 || n < 1)],
    cards: Object.fromEntries(state.activePlayers.map(seat => [seat, [FIXED]])),
    marks: Object.fromEntries(state.activePlayers.map(seat => [seat, [[]]]))
  } as GameState));
  return manager;
}

const callNext = (manager: Manager): PublicGameState => ok(manager.move(ROOM, viewOf(manager).currentPlayer!, CALL));

function markLine(manager: Manager, seat: number): void {
  for (const square of LINE_SQUARES) ok(manager.action(ROOM, seat, { type: 'mark', card: 0, square }));
}

test('undo of a call reshuffles and takes back later places', () => {
  const manager = startedGame(['A', 'B'], 2);
  callNext(manager); // 5
  markLine(manager, 1);
  ok(manager.action(ROOM, 1, BINGO));
  assert.equal(viewOf(manager).places[1], 1);
  callNext(manager); // closes place 1
  const before = rawOf(manager).pool;
  const next = rawOf(manager).called.at(-1)!;

  for (const voter of [1, 2]) {
    ok(manager.requestUndo(ROOM, voter === 1 ? 2 : 1));
    ok(manager.voteUndo(ROOM, voter, true));
  }
  const after = viewOf(manager);
  assert.deepEqual(after.places, {});
  assert.equal(after.openPlace, null);
  assert.deepEqual(after.called, [1, 2, 3, 4, 5]);
  const pool = rawOf(manager).pool;
  assert.deepEqual([...pool].sort((a, b) => a - b), [next, ...before].sort((a, b) => a - b));
  assert.notDeepEqual(pool, [next, ...before]);
});

test('a mark is never an undo step', () => {
  const manager = startedGame(['A', 'B'], 1);
  callNext(manager);
  callNext(manager);
  ok(manager.action(ROOM, 1, { type: 'mark', card: 0, square: 0 }));
  ok(manager.requestUndo(ROOM, 2));
  const undone = ok(manager.voteUndo(ROOM, 1, true));
  assert.deepEqual(undone.called, [1, 2, 3, 4, 5]);
  assert.deepEqual(undone.marks[1], [[]]);
});

test('resumeClock restarts an open window', () => {
  const now = 5_000_000;
  const open = { ...createGameState('g'), openPlace: { place: 1, closesAt: now - 1000 } };
  assert.equal(resumeClock(open, now).openPlace?.closesAt, now + PLACE_WINDOW_MS);
  const final = { ...createGameState('g'), finalUntil: now - 1000 };
  assert.equal(resumeClock(final, now).finalUntil, now + FINAL_WINDOW_MS);
});

test('a player leaving keeps the game going', () => {
  const manager = startedGame(['A', 'B', 'C'], 1);
  callNext(manager);
  assert.equal(viewOf(manager).currentPlayer, 2);
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  const state = ok(manager.voteDismiss(ROOM, 3, true));
  assert.deepEqual(state.activePlayers, [1, 3]);
  assert.equal(state.currentPlayer, 3);
  assert.equal(callNext(manager).currentPlayer, 1);
  assert.equal(viewOf(manager).isGameOver, false);
});

test('a placed player leaving keeps their place', () => {
  const manager = startedGame(['A', 'B', 'C'], 1);
  callNext(manager); // 5
  markLine(manager, 1);
  markLine(manager, 2);
  ok(manager.action(ROOM, 1, BINGO));
  manager.disconnect(ROOM, 1);
  ok(manager.requestDismiss(ROOM, 2, 1));
  ok(manager.voteDismiss(ROOM, 3, true));
  const shared = ok(manager.action(ROOM, 2, BINGO));
  assert.deepEqual(shared.places, { 1: 1, 2: 1 });
  const over = callNext(manager);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [1, 2]);
});
