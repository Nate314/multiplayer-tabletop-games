import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whodunit } from './index.ts';
import { CARDS } from './content.ts';
import { addPlayer } from '../../shared/seating.ts';
import { seeded } from '../testStates.ts';
import type { GameState, Seat, Solution } from './types.ts';

const SOLUTION: Solution = { suspect: 'commodore-brine', object: 'harpoon', room: 'boathouse' };

function lobby(): GameState {
  let state = whodunit.createGameState('g');
  for (const name of ['Alice', 'Bob', 'Cara']) {
    const result = addPlayer(whodunit, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// Seat 2 showed seat 1 the Boat Oar; seat 3 holds the Galley
const SEEN = { suggestion: 0, from: 2, to: 1, card: 'boat-oar' } as const;
function shown(): GameState {
  return {
    ...lobby(), solution: SOLUTION, hands: { 1: ['miss-gull', 'boathouse'], 2: ['boat-oar', 'galley'], 3: ['anchor-chain', 'wine-cellar'] },
    seen: [SEEN], notes: { 1: { 'anchor-chain': 'no' }, 2: { galley: 'yes' }, 3: {} },
    lastMove: { type: 'show', playerNumber: 2, sealed: true }, gameStatus: 'Bob showed Alice a card'
  };
}

const view = (state: GameState, viewer: Seat | null) => whodunit.toPublicState(state, false, viewer);
const text = (value: unknown) => JSON.stringify(value);

test('each seat sees only its own hand', () => {
  const state = shown();
  for (const seat of [1, 2, 3]) {
    const mine = view(state, seat);
    assert.deepEqual(mine.hand, state.hands[seat]);
    assert.deepEqual(mine.handSizes, { 1: 2, 2: 2, 3: 2 });
    assert.ok(!('hands' in mine));
  }
  assert.deepEqual(view(state, null).hand, []);
  assert.deepEqual(view(state, null).handSizes, { 1: 2, 2: 2, 3: 2 });
  const hidden = text({ ...view(state, null), positions: 0, objectRooms: 0, suspectOf: 0, suggestions: 0, seen: 0 });
  for (const card of Object.values(state.hands).flat()) assert.ok(!hidden.includes(`"${card}"`), card);
});

test('a shown card is seen only by the two players concerned', () => {
  const state = shown();
  assert.deepEqual(view(state, 1).seen, [SEEN]);
  assert.deepEqual(view(state, 2).seen, [SEEN]);
  assert.deepEqual(view(state, 3).seen, []);
  assert.deepEqual(view(state, null).seen, []);
  for (const viewer of [1, 2, 3, null]) {
    const { gameStatus, lastMove } = view(state, viewer);
    for (const card of CARDS) assert.ok(!text({ gameStatus, lastMove }).includes(card), card);
  }
});

test('the solution shows only after the game ends', () => {
  const state = shown();
  for (const viewer of [1, null]) assert.equal(view(state, viewer).solution, null);
  for (const viewer of [1, 2, null]) assert.deepEqual(view({ ...state, isGameOver: true }, viewer).solution, SOLUTION);
});

test('notes are private', () => {
  const state = shown();
  assert.deepEqual(view(state, 1).notes, { 'anchor-chain': 'no' });
  assert.deepEqual(view(state, 2).notes, { galley: 'yes' });
  assert.deepEqual(view(state, null).notes, {});
  assert.deepEqual(whodunit.privateSeatView!(state, 1), { hand: state.hands[1], seen: [SEEN], notes: { 'anchor-chain': 'no' } });
});

test('a dismissed player\'s face-up cards are public to every viewer', () => {
  const state: GameState = { ...shown(), faceUp: { 1: [], 2: ['galley'], 3: [] } };
  for (const viewer of [1, 2, 3, null]) assert.deepEqual(view(state, viewer).faceUp, state.faceUp);
});

test('the secret is the solution until the game ends', () => {
  const state = shown();
  assert.deepEqual(whodunit.secretState!(state), { solution: SOLUTION });
  assert.deepEqual(whodunit.secretState!({ ...state, isGameOver: true }), {});
});
