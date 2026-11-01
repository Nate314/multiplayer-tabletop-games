import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreeToHouseRules, setHouseRules, type HouseRuleValues } from '../../shared/houseRules.ts';
import { addPlayer, removePlayer } from '../../shared/seating.ts';
import { seeded } from '../testStates.ts';
import { jigsaw } from './index.ts';
import { gridOf, homeOf } from './cut.ts';
import { boardOf, imagesOf } from './rules.ts';
import type { GameState, Seat } from './types.ts';

const PHOTO = '0123456789abcdef0123456789abcdef';

// A lobby seated with `names`, the host's house rules set, and everyone agreed
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

function refused(state: GameState, seat: Seat, action: unknown): string {
  const before = structuredClone(state);
  const result = jigsaw.applyAction!(state, seat, action, seeded(9), 0);
  assert.ok('error' in result, `expected ${JSON.stringify(action)} to be refused`);
  assert.deepEqual(state, before);
  return result.error;
}

const home = (state: GameState, piece: number) => homeOf(gridOf(state.count), piece);

function snap(state: GameState, seat: Seat, piece: number): GameState {
  const { x, y } = home(state, piece);
  return act(act(state, seat, { type: 'pickUp', piece }), seat, { type: 'drop', piece, x: x + 3, y: y - 2 });
}

// Snaps every piece of `seat`'s board, taking turns among `seats` in Together
function solve(state: GameState, seats: Seat[], skip: number[] = []): GameState {
  let next = state;
  for (let piece = 0; piece < state.count; piece++) {
    if (!skip.includes(piece)) next = snap(next, seats[piece % seats.length], piece);
  }
  return next;
}

const piecesOf = (state: GameState, seat: Seat = 1) => boardOf(state, seat)!.pieces;

test('the lobby scatters the standard 48 pieces', () => {
  const state = lobby(['Alice']);
  assert.equal(state.count, 48);
  assert.equal(state.board.pieces.length, 48);
  assert.deepEqual(state.boards, {});
  assert.ok(state.board.pieces.every(piece => !piece.placed && piece.heldBy === null && piece.placedBy === null));
  assert.ok(new Set(state.board.pieces.map(piece => `${piece.x},${piece.y}`)).size > 40);
});

test('the pieces house rule sets 24, 96 or 150', () => {
  for (const count of [24, 96, 150]) {
    const state = lobby(['Alice'], { pieces: count });
    assert.equal(state.count, count);
    assert.equal(state.board.pieces.length, count);
  }
});

test('the host chooses a picture; others cannot', () => {
  const state = lobby(['Alice', 'Bob']);
  const fox = act(state, 1, { type: 'setPicture', picture: { kind: 'builtin', name: 'fox' } });
  assert.deepEqual(fox.picture, { kind: 'builtin', name: 'fox' });
  assert.deepEqual({ ...fox, picture: state.picture }, state);
  assert.equal(refused(state, 2, { type: 'setPicture', picture: { kind: 'builtin', name: 'fox' } }), 'Only the host can choose the picture');
  const photo = act(state, 1, { type: 'setPicture', picture: { kind: 'photo', id: PHOTO } });
  assert.deepEqual(photo.picture, { kind: 'photo', id: PHOTO });
});

test('an unknown picture or a malformed id is refused', () => {
  const state = lobby(['Alice']);
  for (const picture of [
    { kind: 'builtin', name: 'castle' }, { kind: 'photo', id: 'ABCDEF0123456789abcdef0123456789' }, { kind: 'photo', id: 'abc' },
    { kind: 'photo', id: `${PHOTO}0` }, { kind: 'photo', id: 'data:image/png;base64,AAAA' }, { kind: 'url', id: PHOTO }, 'fox', null
  ]) {
    assert.equal(refused(state, 1, { type: 'setPicture', picture }), 'That picture is not available');
  }
});

test('the picture survives seat changes', () => {
  const alone = lobby(['Alice']);
  const fox = act(alone, 1, { type: 'setPicture', picture: { kind: 'builtin', name: 'fox' } });
  assert.deepEqual(fox.houseRules, alone.houseRules);
  const added = addPlayer(jigsaw, fox, 'Bob', seeded(4));
  if ('error' in added) assert.fail(added.error);
  assert.equal(added.state.houseRules?.values.mode, 'together');
  assert.deepEqual(added.state.picture, { kind: 'builtin', name: 'fox' });
  const left = removePlayer(jigsaw, added.state, 2, seeded(5));
  assert.deepEqual(left.picture, { kind: 'builtin', name: 'fox' });
});

test('the first pick-up starts play and locks the picture', () => {
  const state = lobby(['Alice']);
  assert.equal(state.started, false);
  const held = act(state, 1, { type: 'pickUp', piece: 5 });
  assert.equal(held.started, true);
  assert.equal(held.board.pieces[5].heldBy, 1);
  assert.equal(refused(held, 1, { type: 'setPicture', picture: { kind: 'builtin', name: 'fox' } }), 'The picture is fixed once play starts');
});

test('a drop near home snaps, locks and is recorded; a loose drop is not recorded', () => {
  const state = act(lobby(['Alice']), 1, { type: 'pickUp', piece: 9 });
  const { x, y } = home(state, 9);
  const near = { type: 'drop', piece: 9, x: x + 20, y: y + 20 };
  const far = { type: 'drop', piece: 9, x: x + 200, y: y + 20 };
  assert.equal(jigsaw.recordsAction!(state, 1, near), true);
  assert.equal(jigsaw.recordsAction!(state, 1, far), false);
  assert.equal(jigsaw.recordsAction!(state, 1, { type: 'pickUp', piece: 2 }), false);

  const snapped = act(state, 1, near);
  assert.deepEqual(snapped.board.pieces[9], { x, y, placed: true, heldBy: null, placedBy: 1 });
  assert.deepEqual(snapped.snaps, { 1: [9] });
  assert.deepEqual(snapped.contributions, { 1: 1 });
  assert.deepEqual(snapped.lastMove, { type: 'snap', playerNumber: 1, piece: 9 });
  assert.equal(refused(snapped, 1, { type: 'pickUp', piece: 9 }), 'That piece is locked in place');

  const loose = act(state, 1, far);
  assert.deepEqual(loose.board.pieces[9], { x: x + 200, y: y + 20, placed: false, heldBy: null, placedBy: null });
  assert.deepEqual(loose.snaps, {});
  assert.equal(loose.lastMove, null);
});

test('a drop off the table is clamped onto it', () => {
  const state = act(lobby(['Alice']), 1, { type: 'pickUp', piece: 0 });
  const dropped = act(state, 1, { type: 'drop', piece: 0, x: -500, y: 1e9 });
  const grid = gridOf(48);
  assert.deepEqual([dropped.board.pieces[0].x, dropped.board.pieces[0].y], [0, 1800 - grid.h]);
});

test('a held piece cannot be taken', () => {
  const state = act(lobby(['Alice', 'Bob']), 1, { type: 'pickUp', piece: 3 });
  assert.equal(refused(state, 2, { type: 'pickUp', piece: 3 }), 'Alice is holding that piece');
  assert.equal(refused(state, 2, { type: 'drop', piece: 3, x: 10, y: 10 }), 'You are not holding that piece');
  assert.equal(state.board.pieces[3].heldBy, 1);
});

test('picking up a second piece releases the first', () => {
  const first = act(lobby(['Alice']), 1, { type: 'pickUp', piece: 3 });
  const second = act(first, 1, { type: 'pickUp', piece: 4 });
  assert.equal(second.board.pieces[3].heldBy, null);
  assert.deepEqual([second.board.pieces[3].x, second.board.pieces[3].y], [first.board.pieces[3].x, first.board.pieces[3].y]);
  assert.equal(second.board.pieces[4].heldBy, 1);
  assert.equal(second.board.pieces.filter(piece => piece.heldBy === 1).length, 1);
});

test('Race boards are separate', () => {
  const state = lobby(['Alice', 'Bob'], { mode: 'race' });
  assert.deepEqual(state.board.pieces, []);
  assert.deepEqual(Object.keys(state.boards), ['1', '2']);
  assert.deepEqual(state.boards[1], state.boards[2]);
  const held = act(state, 1, { type: 'pickUp', piece: 3 });
  // Bob's piece 3 is his own copy, so Alice holding hers does not stop him
  const both = act(held, 2, { type: 'pickUp', piece: 3 });
  assert.equal(both.boards[1]!.pieces[3].heldBy, 1);
  assert.equal(both.boards[2]!.pieces[3].heldBy, 2);
  assert.equal(refused(held, 2, { type: 'drop', piece: 3, x: 10, y: 10 }), 'You are not holding that piece');
  const snapped = snap(state, 1, 7);
  assert.equal(snapped.boards[1]!.pieces[7].placed, true);
  assert.deepEqual(snapped.boards[2], state.boards[2]);
  assert.deepEqual(snapped.board, state.board);
});

test('placing the last piece ends the game', () => {
  const solo = lobby(['Alice'], { pieces: 24 });
  const almost = solve(solo, [1], [23]);
  assert.equal(almost.isGameOver, false);
  const done = snap(almost, 1, 23);
  assert.equal(done.isGameOver, true);
  assert.deepEqual(done.winners, [1]);
  assert.equal(done.gameStatus, 'The puzzle is done!');

  const together = solve(lobby(['Alice', 'Bob', 'Cara'], { pieces: 24 }), [1, 2, 3]);
  assert.equal(together.isGameOver, true);
  assert.deepEqual(together.winners, [1, 2, 3]);
  assert.deepEqual(together.contributions, { 1: 8, 2: 8, 3: 8 });

  const race = snap(snap(lobby(['Alice', 'Bob'], { mode: 'race', pieces: 24 }), 1, 0), 2, 5);
  const raced = solve(race, [2], [5]);
  assert.equal(raced.isGameOver, true);
  assert.deepEqual(raced.winners, [2]);
  assert.equal(raced.gameStatus, 'Bob finished first!');
});

test('own-move undo takes back only my last snap', () => {
  const state = snap(snap(lobby(['Alice', 'Bob']), 2, 1), 1, 2);
  const undone = jigsaw.undoOwn!(state, 2);
  if ('error' in undone) assert.fail(undone.error);
  const pieces = undone.state.board.pieces;
  assert.equal(pieces[2].placed, true);
  const grid = gridOf(48);
  const { x, y } = home(state, 1);
  assert.deepEqual(pieces[1], { x: x + grid.w / 2, y: y + grid.h / 2, placed: false, heldBy: null, placedBy: null });
  assert.deepEqual(undone.state.contributions, { 1: 1, 2: 0 });
  assert.deepEqual(undone.state.snaps, { 1: [2], 2: [] });
  assert.deepEqual(undone.state.lastMove, { type: 'unsnap', playerNumber: 2, piece: 1 });
  assert.deepEqual(jigsaw.undoOwn!(undone.state, 2), { error: 'Nothing of yours to undo' });
});

test('own-move undo keeps the piece on the table', () => {
  // The last piece's home is the bottom right of the picture; half a cell on is still on the table
  const state = snap(lobby(['Alice', 'Bob'], { mode: 'race', pieces: 24 }), 2, 23);
  const undone = jigsaw.undoOwn!(state, 2);
  if ('error' in undone) assert.fail(undone.error);
  const piece = undone.state.boards[2]!.pieces[23];
  const grid = gridOf(24);
  assert.ok(piece.x <= 2000 - grid.w && piece.y <= 1800 - grid.h);
  assert.equal(piece.placed, false);
});

test('undo vote is for Solo only', () => {
  assert.equal(jigsaw.allowsUndoVote!(lobby(['Alice'])), true);
  assert.equal(jigsaw.allowsUndoVote!(lobby(['Alice', 'Bob'])), false);
  assert.equal(jigsaw.allowsUndoVote!(lobby(['Alice', 'Bob'], { mode: 'race' })), false);
});

test('undo clears every hold', () => {
  const together = act(act(lobby(['Alice', 'Bob']), 1, { type: 'pickUp', piece: 1 }), 2, { type: 'pickUp', piece: 2 });
  const cleared = jigsaw.onUndo!(together, seeded(1));
  assert.ok(cleared.board.pieces.every(piece => piece.heldBy === null));
  const race = act(act(lobby(['Alice', 'Bob'], { mode: 'race' }), 1, { type: 'pickUp', piece: 1 }), 2, { type: 'pickUp', piece: 2 });
  const raceCleared = jigsaw.onUndo!(race, seeded(1));
  for (const seat of [1, 2]) assert.ok(raceCleared.boards[seat]!.pieces.every(piece => piece.heldBy === null));
});

test('a leaver or a dropped connection lets go of the held piece', () => {
  const held = act(act(lobby(['Alice', 'Bob', 'Cara']), 1, { type: 'pickUp', piece: 1 }), 2, { type: 'pickUp', piece: 2 });
  const gone = jigsaw.onPlayerDisconnected!(held, 2, seeded(1));
  assert.equal(gone.board.pieces[2].heldBy, null);
  assert.deepEqual([gone.board.pieces[2].x, gone.board.pieces[2].y], [held.board.pieces[2].x, held.board.pieces[2].y]);
  assert.equal(gone.board.pieces[1].heldBy, 1);
  const left = jigsaw.onPlayerLeft!(held, 1, seeded(1));
  assert.equal(left.board.pieces[1].heldBy, null);
  assert.equal(left.board.pieces[2].heldBy, 2);

  const race = snap(act(lobby(['Alice', 'Bob', 'Cara'], { mode: 'race' }), 2, { type: 'pickUp', piece: 0 }), 2, 4);
  const raceLeft = jigsaw.onPlayerLeft!({ ...race, activePlayers: [1, 3] }, 2, seeded(1));
  assert.deepEqual(Object.keys(raceLeft.boards), ['1', '3']);
  assert.equal(raceLeft.snaps[2], undefined);
  assert.equal(raceLeft.isGameOver, false);
});

test('bad input is refused and changes nothing', () => {
  const state = act(lobby(['Alice']), 1, { type: 'pickUp', piece: 0 });
  for (const piece of [-1, 48, 1.5, '1', null, undefined]) {
    assert.equal(refused(state, 1, { type: 'pickUp', piece }), 'No such piece');
    assert.equal(refused(state, 1, { type: 'drop', piece, x: 10, y: 10 }), 'No such piece');
  }
  for (const x of [Number.NaN, '10', Infinity, null]) {
    assert.equal(refused(state, 1, { type: 'drop', piece: 0, x, y: 10 }), 'That is not a spot on the table');
    assert.equal(refused(state, 1, { type: 'drop', piece: 0, x: 10, y: x }), 'That is not a spot on the table');
  }
  assert.equal(refused(state, 1, { type: 'drop', piece: 1, x: 10, y: 10 }), 'You are not holding that piece');
  assert.equal(refused(state, 1, { type: 'fly' }), 'Unknown action');
  assert.equal(refused(state, 1, 'pickUp'), 'Unknown action');
  assert.deepEqual(jigsaw.applyMove(state, 1, { type: 'pickUp', piece: 1 }, seeded(1), 0), { error: 'Use the pieces on the table' });

  const done = solve(lobby(['Alice'], { pieces: 24 }), [1]);
  for (const action of [
    { type: 'pickUp', piece: 0 }, { type: 'drop', piece: 0, x: 0, y: 0 },
    { type: 'setPicture', picture: { kind: 'builtin', name: 'fox' } }
  ]) assert.equal(refused(done, 1, action), 'The puzzle is finished');
});

test('the state holds a photo only as its id', () => {
  const state = act(lobby(['Alice'], { pieces: 150 }), 1, { type: 'setPicture', picture: { kind: 'photo', id: PHOTO } });
  assert.ok(JSON.stringify(state).length < 20_000, String(JSON.stringify(state).length));
  assert.deepEqual(imagesOf(state), [PHOTO]);
  assert.deepEqual(jigsaw.imagesOf!(lobby(['Alice'])), []);
});

test('only pieces of my own board count', () => {
  const state = lobby(['Alice', 'Bob'], { mode: 'race' });
  assert.equal(piecesOf(state, 2).length, 48);
  assert.equal(boardOf(state, 3), undefined);
});
