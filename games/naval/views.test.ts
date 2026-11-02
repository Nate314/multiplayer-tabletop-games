import { test } from 'node:test';
import assert from 'node:assert/strict';
import { naval } from './index.ts';
import { applyAction } from './rules.ts';
import { cellName, randomFleet, shipCells } from './fleet.ts';
import { shipsIn } from './testing.ts';
import { seeded } from '../testStates.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import { spectatorView } from '../../shared/spectators.ts';
import { pausePlainParts } from '../../server/pauseFiles.ts';
import type { Cell, GameState, Seat, Ship } from './types.ts';

const FLEETS: Record<Seat, Ship[]> = { 1: randomFleet(seeded(1)), 2: randomFleet(seeded(2)) };
const EVE = { id: 's1', name: 'Eve', tableScreen: false, allowedSeats: [] };
const SQUARE = /\b[A-J](?:10|[1-9])\b/g;

// Alice fires at Bob's ships in order; Bob fires at A1, A2, ... in reading order
const ALICE_TARGETS = FLEETS[2].flatMap(shipCells);
const BOB_TARGETS = Array.from({ length: 100 }, (_, i): Cell => ({ row: Math.floor(i / 10), col: i % 10 }));

function ok(result: { state: GameState } | { error: string }): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function lobby(): GameState {
  let state = naval.createGameState('g1');
  for (const name of ['Alice', 'Bob']) state = ok(addPlayer(naval, state, name));
  return state;
}

const place = (state: GameState, seat: Seat) => ok(applyAction(state, seat, { type: 'place', ships: FLEETS[seat] }));
const fire = (state: GameState, seat: Seat, target: Cell) => ok(applyMove(naval, state, seat, { type: 'fire', targets: [target] }));

// Both fleets placed, then `aliceShots` shots by Alice with Bob answering each one but the last when it wins
function played(aliceShots: number): GameState {
  let state = place(place(lobby(), 1), 2);
  for (let i = 0; i < aliceShots; i++) {
    state = fire(state, 1, ALICE_TARGETS[i]);
    if (!state.isGameOver) state = fire(state, 2, BOB_TARGETS[i]);
  }
  return state;
}

const SUNK_FIRST = FLEETS[2][0].length + 2; // Bob's first ship sunk and one more shot
const STATES: Record<string, GameState> = {
  lobby: lobby(),
  'one placed': place(lobby(), 1),
  'both placed': played(0),
  'mid-game with a sunk ship': played(SUNK_FIRST),
  'one shot from the end': played(ALICE_TARGETS.length - 1)
};
const OVER = played(ALICE_TARGETS.length);

const own = (state: GameState, seat: Seat) => state.fleets[seat] ? FLEETS[seat] : [];

// Every object anywhere in the value with numeric `row` and `col` keys
function cellsIn(value: unknown): Cell[] {
  if (Array.isArray(value)) return value.flatMap(cellsIn);
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const here = typeof record.row === 'number' && typeof record.col === 'number' ? [{ row: record.row, col: record.col }] : [];
  return [...here, ...Object.values(record).flatMap(cellsIn)];
}

test('the game reaches every state', () => {
  assert.equal(STATES['one shot from the end'].isGameOver, false);
  assert.equal(STATES['mid-game with a sunk ship'].shots[1].filter(shot => shot.result === 'sunk').length, 1);
  assert.equal(OVER.isGameOver, true);
  assert.deepEqual(OVER.winners, [1]);
});

test('each seat sees only its own fleet', () => {
  for (const [name, s] of Object.entries(STATES)) {
    for (const seat of [1, 2] as Seat[]) {
      assert.deepEqual(shipsIn(naval.toPublicState(s, false, seat)), own(s, seat), `${name}, seat ${seat}`);
    }
  }
});

test('the table view and History see no fleet before game over', () => {
  for (const [name, s] of Object.entries(STATES)) {
    const view = naval.toPublicState(s, false, null);
    assert.deepEqual(shipsIn(view), [], name);
    assert.equal('fleets' in view, false, name);
  }
});

test('a sunk ship shows only its length', () => {
  const s = STATES['mid-game with a sunk ship'];
  const sunk = new Set(shipCells(FLEETS[2][0]).map(cellName));
  for (const viewer of [null, 1] as (Seat | null)[]) {
    const { shots, lastMove, ...rest } = naval.toPublicState(s, false, viewer);
    assert.deepEqual(cellsIn(rest).filter(cell => sunk.has(cellName(cell))), [], `viewer ${viewer}`);
    const firedBy = new Set(shots[lastMove!.playerNumber].map(cellName));
    assert.ok(cellsIn(lastMove).every(cell => firedBy.has(cellName(cell))));
    const sinking = shots[1].filter(shot => shot.result === 'sunk');
    assert.deepEqual(sinking.map(shot => Object.keys(shot).sort()), [['col', 'result', 'row', 'sunkLength']]);
    assert.equal(sinking[0].sunkLength, FLEETS[2][0].length);
    assert.equal(shots[1].filter(shot => sunk.has(cellName(shot))).length, sunk.size);
  }
});

test('every fleet is revealed at game over', () => {
  for (const viewer of [null, 1, 2] as (Seat | null)[]) {
    assert.deepEqual(naval.toPublicState(OVER, false, viewer).revealed, FLEETS, `viewer ${viewer}`);
  }
});

test('a spectator sees a fleet only with permission', () => {
  for (const [name, s] of Object.entries(STATES)) {
    assert.deepEqual(shipsIn(spectatorView(naval, s, EVE)), [], name);
    assert.deepEqual(shipsIn(spectatorView(naval, s, { ...EVE, allowedSeats: [1] })), own(s, 1), name);
    assert.deepEqual(shipsIn(spectatorView(naval, s, { ...EVE, tableScreen: true })), [], name);
  }
});

test("a pause file holds only its own seat's fleet", () => {
  for (const [name, s] of Object.entries(STATES)) {
    assert.deepEqual(shipsIn(pausePlainParts(naval, { state: s, history: [], timeline: [s] }, 2)), own(s, 2), name);
  }
});

test('no status, last move or refusal names a ship square', () => {
  const refusals: string[] = [];
  const refuse = (result: { state: GameState } | { error: string }) => {
    assert.ok('error' in result, 'expected a refusal');
    refusals.push(result.error);
  };
  const fired: Record<Seat, Set<string>> = { 1: new Set(), 2: new Set() };
  const check = (s: GameState) => {
    const named = new Set([...fired[1], ...fired[2]]);
    for (const square of s.gameStatus.match(SQUARE) ?? []) assert.ok(named.has(square), `${s.gameStatus} names ${square}`);
    for (const cell of cellsIn(s.lastMove)) assert.ok(fired[s.lastMove!.playerNumber].has(cellName(cell)), cellName(cell));
  };

  let s = lobby();
  refuse(applyMove(naval, s, 1, { type: 'fire', targets: [ALICE_TARGETS[0]] }));
  s = place(s, 1);
  refuse(applyAction(s, 1, { type: 'place', ships: FLEETS[1] }));
  refuse(applyAction(s, 2, { type: 'place', ships: FLEETS[2].slice(1) }));
  refuse(applyAction(s, 2, { type: 'place', ships: [...FLEETS[2].slice(0, 4), { ...FLEETS[2][0], length: 2 }] }));
  refuse(applyAction(s, 2, { type: 'place', ships: FLEETS[2].map(ship => ({ ...ship, row: 9, col: 9 })) }));
  refuse(applyMove(naval, s, 1, { type: 'fire', targets: [ALICE_TARGETS[0]] }));
  s = place(s, 2);
  check(s);
  for (let i = 0; i < ALICE_TARGETS.length; i++) {
    refuse(applyMove(naval, s, 2, { type: 'fire', targets: [BOB_TARGETS[i]] }));
    refuse(applyMove(naval, s, 1, { type: 'fire', targets: [ALICE_TARGETS[i], ALICE_TARGETS[i + 1] ?? BOB_TARGETS[0]] }));
    refuse(applyMove(naval, s, 1, { type: 'fire', targets: [{ row: 10, col: 0 }] }));
    if (i > 0) refuse(applyMove(naval, s, 1, { type: 'fire', targets: [ALICE_TARGETS[i - 1]] }));
    s = fire(s, 1, ALICE_TARGETS[i]);
    fired[1].add(cellName(ALICE_TARGETS[i]));
    check(s);
    if (s.isGameOver) break;
    s = fire(s, 2, BOB_TARGETS[i]);
    fired[2].add(cellName(BOB_TARGETS[i]));
    check(s);
  }
  assert.equal(s.isGameOver, true);
  refuse(applyMove(naval, s, 2, { type: 'fire', targets: [BOB_TARGETS[50]] }));
  refuse(applyAction(s, 2, { type: 'resign' }));
  for (const refusal of refusals) assert.equal(refusal.match(SQUARE), null, refusal);
});
