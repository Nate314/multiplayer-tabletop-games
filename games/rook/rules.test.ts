import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BID_STEP, HAND_SIZE, MAX_BID, MIN_BID, NEST_SIZE, ROOK, TARGET_SCORE, buildDeck, canPlayCard, cardName, cardPoints,
  createGameState, dealHand, handPoints, teamOf, toPublicState, trickWinner
} from './rules.ts';
import { rook } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, Color, GameState, Move, PublicGameState, Result } from './types.ts';

const c = (color: Color, number: number): Card => ({ color, number });
const red = (n: number) => c('red', n);
const green = (n: number) => c('green', n);
const black = (n: number) => c('black', n);
const yellow = (n: number) => c('yellow', n);

function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lobby(count = 4): GameState {
  let state = createGameState('g');
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan'].slice(0, count)) {
    const result = addPlayer(rook, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Moves through the platform, which checks the turn first
const move = (state: GameState, seat: number, m: Move | unknown, random: Random = seeded(3)) =>
  applyMove(rook, state, seat, m, random);

// A hand under way, red trump, seat 4 dealt, seat 1 bid 80 and leads. Two cards each, the nest laid aside.
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3, 4],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' },
    dealer: 4,
    phase: 'play',
    hands: { 1: [green(5), red(6)], 2: [green(14), black(7)], 3: [green(10), ROOK], 4: [yellow(9), red(12)] },
    nest: [black(5), yellow(6), yellow(7), yellow(8), black(8)],
    bidding: { high: { seat: 1, amount: 80 }, passed: [2, 3, 4] },
    bidder: 1,
    bid: 80,
    trump: 'red',
    ...overrides
  };
}

function countCards(state: GameState): number {
  return state.nest.length + Object.values(state.hands).flat().length;
}

test('deck and deal match the variant', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 41);
  assert.equal(new Set(deck.map(cardName)).size, 41);
  assert.equal(deck.filter(card => card.color === 'rook').length, 1);
  for (const color of ['red', 'yellow', 'green', 'black'] as Color[]) {
    assert.deepEqual(deck.filter(card => card.color === color).map(card => 'number' in card && card.number),
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  }
  assert.equal(HAND_SIZE, 9);
  assert.equal(NEST_SIZE, 5);

  const state = lobby();
  assert.equal(countCards(state), 41);
  for (const seat of [1, 2, 3, 4]) assert.equal(state.hands[seat].length, HAND_SIZE);
  assert.equal(state.nest.length, NEST_SIZE);
  assert.equal(state.phase, 'bidding');
  // The dealer's left bids first
  assert.equal(state.currentPlayer, state.dealer === 4 ? 1 : (state.dealer ?? 0) + 1);
});

test('nothing is dealt until four players are seated', () => {
  const state = lobby(3);
  assert.equal(countCards(state), 0);
  assert.equal(state.phase, 'bidding');
});

test('counters are worth 5, 10, 10 and 20 for the Rook, 120 in all', () => {
  assert.equal(cardPoints(red(5)), 5);
  assert.equal(cardPoints(red(10)), 10);
  assert.equal(cardPoints(red(14)), 10);
  assert.equal(cardPoints(red(13)), 0);
  assert.equal(cardPoints(ROOK), 20);
  assert.equal(handPoints(buildDeck()), MAX_BID);
});

test('partners sit across: seats 1 and 3 against 2 and 4', () => {
  assert.deepEqual([1, 2, 3, 4].map(teamOf), [0, 1, 0, 1]);
});

test('bidding goes around in steps of 5 and a pass is final', () => {
  let state = dealHand(lobby(), 4, seeded(1));
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(move(state, 1, { type: 'bid', amount: MIN_BID - BID_STEP }), { error: `Bid at least ${MIN_BID}` });
  assert.deepEqual(move(state, 1, { type: 'bid', amount: 72 }), { error: `Bid in steps of ${BID_STEP}` });
  assert.deepEqual(move(state, 1, { type: 'bid', amount: MAX_BID + 5 }), { error: `The highest bid is ${MAX_BID}` });
  state = ok(move(state, 1, { type: 'bid', amount: 70 }));
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(move(state, 2, { type: 'bid', amount: 70 }), { error: 'Bid more than 70' });
  state = ok(move(state, 2, { type: 'pass' }));
  state = ok(move(state, 3, { type: 'bid', amount: 85 }));
  state = ok(move(state, 4, { type: 'pass' }));
  // Seat 2 passed, so after seat 1 the turn skips to seat 3
  assert.equal(state.currentPlayer, 1);
  state = ok(move(state, 1, { type: 'bid', amount: 90 }));
  assert.equal(state.currentPlayer, 3);
  state = ok(move(state, 3, { type: 'pass' }));
  assert.equal(state.phase, 'discard');
  assert.equal(state.bidder, 1);
  assert.equal(state.bid, 90);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'Alice won the bidding at 90 and takes the nest');
});

test('a bid of the maximum ends the bidding at once', () => {
  let state = dealHand(lobby(), 4, seeded(1));
  state = ok(move(state, 1, { type: 'pass' }));
  state = ok(move(state, 2, { type: 'bid', amount: MAX_BID }));
  assert.equal(state.phase, 'discard');
  assert.equal(state.bidder, 2);
});

test('when all four pass the next dealer deals again', () => {
  let state = dealHand(lobby(), 4, seeded(1));
  for (const seat of [1, 2, 3, 4]) state = ok(move(state, seat, { type: 'pass' }));
  assert.equal(state.dealer, 1);
  assert.equal(state.phase, 'bidding');
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.bidding, { high: null, passed: [] });
  assert.equal(countCards(state), 41);
  assert.deepEqual(state.lastMove, { type: 'pass', playerNumber: 4, won: null, redeal: true });
});

test('the bid winner takes the nest and discards back to a hand', () => {
  let state = dealHand(lobby(), 4, seeded(1));
  const nest = state.nest;
  state = ok(move(state, 1, { type: 'bid', amount: 70 }));
  for (const seat of [2, 3, 4]) state = ok(move(state, seat, { type: 'pass' }));
  assert.equal(state.hands[1].length, HAND_SIZE + NEST_SIZE);
  assert.equal(state.nest.length, 0);
  for (const card of nest) assert.ok(state.hands[1].some(held => cardName(held) === cardName(card)));

  // The bidder sees the nest in their hand; the others do not
  assert.equal(toPublicState(state, false, 1).hand.length, 14);
  assert.equal(toPublicState(state, false, 2).handCounts[1], 14);

  const hand = state.hands[1];
  assert.deepEqual(move(state, 1, { type: 'discard', cards: hand.slice(0, 4) }), { error: 'Lay aside exactly 5 cards' });
  assert.deepEqual(move(state, 1, { type: 'discard', cards: [hand[0], hand[0], hand[1], hand[2], hand[3]] }),
    { error: 'Lay aside 5 different cards' });
  assert.deepEqual(move(state, 1, { type: 'nameTrump', color: 'red' }), { error: 'Lay aside 5 cards first' });
  const laid = hand.slice(0, 5);
  state = ok(move(state, 1, { type: 'discard', cards: laid }));
  assert.equal(state.hands[1].length, HAND_SIZE);
  assert.deepEqual(state.nest, laid);
  assert.equal(state.phase, 'trump');
  assert.equal(state.currentPlayer, 1);

  // Only the bidder sees what was laid aside
  assert.deepEqual(toPublicState(state, false, 1).discards, laid);
  for (const viewer of [2, 3, 4, null]) assert.deepEqual(toPublicState(state, false, viewer).discards, []);

  state = ok(move(state, 1, { type: 'nameTrump', color: 'green' }));
  assert.equal(state.trump, 'green');
  assert.equal(state.phase, 'play');
  // The player to the dealer's left leads
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'Alice named green trump');
});

test('must follow suit when able', () => {
  const state = game({ currentPlayer: 2, trick: [{ seat: 1, card: green(5) }] });
  assert.deepEqual(move(state, 2, { type: 'play', card: black(7) }), { error: 'Follow suit: play green' });
  assert.equal(canPlayCard(state.hands[2], green(14), state.trick, 'red'), true);
  // With no green, anything goes
  assert.equal(canPlayCard([red(6), black(7)], black(7), state.trick, 'red'), true);
});

test('the Rook may be played at any time, and counts as trump', () => {
  const trick = [{ seat: 2, card: green(14) }];
  assert.equal(canPlayCard([green(10), ROOK], ROOK, trick, 'red'), true);
  // The Rook led calls for trump
  assert.equal(canPlayCard([red(6), green(5)], green(5), [{ seat: 3, card: ROOK }], 'red'), false);
  // Trump led with only the Rook as trump: it must be played
  assert.equal(canPlayCard([ROOK, green(5)], green(5), [{ seat: 3, card: red(9) }], 'red'), false);
  assert.equal(canPlayCard([ROOK, green(5)], ROOK, [{ seat: 3, card: red(9) }], 'red'), true);
});

test('trick goes to the highest trump, else the highest of the led suit', () => {
  assert.equal(trickWinner([
    { seat: 1, card: green(5) }, { seat: 2, card: green(14) }, { seat: 3, card: green(10) }, { seat: 4, card: yellow(14) }
  ], 'red'), 2);
  assert.equal(trickWinner([
    { seat: 1, card: green(5) }, { seat: 2, card: green(14) }, { seat: 3, card: red(5) }, { seat: 4, card: red(6) }
  ], 'red'), 4);
  assert.equal(trickWinner([
    { seat: 1, card: red(14) }, { seat: 2, card: ROOK }, { seat: 3, card: red(13) }, { seat: 4, card: red(6) }
  ], 'red'), 2);
  assert.equal(trickWinner([
    { seat: 1, card: ROOK }, { seat: 2, card: red(14) }, { seat: 3, card: green(13) }, { seat: 4, card: red(6) }
  ], 'red'), 1);
});

test('the winner of a trick leads the next', () => {
  let state = game();
  state = ok(move(state, 1, { type: 'play', card: green(5) }));
  state = ok(move(state, 2, { type: 'play', card: green(14) }));
  state = ok(move(state, 3, { type: 'play', card: green(10) }));
  state = ok(move(state, 4, { type: 'play', card: red(12) }));
  assert.deepEqual(state.trick, []);
  assert.equal(state.lastTrick?.winner, 4);
  assert.deepEqual(state.tricksWon, [0, 1]);
  assert.deepEqual(state.captured, [0, 25]);
  assert.equal(state.currentPlayer, 4);
  assert.deepEqual(state.lastMove, { type: 'play', playerNumber: 4, card: red(12), trickWinner: 4 });
});

test('points per hand total the variant\'s maximum, last-trick bonus included', () => {
  // A whole hand played with legal moves: the counters taken plus the nest always make 120
  for (const seed of [1, 2, 3]) {
    let state = dealHand(lobby(), 4, seeded(seed));
    state = ok(move(state, 1, { type: 'bid', amount: 70 }));
    for (const seat of [2, 3, 4]) state = ok(move(state, seat, { type: 'pass' }));
    state = ok(move(state, 1, { type: 'discard', cards: state.hands[1].slice(0, 5) }));
    state = ok(move(state, 1, { type: 'nameTrump', color: 'black' }));
    while (state.phase === 'play') {
      const seat = state.currentPlayer ?? assert.fail('nobody to play');
      const card = state.hands[seat].find(held => canPlayCard(state.hands[seat], held, state.trick, 'black'));
      state = ok(move(state, seat, { type: 'play', card }));
    }
    const summary = state.roundSummary ?? assert.fail('no summary');
    assert.equal(summary.points[0] + summary.points[1], MAX_BID);
    assert.equal(summary.points[teamOf(summary.lastTrick)] >= summary.nestPoints, true);
  }
});

test('the last trick takes the nest', () => {
  const state = game({
    hands: { 1: [green(5)], 2: [green(14)], 3: [green(10)], 4: [yellow(9)] },
    nest: [black(5), yellow(10), yellow(7), yellow(8), ROOK], // 35 points
    captured: [40, 30],
    tricksWon: [4, 4]
  });
  let next = ok(move(state, 1, { type: 'play', card: green(5) }));
  next = ok(move(next, 2, { type: 'play', card: green(14) }));
  next = ok(move(next, 3, { type: 'play', card: green(10) }));
  next = ok(move(next, 4, { type: 'play', card: yellow(9) }));
  const summary = next.roundSummary ?? assert.fail('no summary');
  // Team 1 took 30, the last trick's 25 and the nest's 35
  assert.deepEqual(summary.points, [40, 90]);
  assert.equal(summary.nestPoints, 35);
  assert.equal(summary.lastTrick, 2);
  assert.equal(next.phase, 'handOver');
  assert.equal(next.currentPlayer, null);
});

function lastTrickOf(captured: [number, number], bid: number, scores: [number, number] = [0, 0]): GameState {
  // Seat 1 leads a 13, nobody else can beat it, and the trick holds no counters: team 0 takes the last trick and an empty nest
  const state = game({
    hands: { 1: [red(13)], 2: [green(13)], 3: [green(12)], 4: [green(11)] },
    nest: [black(6), yellow(6), yellow(7), yellow(8), black(8)],
    captured,
    tricksWon: [4, 4],
    bid,
    bidding: { high: { seat: 1, amount: bid }, passed: [2, 3, 4] },
    scores
  });
  let next = state;
  for (const [seat, card] of [[1, red(13)], [2, green(13)], [3, green(12)], [4, green(11)]] as const) {
    next = ok(move(next, seat, { type: 'play', card }));
  }
  return next;
}

test('a bidding team that makes its bid scores what it took', () => {
  const next = lastTrickOf([80, 40], 80);
  assert.deepEqual(next.scores, [80, 40]);
  assert.equal(next.roundSummary?.made, true);
});

test('bidding team that misses loses its bid', () => {
  const next = lastTrickOf([75, 45], 80, [30, 10]);
  assert.deepEqual(next.scores, [-50, 55]);
  assert.deepEqual(next.roundSummary?.change, [-80, 45]);
  assert.equal(next.roundSummary?.made, false);
  assert.equal(next.gameStatus, 'Alice\'s team bid 80 and took 75: they lose 80');
});

test('first team to 500 wins after Continue', () => {
  // A hand that leaves both teams short: Continue deals the next one, passing the deal left
  let state = lastTrickOf([80, 40], 80);
  assert.equal(state.isGameOver, false);
  assert.deepEqual(move(state, 1, { type: 'bid', amount: 70 }), { error: 'Not your turn' });
  for (const seat of [1, 2, 3]) state = ok(rook.applyAction?.(state, seat, { type: 'acknowledgeRound' }, seeded(1)) ?? assert.fail());
  assert.equal(state.phase, 'handOver');
  state = ok(rook.applyAction?.(state, 4, { type: 'acknowledgeRound' }, seeded(1)) ?? assert.fail());
  assert.equal(state.phase, 'bidding');
  assert.equal(state.handNumber, 2);
  assert.equal(state.dealer, 1);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.scores, [80, 40]);
  assert.equal(countCards(state), 41);

  // A hand that takes a team to 500 ends the game
  const won = lastTrickOf([80, 40], 80, [430, 300]);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1, 3]);
  assert.equal(won.gameStatus, 'Alice and Cara win with 510 points!');
  assert.deepEqual(rook.applyAction?.(won, 1, { type: 'acknowledgeRound' }, seeded(1)), { error: 'The game is over' });
});

test('when both teams pass 500 the higher total wins, and a tie plays on', () => {
  const higher = lastTrickOf([70, 50], 70, [450, 480]);
  assert.deepEqual(higher.winners, [2, 4]);
  const tie = lastTrickOf([70, 50], 70, [450, 470]);
  assert.equal(tie.isGameOver, false);
  assert.match(tie.gameStatus, /tied/);
  assert.equal(TARGET_SCORE, 500);
});

test('the next hand does not wait for disconnected players', () => {
  let state = lastTrickOf([80, 40], 80);
  state = ok(rook.applyAction?.(state, 1, { type: 'acknowledgeRound' }, seeded(1)) ?? assert.fail());
  state = ok(rook.applyAction?.(state, 2, { type: 'acknowledgeRound' }, seeded(1)) ?? assert.fail());
  state = ok(rook.applyAction?.(state, 3, { type: 'acknowledgeRound' }, seeded(1)) ?? assert.fail());
  state = disconnectPlayer(rook, state, 4, seeded(1));
  assert.equal(state.phase, 'bidding');
});

test('a player leaving ends the game and the other team wins', () => {
  const state = removePlayer(rook, game(), 3, seeded(1));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2, 4]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.gameStatus, 'Cara left, so the partnership is broken: Bob and Dan win');
});

test('dismissed player mid-turn', () => {
  // Dismissed while bidding on their own turn, and while holding the nest
  let state = dealHand(lobby(), 4, seeded(1));
  state = { ...ok(move(state, 1, { type: 'bid', amount: 70 })) };
  const bidding = removePlayer(rook, disconnectPlayer(rook, state, 2, seeded(1)), 2, seeded(1));
  assert.equal(bidding.isGameOver, true);
  assert.deepEqual(bidding.winners, [1, 3]);
  for (const seat of [2, 3, 4]) state = ok(move(state, seat, { type: 'pass' }));
  const discarding = removePlayer(rook, state, 1, seeded(1));
  assert.equal(discarding.isGameOver, true);
  assert.deepEqual(discarding.winners, [2, 4]);
  assert.deepEqual(move(discarding, 2, { type: 'pass' }), { error: 'The game is over' });
});

test('invalid moves', () => {
  const state = game();
  const bad: unknown[] = [
    null, 'play', 7, {}, { type: 'shout' },
    { type: 'play' }, { type: 'play', card: { color: 'red', number: 4 } }, { type: 'play', card: { color: 'red', number: 6.5 } },
    { type: 'play', card: { color: 'purple', number: 6 } }, { type: 'play', card: black(7) },
    { type: 'bid', amount: 80 }, { type: 'pass' }, { type: 'nameTrump', color: 'red' },
    { type: 'discard', cards: [] }
  ];
  for (const m of bad) {
    const result = move(state, 1, m);
    assert.ok('error' in result, `expected an error for ${JSON.stringify(m)}`);
  }
  assert.deepEqual(move(state, 1, { type: 'play', card: black(7) }), { error: 'You do not have that card' });
  assert.deepEqual(move(state, 2, { type: 'play', card: black(7) }), { error: 'Not your turn' });
  assert.deepEqual(move(state, 9, { type: 'play', card: black(7) }), { error: 'Not your turn' });

  const bidding = dealHand(lobby(), 4, seeded(1));
  for (const amount of [-5, 72.5, '80', null]) {
    assert.ok('error' in move(bidding, 1, { type: 'bid', amount }));
  }
  assert.deepEqual(move(bidding, 1, { type: 'play', card: bidding.hands[1][0] }), { error: 'Finish the bidding first' });
  assert.deepEqual(move(bidding, 1, { type: 'discard', cards: bidding.hands[1].slice(0, 5) }), { error: 'Only the bid winner lays aside cards, after the bidding' });

  let won = ok(move(bidding, 1, { type: 'bid', amount: 70 }));
  for (const seat of [2, 3, 4]) won = ok(move(won, seat, { type: 'pass' }));
  const notHeld = buildDeck().filter(card => !won.hands[1].some(held => cardName(held) === cardName(card))).slice(0, 5);
  assert.deepEqual(move(won, 1, { type: 'discard', cards: notHeld }), { error: 'You do not have those cards' });
  assert.deepEqual(move(won, 1, { type: 'discard', cards: 'all' }), { error: 'Invalid move' });
  assert.deepEqual(move(won, 1, { type: 'nameTrump', color: 'rook' }), { error: 'Invalid move' });

  assert.deepEqual(rook.applyAction?.(state, 1, { type: 'acknowledgeRound' }, seeded(1)), { error: 'Nothing to continue' });
  assert.deepEqual(rook.applyAction?.(state, 1, { type: 'other' }, seeded(1)), { error: 'Unknown action' });
});

test('table view hides hands', () => {
  // Every step of a short hand, through bidding, the nest, trump and a few tricks
  let state = dealHand(lobby(), 4, seeded(5));
  const steps: GameState[] = [state];
  state = ok(move(state, 1, { type: 'bid', amount: 75 }));
  steps.push(state);
  for (const seat of [2, 3, 4]) steps.push(state = ok(move(state, seat, { type: 'pass' })));
  steps.push(state = ok(move(state, 1, { type: 'discard', cards: state.hands[1].slice(0, 5) })));
  steps.push(state = ok(move(state, 1, { type: 'nameTrump', color: 'yellow' })));
  for (let i = 0; i < 8; i++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to play');
    const card = state.hands[seat].find(held => canPlayCard(state.hands[seat], held, state.trick, 'yellow'));
    steps.push(state = ok(move(state, seat, { type: 'play', card })));
  }
  for (const step of steps) {
    const table: PublicGameState = toPublicState(step, false, null) as PublicGameState;
    const text = JSON.stringify(table);
    assert.deepEqual(table.hand, []);
    assert.deepEqual(table.discards, []);
    for (const key of ['hands', 'nest', 'captured']) assert.equal(key in table, false);
    // No card in any hand or the nest shows up anywhere but in the trick being played and the last trick
    const shown = [...step.trick, ...(step.lastTrick?.plays ?? [])].map(play => JSON.stringify(play.card));
    for (const card of [...Object.values(step.hands).flat(), ...step.nest]) {
      if (!shown.includes(JSON.stringify(card))) assert.equal(text.includes(JSON.stringify(card)), false);
    }
    for (const seat of [1, 2, 3, 4]) {
      const own = toPublicState(step, false, seat);
      assert.deepEqual(own.hand, step.hands[seat]);
      assert.equal(own.handCounts[seat], step.hands[seat].length);
    }
  }
});

test('describes moves for the status line', () => {
  let state = game();
  state = ok(move(state, 1, { type: 'play', card: red(6) }));
  assert.equal(state.gameStatus, 'Alice played red 6');
  assert.equal(cardName(ROOK), 'the Rook');
});
