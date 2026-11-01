import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreeToHouseRules, setHouseRules, type HouseRuleValues } from '../../shared/houseRules.ts';
import { addPlayer } from '../../shared/seating.ts';
import { spectatorView } from '../../shared/spectators.ts';
import { seeded } from '../testStates.ts';
import { jigsaw } from './index.ts';
import { gridOf, homeOf } from './cut.ts';
import { boardOf } from './rules.ts';
import type { GameState, Seat } from './types.ts';

const PHOTO = '0123456789abcdef0123456789abcdef';
const EVE = { id: 's1', name: 'Eve', tableScreen: false, allowedSeats: [] };
const TV = { ...EVE, tableScreen: true };

function lobby(names: string[], values?: HouseRuleValues): GameState {
  const random = seeded(3);
  let state = jigsaw.createGameState('g1');
  for (const name of names) {
    const added = addPlayer(jigsaw, state, name, random);
    if ('error' in added) assert.fail(added.error);
    state = added.state;
  }
  if (values) {
    const set = setHouseRules(jigsaw.info, state, 1, { values });
    if ('error' in set) assert.fail(set.error);
    state = jigsaw.resetLobby(set.state, random);
  }
  for (const seat of state.activePlayers) {
    const agreed = agreeToHouseRules(jigsaw.info, state, seat, state.houseRules?.revision);
    if ('error' in agreed) assert.fail(agreed.error);
    state = agreed.state;
  }
  return state;
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = jigsaw.applyAction!(state, seat, action, seeded(9), 0);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function snap(state: GameState, seat: Seat, piece: number): GameState {
  const { x, y } = homeOf(gridOf(state.count), piece);
  return act(act(state, seat, { type: 'pickUp', piece }), seat, { type: 'drop', piece, x: x + 3, y: y - 2 });
}

// Seat 1 has snapped three pieces and seat 2 two, in Race; seat 3 none
function racing(): GameState {
  let state = lobby(['Alice', 'Bob', 'Cy'], { mode: 'race', pieces: 24 });
  for (const piece of [0, 1, 2]) state = snap(state, 1, piece);
  for (const piece of [5, 6]) state = snap(state, 2, piece);
  return state;
}

const finished = (state: GameState, winner: Seat) => {
  let next = state;
  for (let piece = 0; piece < next.count; piece++) if (!boardOf(next, winner)!.pieces[piece].placed) next = snap(next, winner, piece);
  return next;
};

test('a Race player sees only their own board and the percentages', () => {
  const view = jigsaw.toPublicState(racing(), false, 2);
  assert.deepEqual(Object.keys(view.boards), ['2']);
  assert.deepEqual(view.progress, { 1: 13, 2: 8, 3: 0 });
});

test('the history view sees no Race board during play', () => {
  const view = jigsaw.toPublicState(racing(), false, null);
  assert.deepEqual(view.boards, {});
  assert.deepEqual(view.progress, { 1: 13, 2: 8, 3: 0 });
});

test('everyone sees every board once the race is over', () => {
  const over = finished(racing(), 1);
  assert.equal(over.isGameOver, true);
  for (const viewer of [null, 1, 2, 3]) {
    assert.deepEqual(Object.keys(jigsaw.toPublicState(over, false, viewer).boards), ['1', '2', '3']);
  }
});

test('a spectator sees every board; a table screen sees only the percentages', () => {
  const state = racing();
  const spectator = spectatorView(jigsaw, state, EVE) as ReturnType<typeof jigsaw.toPublicState>;
  assert.deepEqual(Object.keys(spectator.boards), ['1', '2', '3']);
  const table = spectatorView(jigsaw, state, TV);
  assert.deepEqual(table, jigsaw.toPublicState(state, false, null));
  assert.equal(jigsaw.spectatorsSeeEverySeat, true);
});

test('the table view plus privateSeatView is the seat view in every mode', () => {
  const together = snap(lobby(['Alice', 'Bob']), 2, 4);
  const solo = snap(lobby(['Alice']), 1, 4);
  for (const state of [racing(), finished(racing(), 1), together, solo, lobby(['Alice', 'Bob'], { mode: 'race' })]) {
    for (const seat of state.activePlayers) {
      const table = jigsaw.toPublicState(state, false, null);
      const own = jigsaw.toPublicState(state, false, seat);
      assert.deepEqual({ ...table, ...(jigsaw.privateSeatView!(state, seat) as object) }, own);
    }
  }
});

test('a Race view names no piece another seat placed', () => {
  const state = racing();
  const bobSnaps = JSON.stringify(state.snaps[2]);
  for (const viewer of [1, 3, null]) {
    const view = jigsaw.toPublicState(state, false, viewer);
    assert.equal(view.snaps[2], undefined, `viewer ${viewer} snaps`);
    assert.equal(JSON.stringify(view).includes(`"2":${bobSnaps}`), false);
    assert.deepEqual(view.contributions[2], undefined);
    assert.equal(view.lastMove, viewer === 2 ? view.lastMove : null);
  }
  // Bob's own view keeps his snaps and his last move
  const own = jigsaw.toPublicState(state, false, 2);
  assert.deepEqual(own.snaps, { 2: [5, 6] });
  assert.deepEqual(own.lastMove, { type: 'snap', playerNumber: 2, piece: 6 });
  assert.deepEqual(own.contributions, { 2: 2 });
  // Another seat's board is not in any other seat's private view either
  assert.deepEqual(jigsaw.privateSeatView!(state, 1), {
    boards: { 1: state.boards[1] }, snaps: { 1: [0, 1, 2] }, contributions: { 1: 3 }, lastMove: null
  });
  // The last mover sees their own last move in the seat view
  assert.equal(jigsaw.toPublicState(state, false, 2).lastMove?.playerNumber, 2);
});

test('Solo and Together views show every snap', () => {
  const state = snap(snap(lobby(['Alice', 'Bob']), 1, 0), 2, 1);
  const view = jigsaw.toPublicState(state, false, 1);
  assert.deepEqual(view.snaps, { 1: [0], 2: [1] });
  assert.deepEqual(view.lastMove, { type: 'snap', playerNumber: 2, piece: 1 });
  assert.deepEqual(jigsaw.privateSeatView!(state, 1), {});
});

test('Solo standings are one row with the piece count', () => {
  assert.deepEqual(jigsaw.finalStandings!(finished(lobby(['Alice']), 1)), [{ seat: 1, place: 1, score: '48 pieces' }]);
});

test('Together standings share place 1 with each count', () => {
  let state = lobby(['Alice', 'Bob'], { mode: 'together', pieces: 24 });
  for (let piece = 0; piece < 24; piece++) state = snap(state, piece < 20 ? 1 : 2, piece);
  assert.deepEqual(jigsaw.finalStandings!(state), [
    { seat: 1, place: 1, score: '20 placed' }, { seat: 2, place: 1, score: '4 placed' }
  ]);
});

test('Race standings rank by progress', () => {
  const standings = jigsaw.finalStandings!(finished(racing(), 2));
  assert.deepEqual(standings, [
    { seat: 2, place: 1, score: '100%' }, { seat: 1, place: 2, score: '13%' }, { seat: 3, place: 3, score: '0%' }
  ]);
  let tied = lobby(['Alice', 'Bob', 'Cy'], { mode: 'race', pieces: 24 });
  tied = finished(snap(tied, 2, 0), 1);
  assert.deepEqual(jigsaw.finalStandings!(tied).map(row => row.place), [1, 2, 3]);
  const equal = finished(lobby(['Alice', 'Bob', 'Cy'], { mode: 'race', pieces: 24 }), 1);
  assert.deepEqual(jigsaw.finalStandings!(equal).map(row => [row.seat, row.place]), [[1, 1], [2, 2], [3, 2]]);
});

test('no view carries more than the photo id', () => {
  const race = lobby(['Alice', 'Bob'], { mode: 'race', pieces: 24 });
  const state = act(race, 1, { type: 'setPicture', picture: { kind: 'photo', id: PHOTO } });
  const views = [
    jigsaw.toPublicState(state, false, 1), jigsaw.toPublicState(state, false, null),
    spectatorView(jigsaw, state, EVE), spectatorView(jigsaw, state, TV)
  ];
  for (const view of views) {
    const text = JSON.stringify(view);
    assert.ok(text.includes(PHOTO));
    assert.equal(text.includes('data:'), false);
  }
});
