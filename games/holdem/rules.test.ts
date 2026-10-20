import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIG_BLIND, SMALL_BLIND, STARTING_CHIPS, applyAction, applyMove, computePots, createGameState, options, splitPot, toPublicState
} from './rules.ts';
import { holdem } from './index.ts';
import { addPlayer, applyMove as platformMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, Move, PlayingCard, Result, Seat } from './types.ts';
import type { Rank, Suit } from '../../shared/playingCards.ts';

const SUIT: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
// 'Ah Kd 10c' style card lists
const cards = (text: string): PlayingCard[] =>
  text.split(' ').map(code => ({ rank: code.slice(0, -1) as Rank, suit: SUIT[code.slice(-1)] }));

// The same numbers on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn', 'Gus', 'Hal'];

function lobby(count: number, random: Random = seeded(1)): GameState {
  let state = createGameState('g');
  for (const name of NAMES.slice(0, count)) {
    const result = addPlayer(holdem, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// A move through the platform's turn checks, as the server makes it
function move(state: GameState, seat: Seat, m: Move, random: Random = seeded(9)): GameState {
  return ok(platformMove(holdem, state, seat, m, random));
}

function act(state: GameState, seat: Seat, action: unknown, random: Random = seeded(9)): GameState {
  return ok(applyAction(state, seat, action, random));
}

// Everyone acknowledges the hand result, dealing the next hand
function continueAll(state: GameState): GameState {
  let next = state;
  for (const seat of state.activePlayers) if (next.handResult) next = act(next, seat, { type: 'acknowledgeRound' });
  return next;
}

// A hand on the river with the bets settled, the board and hole cards fixed and `chips` behind each player.
// The button is the last seat, so seat 1 acts first.
function river(chips: number[], holes: string[], board: string, overrides: Partial<GameState> = {}): GameState {
  const seats = chips.map((_, index) => index + 1);
  const record = <T>(values: T[]) => Object.fromEntries(seats.map((seat, index) => [seat, values[index]]));
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: seats,
    playerNames: record(NAMES.slice(0, seats.length)),
    handNumber: 1,
    button: seats.length,
    chips: record(chips),
    holeCards: record(holes.map(cards)),
    deck: cards('2c 3c 4c 5c 6c'),
    board: cards(board),
    street: 'river',
    dealtIn: seats,
    folded: [],
    bets: record(seats.map(() => 0)),
    contributed: record(seats.map(() => 0)),
    currentBet: 0,
    raiseSize: BIG_BLIND,
    actedAt: {},
    ...overrides
  };
}

test('setup: everyone starts with 1,000 chips, two hole cards each, and the blinds are 10 and 20', () => {
  const state = lobby(3);
  assert.equal(STARTING_CHIPS, 1000);
  assert.equal(SMALL_BLIND, 10);
  assert.equal(BIG_BLIND, 20);
  assert.equal(state.handNumber, 1);
  assert.equal(state.button, 1);
  assert.deepEqual(state.chips, { 1: 1000, 2: 990, 3: 980 });
  assert.deepEqual(state.bets, { 1: 0, 2: 10, 3: 20 });
  assert.equal(state.currentPlayer, 1);
  for (const seat of [1, 2, 3]) assert.equal(state.holeCards[seat].length, 2);
  assert.equal(state.deck.length, 52 - 6);
  assert.deepEqual(state.board, []);
  assert.equal(state.street, 'preflop');
  // One player is not enough to deal
  assert.equal(lobby(1).handNumber, 0);
});

test('the button moves each hand and blinds are posted left of it', () => {
  let state = lobby(4);
  assert.equal(state.button, 1);
  assert.deepEqual(state.bets, { 1: 0, 2: 10, 3: 20, 4: 0 });
  // Left of the big blind acts first
  assert.equal(state.currentPlayer, 4);
  state = move(state, 4, { type: 'fold' });
  state = move(state, 1, { type: 'fold' });
  state = move(state, 2, { type: 'fold' });
  assert.deepEqual(state.handResult?.won, { 3: 30 });
  assert.equal(state.currentPlayer, null);
  state = continueAll(state);
  assert.equal(state.handNumber, 2);
  assert.equal(state.button, 2);
  assert.deepEqual(state.bets, { 1: 0, 2: 0, 3: 10, 4: 20 });
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.chips, { 1: 1000, 2: 990, 3: 1000, 4: 980 });
});

test('heads-up the button posts the small blind and acts first before the flop', () => {
  let state = lobby(2);
  assert.equal(state.button, 1);
  assert.deepEqual(state.bets, { 1: 10, 2: 20 });
  assert.equal(state.currentPlayer, 1);
  state = move(state, 1, { type: 'call' });
  // The big blind has the option
  assert.equal(state.currentPlayer, 2);
  state = move(state, 2, { type: 'check' });
  assert.equal(state.street, 'flop');
  assert.equal(state.board.length, 3);
  // After the flop the button acts last
  assert.equal(state.currentPlayer, 2);
  state = continueAll(move(state, 2, { type: 'fold' }));
  assert.equal(state.button, 2);
  assert.deepEqual(state.bets, { 1: 20, 2: 10 });
  assert.equal(state.currentPlayer, 2);
});

test('a raise must be at least the last raise', () => {
  let state = lobby(4);
  assert.deepEqual(applyMove(state, 4, { type: 'raise', to: 39 }, seeded(1)), { error: 'The smallest raise is to 40' });
  state = move(state, 4, { type: 'raise', to: 40 });
  assert.deepEqual(options(state, 1), { toCall: 40, canCheck: false, canRaise: true, minTo: 60, maxTo: 1000 });
  // A bigger raise sets the new minimum
  state = move(state, 1, { type: 'raise', to: 100 });
  assert.deepEqual(applyMove(state, 2, { type: 'raise', to: 150 }, seeded(1)), { error: 'The smallest raise is to 160' });
  state = move(state, 2, { type: 'raise', to: 160 });
  assert.equal(state.raiseSize, 60);

  // After the flop the first bet must be at least the big blind
  let flop = lobby(2);
  flop = move(move(flop, 1, { type: 'call' }), 2, { type: 'check' });
  assert.deepEqual(applyMove(flop, 2, { type: 'raise', to: 10 }, seeded(1)), { error: 'The smallest bet is 20' });
  flop = move(flop, 2, { type: 'raise', to: 20 });
  assert.equal(flop.lastMove?.bet, true);

  // An all-in for less than a full raise is allowed but does not reopen the betting
  let short = lobby(3);
  short = { ...short, chips: { ...short.chips, 2: 40 } }; // Bob has 50 with his small blind
  short = move(short, 1, { type: 'raise', to: 40 });
  short = move(short, 2, { type: 'raise', to: 50 });
  assert.equal(short.raiseSize, 20); // still the last full raise
  short = move(short, 3, { type: 'call' });
  // Alice already acted and faces only 10 more: she may call or fold, not raise
  assert.equal(options(short, 1).canRaise, false);
  assert.deepEqual(applyMove(short, 1, { type: 'raise', to: 90 }, seeded(1)), { error: 'The betting is not open to you' });
  short = move(short, 1, { type: 'call' });
  assert.equal(short.street, 'flop');
});

test('short all-ins that add up to a full raise do reopen the betting', () => {
  let state = lobby(4);
  state = { ...state, chips: { ...state.chips, 1: 150, 2: 190 } };
  state = move(state, 4, { type: 'raise', to: 100 }); // a raise of 80
  state = move(state, 1, { type: 'raise', to: 150 }); // all in, 50 more
  state = move(state, 2, { type: 'raise', to: 200 }); // all in, 50 more: 100 since Dan acted
  state = move(state, 3, { type: 'call' });
  assert.equal(options(state, 4).canRaise, true);
});

test('betting ends when every active player has matched or is all in', () => {
  let state = lobby(3);
  state = { ...state, chips: { ...state.chips, 1: 30 } };
  state = move(state, 1, { type: 'raise', to: 30 }); // all in for a short raise
  state = move(state, 2, { type: 'call' });
  assert.equal(state.street, 'preflop');
  state = move(state, 3, { type: 'call' });
  assert.equal(state.street, 'flop');
  assert.deepEqual(state.bets, { 1: 0, 2: 0, 3: 0 });
  // The all-in player is skipped; the first player left of the button with chips acts
  assert.equal(state.currentPlayer, 2);
  state = move(state, 2, { type: 'check' });
  state = move(state, 3, { type: 'check' });
  assert.equal(state.street, 'turn');
  assert.equal(state.board.length, 4);

  // With nobody left to bet against, the board is dealt out to a showdown
  let allIn = lobby(2);
  allIn = move(allIn, 1, { type: 'raise', to: 1000 });
  allIn = move(allIn, 2, { type: 'call' });
  assert.equal(allIn.board.length, 5);
  assert.equal(allIn.handResult?.showdown, true);
  assert.equal(allIn.isGameOver || allIn.handResult?.pots.length === 1, true);
});

test('every move type: fold, check, call and raise', () => {
  let state = lobby(3);
  state = move(state, 1, { type: 'raise', to: 60 });
  assert.equal(state.chips[1], 940);
  assert.deepEqual(state.lastMove, { type: 'raise', playerNumber: 1, to: 60, paid: 60, allIn: false, bet: false });
  assert.equal(state.gameStatus, 'Alice raised to 60');
  state = move(state, 2, { type: 'fold' });
  assert.deepEqual(state.folded, [2]);
  state = move(state, 3, { type: 'call' });
  assert.equal(state.gameStatus, 'Cara called 40. The flop is dealt');
  assert.equal(state.chips[3], 940);
  assert.deepEqual(state.contributed, { 1: 60, 2: 10, 3: 60 });
  assert.deepEqual(computePots(state), [{ amount: 130, eligible: [1, 3] }]);
  // Bob folded, so Cara acts first after the flop
  assert.equal(state.currentPlayer, 3);
  state = move(state, 3, { type: 'check' });
  assert.equal(state.gameStatus, 'Cara checked');
  state = move(state, 1, { type: 'raise', to: 100 });
  assert.equal(state.gameStatus, 'Alice bet 100');
  state = move(state, 3, { type: 'fold' });
  assert.equal(state.handResult?.showdown, false);
  assert.deepEqual(state.handResult?.won, { 1: 230 });
  assert.deepEqual(state.handResult?.shown, {});
  assert.equal(state.chips[1], 1070);
});

test('side pots split correctly with three different all-in amounts', () => {
  assert.deepEqual(computePots({
    contributed: { 1: 100, 2: 300, 3: 600, 4: 600, 5: 50 }, chips: { 1: 0, 2: 0, 3: 0, 4: 400, 5: 950 }, dealtIn: [1, 2, 3, 4, 5], folded: [5]
  }), [
    { amount: 450, eligible: [1, 2, 3, 4] },
    { amount: 600, eligible: [2, 3, 4] },
    { amount: 600, eligible: [3, 4] }
  ]);
  // Alice has the best hand, then Bob, then Cara, then Dan
  let state = river([100, 300, 600, 1000], ['Ah As', 'Kh Ks', 'Qh Qs', '3d 4h'], '2c 7d 9h Jc 8s');
  state = move(state, 1, { type: 'raise', to: 100 });
  state = move(state, 2, { type: 'raise', to: 300 });
  state = move(state, 3, { type: 'raise', to: 600 });
  state = move(state, 4, { type: 'call' });
  const result = state.handResult ?? assert.fail('no showdown');
  assert.deepEqual(result.pots, [
    { amount: 400, winners: [1], hand: 'Pair of aces' },
    { amount: 600, winners: [2], hand: 'Pair of kings' },
    { amount: 600, winners: [3], hand: 'Pair of queens' }
  ]);
  assert.deepEqual(state.chips, { 1: 400, 2: 600, 3: 600, 4: 400 });
  // An uncalled bet goes back without a contest
  let uncalled = river([1000, 200], ['Ah As', 'Kh Ks'], '2c 7d 9h Jc 8s');
  uncalled = move(uncalled, 1, { type: 'raise', to: 500 });
  uncalled = move(uncalled, 2, { type: 'call' });
  assert.deepEqual(uncalled.handResult?.pots, [
    { amount: 400, winners: [1], hand: 'Pair of aces' },
    { amount: 300, winners: [1], hand: null }
  ]);
});

test('a split pot gives the odd chip as the article says', () => {
  // To the first winners after the button, going clockwise
  assert.deepEqual(splitPot(25, [1, 2], 3), { 1: 13, 2: 12 });
  assert.deepEqual(splitPot(25, [1, 2], 1), { 1: 12, 2: 13 });
  assert.deepEqual(splitPot(32, [1, 3, 4], 2), { 3: 11, 4: 11, 1: 10 });
  // Both play the board, a straight, and Alice is first after the button
  let state = river([100, 100, 1000], ['Ah 2s', 'Kh 2d', '3c 4c'], '5c 6d 7h 8c 9s', {
    contributed: { 1: 15, 2: 15, 3: 5 }, folded: [3], button: 3
  });
  state = move(state, 1, { type: 'check' });
  state = move(state, 2, { type: 'check' });
  assert.deepEqual(state.handResult?.pots, [{ amount: 35, winners: [1, 2], hand: 'Straight, nine high' }]);
  assert.deepEqual(state.handResult?.won, { 1: 18, 2: 17 });
  assert.match(state.gameStatus, /Alice and Bob split 35 with Straight, nine high$/);
});

test('a player with no chips is out and skipped', () => {
  let state = lobby(3);
  // Cara goes all in and loses everything
  state = { ...state, holeCards: { 1: cards('Ah As'), 2: cards('7d 2c'), 3: cards('Kh Ks') }, deck: cards('3h 4h 9c Jd 5s 8d 10h 6h') };
  state = move(state, 1, { type: 'raise', to: 1000 });
  state = move(state, 2, { type: 'fold' });
  state = move(state, 3, { type: 'call' });
  assert.deepEqual(state.chips, { 1: 2010, 2: 990, 3: 0 });
  assert.equal(state.gameStatus, 'Cara called 980 (all in). The board is dealt out. Alice wins 2,010 with Pair of aces. Cara is out of chips');
  // Cara does not have to continue
  state = act(act(state, 1, { type: 'acknowledgeRound' }), 2, { type: 'acknowledgeRound' });
  assert.equal(state.handNumber, 2);
  assert.deepEqual(state.dealtIn, [1, 2]);
  assert.equal(state.holeCards[3], undefined);
  // Heads-up now: Bob has the button and the small blind
  assert.equal(state.button, 2);
  assert.deepEqual(state.bets, { 1: 20, 2: 10 });
  state = move(state, 2, { type: 'call' });
  state = move(state, 1, { type: 'check' });
  assert.equal(state.currentPlayer, 1);
  state = move(state, 1, { type: 'check' });
  assert.equal(state.currentPlayer, 2);
  // The button passes over Cara too
  state = continueAll(move(move(state, 2, { type: 'raise', to: 20 }), 1, { type: 'fold' }));
  assert.equal(state.button, 1);
});

test('Continue waits for every connected player with chips', () => {
  let state = lobby(3);
  state = move(move(state, 1, { type: 'fold' }), 2, { type: 'fold' });
  assert.ok(state.handResult);
  state = act(state, 1, { type: 'acknowledgeRound' });
  assert.deepEqual(state.handResult?.acknowledged, [1]);
  assert.equal(state.gameStatus, 'Alice is ready for the next hand');
  state = disconnectPlayer(holdem, state, 3, seeded(2));
  assert.equal(state.handNumber, 1);
  state = act(state, 2, { type: 'acknowledgeRound' });
  assert.equal(state.handNumber, 2);
  assert.equal(state.handResult, null);
  assert.deepEqual(applyAction(state, 1, { type: 'acknowledgeRound' }, seeded(1)), { error: 'Nothing to continue' });
});

test('the end vote ends the game only when every player with chips votes yes, ranked by chips', () => {
  let state = lobby(3);
  assert.deepEqual(applyAction(state, 1, { type: 'voteEnd', yes: true }, seeded(1)), { error: 'Vote to end between hands' });
  state = move(move(state, 1, { type: 'fold' }), 2, { type: 'fold' });
  state = { ...state, chips: { 1: 1500, 2: 0, 3: 1500 } };
  assert.deepEqual(applyAction(state, 2, { type: 'voteEnd', yes: true }, seeded(1)), { error: 'Only players with chips vote' });
  state = act(state, 1, { type: 'voteEnd', yes: true });
  assert.deepEqual(state.endVotes, [1]);
  assert.equal(state.isGameOver, false);
  state = act(state, 1, { type: 'voteEnd', yes: false });
  assert.deepEqual(state.endVotes, []);
  state = act(state, 3, { type: 'voteEnd', yes: true });
  state = act(state, 1, { type: 'voteEnd', yes: true });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1, 3]);
  assert.equal(state.gameStatus, 'The game ends by vote: Alice 1,500, Cara 1,500, Bob 0');
  assert.deepEqual(applyAction(state, 1, { type: 'acknowledgeRound' }, seeded(1)), { error: 'The game is over' });

  // A new hand clears the votes
  let cleared = move(move(lobby(3), 1, { type: 'fold' }), 2, { type: 'fold' });
  cleared = continueAll(act(cleared, 1, { type: 'voteEnd', yes: true }));
  assert.deepEqual(cleared.endVotes, []);
});

test('one player with every chip ends the game', () => {
  let state = river([5, 5], ['Ah As', 'Kh Ks'], '2c 7d 9h Jc 8s', { contributed: { 1: 995, 2: 995 } });
  state = move(state, 1, { type: 'raise', to: 5 }); // all in, below the big blind
  state = move(state, 2, { type: 'call' });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.gameStatus, 'Bob called 5 (all in). Alice wins 2,000 with Pair of aces. Alice has every chip and wins!');
});

test('a player leaving folds their hand, their chips leave the table and the hand goes on', () => {
  let state = lobby(4);
  state = move(state, 4, { type: 'raise', to: 60 });
  // Bob, the small blind, is dismissed while it is Alice's turn
  state = removePlayer(holdem, state, 2, seeded(3));
  assert.deepEqual(state.folded, [2]);
  assert.equal(state.chips[2], undefined);
  assert.equal(state.contributed[2], 10); // his blind stays in the pot
  assert.equal(state.currentPlayer, 1);
  state = move(state, 1, { type: 'call' });
  // Cara holds the turn and leaves: it moves on to Dan
  assert.equal(state.currentPlayer, 3);
  state = removePlayer(holdem, state, 3, seeded(3));
  assert.equal(state.street, 'flop'); // Cara's departure finished the betting round
  assert.equal(state.currentPlayer, 4);
  assert.deepEqual(computePots(state), [{ amount: 150, eligible: [1, 4] }]);
  state = move(state, 4, { type: 'check' });
  assert.equal(state.currentPlayer, 1);

  // The last other player in the hand leaves: Alice wins the pot, and with Cara out of chips she has every chip
  let last = river([500, 500, 0], ['Ah As', 'Kh Ks', '2c 2d'], '2h 7d 9h Jc 8s', {
    dealtIn: [1, 2], contributed: { 1: 1000, 2: 1000 }, button: 2
  });
  last = removePlayer(holdem, last, 2, seeded(3));
  assert.deepEqual(last.handResult?.won, { 1: 2000 });
  assert.equal(last.handResult?.showdown, false);
  assert.equal(last.isGameOver, true);
  assert.deepEqual(last.winners, [1]);
  assert.equal(last.chips[1], 2500);
});

test('a leaver who had voted to end clears the votes; one who had not may complete them', () => {
  let state = move(move(lobby(3), 1, { type: 'fold' }), 2, { type: 'fold' });
  state = act(act(state, 1, { type: 'voteEnd', yes: true }), 2, { type: 'voteEnd', yes: true });
  const cleared = removePlayer(holdem, state, 2, seeded(3));
  assert.deepEqual(cleared.endVotes, []);
  assert.equal(cleared.isGameOver, false);
  const ended = removePlayer(holdem, state, 3, seeded(3));
  assert.equal(ended.isGameOver, true);
});

test('dismissed player mid-turn: the hand never waits for them', () => {
  let state: GameState = { ...lobby(3), started: true };
  state = disconnectPlayer(holdem, state, 1, seeded(1));
  assert.equal(state.currentPlayer, 1);
  state = removePlayer(holdem, state, 1, seeded(1));
  assert.equal(state.currentPlayer, 2);
  state = move(state, 2, { type: 'fold' });
  assert.deepEqual(state.handResult?.won, { 3: 30 });
});

test('invalid moves', () => {
  const state = lobby(3);
  const tries: [unknown, string][] = [
    [null, 'Invalid move'],
    [{ type: 'shove' }, 'Invalid move'],
    [{ type: 'raise' }, 'Invalid move'],
    [{ type: 'raise', to: 50.5 }, 'Invalid move'],
    [{ type: 'raise', to: '60' }, 'Invalid move'],
    [{ type: 'check' }, 'You must call 20, raise or fold'],
    [{ type: 'raise', to: 1001 }, 'You have only 1,000 chips'],
    [{ type: 'raise', to: 20 }, 'The smallest raise is to 40']
  ];
  for (const [bad, error] of tries) assert.deepEqual(applyMove(state, 1, bad, seeded(1)), { error });
  const flop = move(move(move(state, 1, { type: 'call' }), 2, { type: 'call' }), 3, { type: 'check' });
  assert.deepEqual(applyMove(flop, 2, { type: 'call' }, seeded(1)), { error: 'Nothing to call: check instead' });
  // Between hands nobody moves
  const done = move(move(state, 1, { type: 'fold' }), 2, { type: 'fold' });
  assert.deepEqual(platformMove(holdem, done, 3, { type: 'check' }, seeded(1)), { error: 'Not your turn' });
  assert.deepEqual(applyAction(done, 1, { type: 'voteEnd', yes: 'yes' }, seeded(1)), { error: 'Unknown action' });
  assert.deepEqual(applyAction(done, 1, { type: 'dance' }, seeded(1)), { error: 'Unknown action' });
  // Raising when nobody could answer it
  let allIn = lobby(2);
  allIn = move(allIn, 1, { type: 'raise', to: 1000 });
  assert.deepEqual(applyMove(allIn, 2, { type: 'raise', to: 1000 }, seeded(1)), { error: 'The smallest raise is to 1,980' });
  assert.equal(options(allIn, 2).canRaise, false);
});

test('table view hides hands', () => {
  let state = lobby(3, seeded(4));
  const views: GameState[] = [state];
  state = move(state, 1, { type: 'fold' });
  views.push(state);
  state = move(state, 2, { type: 'call' });
  views.push(state);
  state = move(state, 3, { type: 'check' });
  views.push(state);
  for (const street of ['flop', 'turn', 'river']) {
    assert.equal(state.street, street);
    state = move(move(state, 2, { type: 'check' }), 3, { type: 'check' });
    views.push(state);
  }
  const result = state.handResult ?? assert.fail('no showdown');
  assert.deepEqual(Object.keys(result.shown), ['2', '3']);
  const folded = JSON.stringify(state.holeCards[1]);
  for (const step of views) {
    const table = toPublicState(step, false, null);
    for (const key of ['holeCards', 'deck']) assert.equal(key in table, false);
    assert.deepEqual(table.myCards, []);
    const text = JSON.stringify(table);
    for (const card of state.holeCards[1]) assert.equal(text.includes(JSON.stringify(card)), false, `${folded} leaked`);
    if (!step.handResult) {
      for (const card of [...state.holeCards[2], ...state.holeCards[3]]) assert.equal(text.includes(JSON.stringify(card)), false);
    }
  }
  // Each player sees their own cards, and only theirs
  const mine = toPublicState(views[1], false, 2);
  assert.deepEqual(mine.myCards, state.holeCards[2]);
  assert.equal(JSON.stringify(mine).includes(JSON.stringify(state.holeCards[3][0])), false);

  // A winner by folds keeps their cards hidden
  const folds = move(move(lobby(3, seeded(5)), 1, { type: 'fold' }), 2, { type: 'fold' });
  const winnerCards = folds.holeCards[3];
  const text = JSON.stringify(toPublicState(folds, false, 1));
  for (const card of winnerCards) assert.equal(text.includes(JSON.stringify(card)), false);
});

test('undo reshuffles the deck', () => {
  const state = lobby(3);
  const undone = holdem.onUndo?.(state, seeded(7)) ?? assert.fail('no onUndo');
  assert.notDeepEqual(undone.deck, state.deck);
  assert.deepEqual(undone.deck.map(card => JSON.stringify(card)).sort(), state.deck.map(card => JSON.stringify(card)).sort());
});

test('the pots are public, the deck count is not needed, and the viewer\'s options are worked out from the view', () => {
  const state = move(lobby(3), 1, { type: 'raise', to: 60 });
  const view = toPublicState(state, false, 2);
  assert.deepEqual(view.pots, [{ amount: 90, eligible: [1, 2, 3] }]);
  assert.deepEqual(options(view, 2), { toCall: 50, canCheck: false, canRaise: true, minTo: 100, maxTo: 1000 });
});
