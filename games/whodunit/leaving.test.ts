import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whodunit } from './index.ts';
import { allowsUndoVote, waitingOn } from './rules.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import { seeded } from '../testStates.ts';
import type { Result } from '../../shared/types.ts';
import type { GameState, Solution } from './types.ts';

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const SOLUTION: Solution = { suspect: 'commodore-brine', object: 'harpoon', room: 'boathouse' };
const SUGGEST = { type: 'suggest', suspect: 'miss-gull', object: 'boat-oar' }; // asks Miss Gull, Boat Oar, Galley

// Four seated and started; Alice (seat 1) in the Galley, ready to suggest, with the hands given
function started(hands: GameState['hands'] = {}): GameState {
  let state = whodunit.createGameState('g');
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan']) {
    const result = addPlayer(whodunit, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return {
    ...state,
    started: true,
    solution: SOLUTION,
    hands: { ...state.hands, ...hands },
    phase: 'room',
    positions: { ...state.positions, 'commodore-brine': { room: 'galley' } }
  };
}
const play = (state: GameState, seat: number, move: unknown) => applyMove(whodunit, state, seat, move, () => 0);

// Bob (seat 2) holds two asked cards and must choose
const awaitingBob = (cara: GameState['hands'][number] = ['galley']) =>
  ok(play(started({ 1: ['madame-coral'], 2: ['miss-gull', 'boat-oar'], 3: cara, 4: ['salt-spa'] }), 1, SUGGEST));

test('a disconnect reveals nothing and the game waits for the shower', () => {
  const state = awaitingBob();
  assert.equal(state.suggestions[0].awaiting, 2);
  const held = disconnectPlayer(whodunit, state, 2);
  assert.deepEqual(Object.values(held.faceUp).flat(), []);
  assert.deepEqual(held.hands[2], ['miss-gull', 'boat-oar']);
  assert.equal(held.suggestions[0].awaiting, 2);
  assert.deepEqual(waitingOn(held), [2]);
});

test("a dismissal turns the leaver's cards face up", () => {
  const state = started();
  const hand = state.hands[3];
  const left = removePlayer(whodunit, state, 3);
  assert.deepEqual(left.faceUp[3], hand);
  assert.match(left.gameStatus, /Cara was dismissed; their cards are face up/);
  for (const viewer of [null, 1, 2, 4]) assert.deepEqual(whodunit.toPublicState(left, false, viewer).faceUp[3], hand);
});

test('dismissing the shower passes the suggestion on clockwise', () => {
  const shown = removePlayer(whodunit, awaitingBob(), 2);
  assert.equal(shown.phase, 'end');
  assert.deepEqual(shown.suggestions[0], { suspect: 'miss-gull', object: 'boat-oar', room: 'galley', by: 1, passed: [], shownBy: 3, awaiting: null });
  assert.deepEqual(shown.seen, [{ suggestion: 0, from: 3, to: 1, card: 'galley' }]);
  assert.equal(shown.lastMove?.sealed, true);

  const none = removePlayer(whodunit, awaitingBob(['harpoon']), 2);
  assert.equal(none.phase, 'end');
  assert.deepEqual(none.suggestions[0].passed, [3, 4]);
  assert.equal(none.suggestions[0].shownBy, null);
  assert.deepEqual(none.seen, []);
});

test("dismissing the current player starts the next player's turn at start", () => {
  const rolled = ok(play({ ...started(), phase: 'start', currentPlayer: 2, out: [3] }, 2, { type: 'roll' }));
  assert.equal(rolled.phase, 'move');
  const next = removePlayer(whodunit, rolled, 2);
  assert.equal(next.currentPlayer, 4);
  assert.equal(next.phase, 'start');
  assert.equal(next.dice, null);
  assert.deepEqual(next.destinations, []);
});

test('a dismissal that leaves one accuser ends the game with them winning', () => {
  const over = removePlayer(whodunit, { ...started(), out: [2, 3] }, 1);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [4]);
  assert.equal(over.currentPlayer, null);
});

test('one that leaves none ends with nobody winning and the solution shown', () => {
  const over = removePlayer(whodunit, { ...started(), out: [2, 3, 4] }, 1);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, []);
  assert.equal(over.gameStatus, 'Nobody solved it');
  assert.deepEqual(over.solution, SOLUTION);
});

test('no undo vote right after a shown card or an accusation', () => {
  assert.equal(allowsUndoVote(ok(play(awaitingBob(), 2, { type: 'show', card: 'boat-oar' }))), false);
  assert.equal(allowsUndoVote(ok(play(started({ 2: ['miss-gull'] }), 1, SUGGEST))), false);
  const accuse = { type: 'accuse', suspect: 'miss-gull', object: 'boat-oar', room: 'galley' };
  assert.equal(allowsUndoVote(ok(play(started(), 1, accuse))), false);
  assert.equal(allowsUndoVote(ok(play({ ...started(), phase: 'start' }, 1, { type: 'roll' }))), true);
  const nobody = { 1: [], 2: ['salt-spa'], 3: ['harpoon'], 4: ['chart-room'] } as GameState['hands'];
  assert.equal(allowsUndoVote(ok(play(started(nobody), 1, SUGGEST))), true);
});

test('dismissing the suggester while a card is chosen ends the showing', () => {
  const next = removePlayer(whodunit, awaitingBob(), 1);
  assert.equal(next.currentPlayer, 2);
  assert.equal(next.phase, 'start');
  assert.equal(next.suggestions[0].awaiting, null);
  assert.equal(next.suggestions[0].shownBy, null);
  assert.equal(next.suggestions[0].endedBy, 'dismissal');
  assert.deepEqual(waitingOn(next), []);
});

test('a suggestion nobody could answer is not marked as ended by a dismissal', () => {
  const nobody = { 1: [], 2: ['salt-spa'], 3: ['harpoon'], 4: ['chart-room'] } as GameState['hands'];
  assert.equal(ok(play(started(nobody), 1, SUGGEST)).suggestions[0].endedBy, undefined);
});

test('dismissing the next player keeps the turn and later skips them', () => {
  const next = removePlayer(whodunit, started(), 2);
  assert.equal(next.currentPlayer, 1);
  assert.equal(next.phase, 'room');
  assert.equal(next.isGameOver, false);
  const ended = ok(play(next, 1, { type: 'endTurn' }));
  assert.equal(ended.currentPlayer, 3);
  assert.equal(ended.phase, 'start');
  assert.equal(ended.isGameOver, false);
});
