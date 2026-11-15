import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../testStates.ts';
import {
  addPoints, allowsOutOfTurn, applyMove, createGameState, onPlayerLeft, onUndo, resetLobby, sideOf, toPublicState, waitingOn
} from './rules.ts';
import type { Card, GameState, Move, Rank, Result, Seat, Suit } from './types.ts';

const SUIT_OF: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
// '5H' is the five of hearts, '10S' the ten of spades
const parse = (text: string): Card[] =>
  text.split(' ').filter(Boolean).map(code => ({ rank: code.slice(0, -1) as Rank, suit: SUIT_OF[code.slice(-1)] }));
const NAMES: Record<Seat, string> = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}
const move = (state: GameState, seat: Seat, m: Move) => applyMove(state, seat, m, seeded(3));
const play = (state: GameState, seat: Seat, code: string) => ok(move(state, seat, { type: 'play', card: parse(code)[0] }));
const go = (state: GameState, seat: Seat) => ok(move(state, seat, { type: 'go' }));

// A table of `players` with the cards dealt
function table(players: number, seed = 1): GameState {
  const activePlayers = [1, 2, 3, 4].slice(0, players);
  const playerNames = Object.fromEntries(activePlayers.map(seat => [seat, NAMES[seat]]));
  return resetLobby({ ...createGameState('g'), activePlayers, playerNames }, seeded(seed));
}

// Everyone lays the first cards of their hand in the crib
function discardAll(state: GameState): GameState {
  const count = state.activePlayers.length === 2 ? 2 : 1;
  return state.activePlayers.reduce((s, seat) => ok(move(s, seat, { type: 'discard', cards: s.hands[seat].slice(0, count) })), state);
}

// Pegging under way at 2 or 3 players: the last seat dealt and the first plays
function pegging(hands: string[], overrides: Partial<GameState> = {}): GameState {
  const seats = hands.map((_, i) => i + 1);
  const perSeat = <T>(fn: () => T) => Object.fromEntries(seats.map(seat => [seat, fn()]));
  return {
    ...createGameState('g'),
    started: true,
    activePlayers: seats,
    playerNames: Object.fromEntries(seats.map(seat => [seat, NAMES[seat]])),
    dealer: seats.length,
    phase: 'pegging',
    currentPlayer: 1,
    hands: Object.fromEntries(hands.map((codes, i) => [i + 1, parse(codes)])),
    played: perSeat(() => []),
    scores: perSeat(() => 0),
    pegs: perSeat(() => ({ front: 0, back: 0 })),
    starter: parse('KH')[0],
    ...overrides
  };
}

test('two players get six cards and the crib gets four', () => {
  const state = table(2);
  assert.equal(state.phase, 'discard');
  assert.ok(state.dealer === 1 || state.dealer === 2);
  assert.deepEqual([state.hands[1].length, state.hands[2].length, state.crib.length, state.deck.length], [6, 6, 0, 40]);
  assert.deepEqual(waitingOn(state), [1, 2]);
  const view = toPublicState(state, false, 1);
  assert.deepEqual(view.hand, state.hands[1]);
  assert.equal('crib' in view || 'deck' in view, false);
  const laid = discardAll(state);
  assert.deepEqual([laid.hands[1].length, laid.hands[2].length, laid.crib.length], [4, 4, 4]);
  assert.equal(laid.phase, 'cut');
});

test('three players get five and the crib gets one from the deck', () => {
  const state = table(3);
  assert.deepEqual([1, 2, 3].map(seat => state.hands[seat].length), [5, 5, 5]);
  assert.deepEqual([state.crib.length, state.deck.length], [1, 36]);
  assert.deepEqual(state.scores, { 1: 0, 2: 0, 3: 0 });
  assert.equal(discardAll(state).crib.length, 4);
});

test('four players get five and sit as partners', () => {
  const state = table(4);
  assert.deepEqual([1, 2, 3, 4].map(seat => state.hands[seat].length), [5, 5, 5, 5]);
  assert.equal(state.crib.length, 0);
  assert.deepEqual(state.scores, { 0: 0, 1: 0 });
  assert.deepEqual([1, 2, 3, 4].map(seat => sideOf(state, seat)), [0, 1, 0, 1]);
  assert.equal(discardAll(state).crib.length, 4);
});

test('a wrong number of discards is refused', () => {
  const two = table(2);
  assert.ok(allowsOutOfTurn(two, 2, { type: 'discard', cards: [] }));
  assert.equal(allowsOutOfTurn(two, 2, { type: 'cut' }), false);
  assert.deepEqual(move(two, 1, { type: 'discard', cards: two.hands[1].slice(0, 1) }), { error: 'Discard 2 cards to the crib' });
  const three = table(3);
  assert.deepEqual(move(three, 1, { type: 'discard', cards: three.hands[1].slice(0, 2) }), { error: 'Discard 1 card to the crib' });
  const once = ok(move(three, 1, { type: 'discard', cards: three.hands[1].slice(0, 1) }));
  assert.ok('error' in move(once, 1, { type: 'discard', cards: once.hands[1].slice(0, 1) }));
  assert.deepEqual(waitingOn(once), [2, 3]);
});

test('the cut is made by the seat after the dealer and a Jack scores his heels', () => {
  const laid = discardAll(table(3));
  const dealer = laid.dealer ?? 1;
  const cutter = dealer % 3 + 1;
  assert.equal(laid.currentPlayer, cutter);
  const jacks = ok(move({ ...laid, deck: parse('JH JD JS JC') }, cutter, { type: 'cut' }));
  assert.equal(jacks.starter?.rank, 'J');
  assert.equal(jacks.deck.length, 3);
  assert.equal(jacks.scores[dealer], 2);
  assert.deepEqual(jacks.lastMove, { type: 'cut', playerNumber: cutter, starter: jacks.starter, heels: true });
  assert.equal(jacks.phase, 'pegging');
  assert.equal(jacks.currentPlayer, cutter);
  const plain = ok(move({ ...laid, deck: parse('5H 6H 7H') }, cutter, { type: 'cut' }));
  assert.equal(plain.scores[dealer], 0);
  assert.equal(plain.lastMove?.type === 'cut' && plain.lastMove.heels, false);
  // An undone cut cannot show the starter again: the deck is reshuffled
  const deck = parse('AH 2H 3H 4H 5H 6H 7H 8H 9H 10H');
  assert.notDeepEqual(onUndo({ ...laid, deck }, seeded(9)).deck, deck);
});

test('pegging fifteen, pairs and runs score as played', () => {
  let state = pegging(['4H 5D 3S', '6C 3H 9D']);
  state = play(state, 1, '4H');
  state = play(state, 2, '6C');
  state = play(state, 1, '5D'); // 15, and 4 6 5 is a run of 3
  assert.deepEqual(state.lastMove?.type === 'play' && state.lastMove.items.map(i => [i.kind, i.points]), [['fifteen', 2], ['run', 3]]);
  assert.equal(state.scores[1], 5);
  state = play(state, 2, '3H'); // 3 4 5 6, a run of 4
  assert.equal(state.scores[2], 4);
  state = play(state, 1, '3S'); // a pair
  assert.equal(state.scores[1], 7);
  assert.equal(state.count, 21);
  assert.deepEqual(state.played[1], parse('4H 5D 3S'));
  assert.equal(state.currentPlayer, 2);
});

test('go and last card', () => {
  // Three players, count 28: nobody can play, so each says Go and Alice, who played last, scores 1
  let state = pegging(['KH 2C', 'QH', '9C'], { pile: [{ seat: 1, card: parse('8S')[0] }], count: 28, currentPlayer: 2 });
  assert.deepEqual(move(state, 2, { type: 'play', card: parse('QH')[0] }), { error: 'That card would take the count past 31' });
  state = go(state, 2);
  assert.equal(state.currentPlayer, 3);
  state = go(state, 3);
  assert.equal(state.currentPlayer, 1);
  state = play(state, 1, '2C'); // Alice can still play: 30
  assert.equal(state.currentPlayer, 1);
  state = go(state, 1);
  assert.deepEqual(state.lastMove, { type: 'go', playerNumber: 1, lastCard: true });
  assert.deepEqual([state.scores[1], state.count, state.pile.length, state.saidGo.length], [1, 0, 0, 0]);
  assert.equal(state.currentPlayer, 2); // play resumes after Alice
  // A player who can play may not say Go
  assert.deepEqual(move(state, 2, { type: 'go' }), { error: 'You have a card you can play' });
  state = play(state, 2, 'QH');
  state = play(state, 3, '9C');
  state = play(state, 1, 'KH'); // the last card of the round: 29, 1 point
  assert.equal(state.scores[1], 2);
  assert.equal(state.phase, 'show');
  assert.equal(state.currentPlayer, null);

  // A 31 scores 2 and no Go point, and play goes on from the next seat
  let thirty = pegging(['7C 5H', '9D'], { pile: [{ seat: 2, card: parse('KS')[0] }], count: 24 });
  thirty = play(thirty, 1, '7C');
  assert.deepEqual([thirty.scores[1], thirty.count, thirty.currentPlayer], [2, 0, 2]);
  thirty = play(thirty, 2, '9D');
  thirty = play(thirty, 1, '5H'); // last card, 14
  assert.deepEqual([thirty.scores[1], thirty.phase], [3, 'show']);
});

test('a card that would pass 31 is refused', () => {
  const state = pegging(['KH 2C', 'QH'], { pile: [{ seat: 2, card: parse('KS')[0] }], count: 25 });
  assert.deepEqual(move(state, 1, { type: 'play', card: parse('KH')[0] }), { error: 'That card would take the count past 31' });
  assert.deepEqual(move(state, 1, { type: 'play', card: parse('AH')[0] }), { error: 'You do not have that card' });
});

test('reaching the target mid-pegging ends the game', () => {
  const state = pegging(['5D 6C', '9H'], {
    pile: [{ seat: 2, card: parse('5H')[0] }], count: 5,
    scores: { 1: 119, 2: 100 }, pegs: { 1: { front: 119, back: 117 }, 2: { front: 100, back: 90 } }
  });
  const over = play(state, 1, '5D');
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [1]);
  assert.equal(over.scores[1], 121);
  assert.deepEqual(over.pegs[1], { front: 121, back: 119 });
  assert.equal(over.currentPlayer, null);
  assert.match(over.gameStatus, /Alice wins/);
});

test('pegs leapfrog', () => {
  const state = table(2);
  const two = addPoints(state, 1, [{ kind: 'go', cards: [], points: 2 }]);
  const five = addPoints(two, 1, [{ kind: 'pair', cards: [], points: 3 }]);
  assert.deepEqual(five.pegs[1], { front: 5, back: 2 });
  assert.deepEqual(five.pegs[2], { front: 0, back: 0 });
});

test('leaving at three players redeals for two', () => {
  const started = { ...pegging(['KH 2C', 'QH', '9C'], { scores: { 1: 10, 2: 20, 3: 30 } }), dealer: 2 };
  const left = onPlayerLeft({ ...started, activePlayers: [1, 3] }, 2, seeded(4));
  assert.equal(left.phase, 'discard');
  assert.deepEqual(Object.keys(left.hands), ['1', '3']);
  assert.deepEqual([left.hands[1].length, left.hands[3].length, left.crib.length], [6, 6, 0]);
  assert.deepEqual(left.scores, { 1: 10, 3: 30 });
  assert.equal(left.dealer, 3);
  assert.equal(left.isGameOver, false);
});

test('leaving at four breaks the partnership', () => {
  const state = table(4);
  const left = onPlayerLeft({ ...state, activePlayers: [1, 2, 4] }, 3, seeded(4));
  assert.equal(left.isGameOver, true);
  assert.deepEqual(left.winners, [2, 4]);
});
