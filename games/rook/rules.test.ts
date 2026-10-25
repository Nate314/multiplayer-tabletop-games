import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import {
  BID_STEP, DEFENDERS, HAND_SIZE, MAX_BID, MIN_BID, NEST_SIZE, ROOK, SIX_TEAMS, targetScore, buildDeck, calledCount, canPlayCard,
  cardName, sameCard, cardPoints, createGameState, dealHand, dealSizes, handPoints, rookTeams, teamOf, teamOfSeat, toPublicState,
  trickWinner
} from './rules.ts';
import { rook } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import { houseRulesOf, setHouseRules, type HouseRuleValues } from '../../shared/houseRules.ts';
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

function lastTrickOf(captured: [number, number], bid: number, scores: [number, number] = [0, 0], overrides: Partial<GameState> = {}): GameState {
  // Seat 1 leads a 13, nobody else can beat it, and the trick holds no counters: team 0 takes the last trick and an empty nest
  const state = game({
    hands: { 1: [red(13)], 2: [green(13)], 3: [green(12)], 4: [green(11)] },
    nest: [black(6), yellow(6), yellow(7), yellow(8), black(8)],
    captured,
    tricksWon: [4, 4],
    bid,
    bidding: { high: { seat: 1, amount: bid }, passed: [2, 3, 4] },
    scores,
    ...overrides
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
  assert.equal(targetScore({}), 500);
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

test('the game ends at the chosen target', () => {
  const rules = { houseRules: withRules({ targetScore: 300 }) };
  const won = lastTrickOf([80, 40], 80, [230, 0], rules); // the bidders make 80: 230 + 80
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1, 3]);
  const short = lastTrickOf([80, 40], 80, [219, 0], rules);
  assert.equal(short.isGameOver, false);
  const standard = lastTrickOf([80, 40], 80, [230, 0], { houseRules: withRules({ targetScore: 500 }) });
  assert.equal(standard.isGameOver, false);
});

// Rook at 4 to 7 players: fixed teams at 4 and 6, and one team per seat at 5 and 7 until called partners

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Fay', 'Gus'];

// `count` players seated with "I know what I'm doing" ticked; `values` are set by the host once everyone is seated
function lobbyOf(count: number, values: HouseRuleValues = {}): GameState {
  let state: GameState = {
    ...createGameState('g'),
    houseRules: { host: 1, values: {}, maxPlayers: count, agreed: [], revision: 0 }
  };
  for (const name of NAMES.slice(0, count)) {
    const result = addPlayer(rook, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  if (Object.keys(values).length === 0) return state;
  return rook.resetLobby(ok(setHouseRules(rook.info, state, 1, { values, maxPlayers: count })), seeded(7));
}

// The first `calledCount` cards of the deck that `seat` does not hold
function notHeldBy(state: GameState, seat: number): Card[] {
  return buildDeck().filter(card => !state.hands[seat].some(held => sameCard(held, card))).slice(0, calledCount(state.activePlayers.length));
}

// Bids 70 with the first bidder, everyone else passes, the bidder lays aside the first cards of their hand and names
// black: at 5 and 7 the bidder is then to call partners
function toCalling(start: GameState, random: Random = seeded(3)): GameState {
  let state = start;
  const first = state.currentPlayer ?? assert.fail('nobody to bid');
  state = ok(move(state, first, { type: 'bid', amount: 70 }, random));
  while (state.phase === 'bidding') state = ok(move(state, state.currentPlayer ?? assert.fail(), { type: 'pass' }, random));
  const nest = dealSizes(Object.keys(state.hands).length).nest;
  state = ok(move(state, first, { type: 'discard', cards: state.hands[first].slice(0, nest) }, random));
  return ok(move(state, first, { type: 'nameTrump', color: 'black' }, random));
}

// Everyone plays their first legal card until the hand is over
function playOut(start: GameState, random: Random = seeded(3)): GameState {
  let state = start;
  while (state.phase === 'play') {
    const seat = state.currentPlayer ?? assert.fail('nobody to play');
    const card = state.hands[seat].find(held => canPlayCard(state.hands[seat], held, state.trick, 'black'));
    state = ok(move(state, seat, { type: 'play', card }, random));
  }
  return state;
}

// One hand played with legal moves: as toCalling, then at 5 and 7 the bidder calls the first cards they do not hold,
// then everyone plays their first legal card
function playHand(start: GameState, random: Random = seeded(3)): GameState {
  let state = toCalling(start, random);
  if (state.phase === 'callPartner') {
    const bidder = state.bidder ?? assert.fail('no bidder');
    state = ok(move(state, bidder, { type: 'callPartner', cards: notHeldBy(state, bidder) }, random));
  }
  return playOut(state, random);
}

// Hands until the game ends, everyone clicking Continue between them
function playGame(start: GameState): GameState {
  let state = start;
  for (let hands = 0; !state.isGameOver && hands < 300; hands++) {
    state = playHand(state, seeded(hands + 11));
    if (state.isGameOver) break;
    for (const seat of state.activePlayers) {
      state = ok(rook.applyAction?.(state, seat, { type: 'acknowledgeRound' }, seeded(hands)) ?? assert.fail());
    }
  }
  assert.equal(state.isGameOver, true);
  return state;
}

test('four players play exactly as before', () => {
  assert.deepEqual(rookTeams([1, 2, 3, 4], 'twoOfThree'), [[1, 3], [2, 4]]);
  assert.deepEqual(rookTeams([1, 2, 3, 4], 'threeOfTwo'), [[1, 3], [2, 4]]);
  assert.deepEqual(dealSizes(4), { hand: HAND_SIZE, nest: NEST_SIZE });
  const state = lobby();
  assert.deepEqual(state.teams, [[1, 3], [2, 4]]);
  assert.deepEqual(state.scores, [0, 0]);
  assert.deepEqual([1, 2, 3, 4].map(seat => teamOfSeat(state, seat)), [0, 1, 0, 1]);
  assert.deepEqual(houseRulesOf(rook.info, state).values, { targetScore: 500 });
  assert.deepEqual(rook.info.stretchedPlayers, { min: 4, max: 7 });
  assert.equal(rook.info.minPlayers, 4);
  assert.equal(rook.info.maxPlayers, 4);
  const done = playHand(state);
  assert.equal(done.roundSummary?.points.length, 2);
  assert.equal(done.scores.length, 2);
});

test('six players as two teams of three', () => {
  const state = lobbyOf(6);
  assert.deepEqual(state.teams, [[1, 3, 5], [2, 4, 6]]);
  assert.deepEqual(rookTeams([1, 2, 3, 4, 5, 6], 'twoOfThree'), [[1, 3, 5], [2, 4, 6]]);
  assert.deepEqual(state.scores, [0, 0]);
  // The last seat deals first and its left, seat 1, bids first
  assert.equal(state.dealer, 6);
  assert.equal(state.currentPlayer, 1);
  const done = playHand(state);
  const summary = done.roundSummary ?? assert.fail('no summary');
  assert.equal(summary.points[0] + summary.points[1], MAX_BID);
  assert.equal(done.tricksWon[0] + done.tricksWon[1], 6);
  assert.equal(teamOfSeat(done, 5), 0);
  const over = playGame(state);
  assert.equal(over.winners.length, 3);
  assert.ok(over.teams?.some(team => team.join() === over.winners.join()));
});

test('six players as three teams of two', () => {
  const state = lobbyOf(6, { sixTeams: 'threeOfTwo' });
  assert.deepEqual(rookTeams([1, 2, 3, 4, 5, 6], 'threeOfTwo'), [[1, 4], [2, 5], [3, 6]]);
  // Partners sit three apart
  assert.deepEqual(state.teams, [[1, 4], [2, 5], [3, 6]]);
  assert.deepEqual(state.scores, [0, 0, 0]);
  assert.deepEqual(state.tricksWon, [0, 0, 0]);
  const done = playHand(state);
  const summary = done.roundSummary ?? assert.fail('no summary');
  assert.equal(summary.points.length, 3);
  assert.equal(summary.points.reduce((sum, points) => sum + points, 0), MAX_BID);
  assert.equal(done.scores.length, 3);
  const over = playGame(state);
  assert.equal(over.winners.length, 2);
});

test('the defenders option is offered only for three teams of two', () => {
  assert.equal(SIX_TEAMS.label, 'Teams at 6 players');
  assert.equal(SIX_TEAMS.standard, 'twoOfThree');
  assert.deepEqual(SIX_TEAMS.choices.map(choice => choice.label), ['Two teams of three', 'Three teams of two']);
  assert.equal(DEFENDERS.label, 'Defending teams score');
  assert.equal(DEFENDERS.standard, 'separate');
  assert.deepEqual(DEFENDERS.choices, [
    { value: 'separate', label: 'Each team its own counters' },
    { value: 'together', label: 'Together, both teams\' counters' }
  ]);
  for (const seats of [4, 5, 7]) assert.equal(SIX_TEAMS.offered?.(seats, {}), false);
  assert.equal(SIX_TEAMS.offered?.(6, {}), true);
  assert.equal(DEFENDERS.offered?.(6, { sixTeams: 'threeOfTwo' }), true);
  assert.equal(DEFENDERS.offered?.(6, { sixTeams: 'twoOfThree' }), false);
  assert.equal(DEFENDERS.offered?.(4, { sixTeams: 'threeOfTwo' }), false);

  const six = lobbyOf(6);
  assert.deepEqual(houseRulesOf(rook.info, six).values, { targetScore: 500, sixTeams: 'twoOfThree' });
  assert.deepEqual(setHouseRules(rook.info, six, 1, { values: { defenders: 'together' }, maxPlayers: 6 }),
    { error: 'That is not a house rule of this game' });
  const three = ok(setHouseRules(rook.info, six, 1, { values: { sixTeams: 'threeOfTwo', defenders: 'together' }, maxPlayers: 6 }));
  assert.deepEqual(three.houseRules?.values, { targetScore: 500, sixTeams: 'threeOfTwo', defenders: 'together' });
  assert.deepEqual(houseRulesOf(rook.info, lobbyOf(6, { sixTeams: 'threeOfTwo' })).values,
    { targetScore: 500, sixTeams: 'threeOfTwo', defenders: 'separate' });
  assert.deepEqual(setHouseRules(rook.info, lobby(), 1, { values: { sixTeams: 'threeOfTwo' }, maxPlayers: null }),
    { error: 'That is not a house rule of this game' });
});

// The last trick at six in three teams of two: Alice (team 0) leads red 13 and nobody beats it, no counters in
// the trick or the nest, so the captured counters are the hand's points
function sixLastTrick(captured: number[], bid: number, defenders: 'separate' | 'together'): GameState {
  const others = [green(13), green(12), green(11), yellow(13), yellow(12)];
  const state: GameState = {
    ...game({
      activePlayers: [1, 2, 3, 4, 5, 6],
      playerNames: Object.fromEntries(NAMES.slice(0, 6).map((name, index) => [index + 1, name])),
      dealer: 6,
      hands: { 1: [red(13)], ...Object.fromEntries(others.map((card, index) => [index + 2, [card]])) },
      nest: [black(6), yellow(6), yellow(7), yellow(8), black(8)],
      captured,
      tricksWon: [2, 2, 1],
      scores: [0, 0, 0],
      bid,
      bidding: { high: { seat: 1, amount: bid }, passed: [2, 3, 4, 5, 6] }
    }),
    teams: [[1, 4], [2, 5], [3, 6]],
    houseRules: { ...withRules({ targetScore: 500, sixTeams: 'threeOfTwo', defenders }), maxPlayers: 6 }
  };
  let next = state;
  for (const seat of [1, 2, 3, 4, 5, 6]) next = ok(move(next, seat, { type: 'play', card: next.hands[seat][0] }));
  return next;
}

test('defending teams scoring separately and together', () => {
  const separate = sixLastTrick([80, 25, 15], 80, 'separate');
  assert.deepEqual(separate.roundSummary?.points, [80, 25, 15]);
  assert.deepEqual(separate.roundSummary?.change, [80, 25, 15]);
  assert.deepEqual(separate.scores, [80, 25, 15]);
  assert.deepEqual(separate.tricksWon, [3, 2, 1]);

  const together = sixLastTrick([80, 25, 15], 80, 'together');
  assert.deepEqual(together.roundSummary?.points, [80, 25, 15]);
  assert.deepEqual(together.roundSummary?.change, [80, 40, 40]);
  assert.deepEqual(together.scores, [80, 40, 40]);

  const set = sixLastTrick([60, 40, 20], 80, 'together');
  assert.equal(set.roundSummary?.made, false);
  assert.deepEqual(set.roundSummary?.change, [-80, 60, 60]);
  assert.deepEqual(sixLastTrick([60, 40, 20], 80, 'separate').roundSummary?.change, [-80, 40, 20]);
});

test('six players deal 6 each and a 5-card nest', () => {
  assert.deepEqual(dealSizes(4), { hand: 9, nest: 5 });
  assert.deepEqual(dealSizes(5), { hand: 7, nest: 6 });
  assert.deepEqual(dealSizes(6), { hand: 6, nest: 5 });
  assert.deepEqual(dealSizes(7), { hand: 5, nest: 6 });
  for (const count of [5, 6, 7]) {
    const state = lobbyOf(count);
    const { hand, nest } = dealSizes(count);
    assert.equal(countCards(state), 41);
    assert.equal(state.nest.length, nest);
    for (const seat of state.activePlayers) assert.equal(state.hands[seat].length, hand);
    assert.equal(state.dealer, count);
    assert.equal(state.currentPlayer, 1);
  }

  // The bidder lays aside as many cards as the nest held
  let five = lobbyOf(5);
  five = ok(move(five, 1, { type: 'bid', amount: 70 }));
  for (const seat of [2, 3, 4, 5]) five = ok(move(five, seat, { type: 'pass' }));
  assert.equal(five.hands[1].length, 13);
  assert.deepEqual(move(five, 1, { type: 'discard', cards: five.hands[1].slice(0, 5) }), { error: 'Lay aside exactly 6 cards' });
  five = ok(move(five, 1, { type: 'discard', cards: five.hands[1].slice(0, 6) }));
  assert.equal(five.gameStatus, 'Alice laid aside 6 cards');

  // Five and seven players: each seat is its own team, and called partners join the bidder hand by hand
  assert.deepEqual(lobbyOf(5).teams, [[1], [2], [3], [4], [5]]);
  assert.deepEqual(rookTeams([1, 2, 3, 4, 5, 6, 7], 'twoOfThree'), [[1], [2], [3], [4], [5], [6], [7]]);
  for (const count of [5, 7]) {
    const done = playHand(lobbyOf(count));
    assert.equal(done.roundSummary?.points.reduce((sum, points) => sum + points, 0), MAX_BID);
    assert.equal(done.scores.length, count);
  }

  // All six pass: the deal moves to the next seat, wrapping from the last seat to the first
  let passing = lobbyOf(6);
  for (const seat of [1, 2, 3, 4, 5, 6]) passing = ok(move(passing, seat, { type: 'pass' }));
  assert.equal(passing.dealer, 1);
  assert.equal(passing.currentPlayer, 2);
  assert.equal(countCards(passing), 41);
});

test('a game saved before teams existed loads and scores', () => {
  // game() is shaped like an old save: no teams field, two-entry scores and no house rules
  const old = lastTrickOf([80, 40], 80, [100, 50]);
  assert.equal('teams' in game(), false);
  assert.deepEqual(old.scores, [180, 90]);
  assert.deepEqual(old.roundSummary?.change, [80, 40]);
  assert.equal(teamOfSeat(old, 3), 0);
  let next = old;
  for (const seat of [1, 2, 3, 4]) next = ok(rook.applyAction?.(next, seat, { type: 'acknowledgeRound' }, seeded(1)) ?? assert.fail());
  assert.equal(next.phase, 'bidding');
  assert.deepEqual(next.tricksWon, [0, 0]);
  assert.deepEqual(next.captured, [0, 0]);
  for (const seat of [1, 2, 3, 4]) assert.equal(next.hands[seat].length, HAND_SIZE);
  const done = playHand(next);
  assert.equal(done.scores.length, 2);
  assert.equal(done.roundSummary?.points.length, 2);
});

test('a dismissal at six ends the game', () => {
  const three = { ...lobbyOf(6, { sixTeams: 'threeOfTwo' }), started: true, scores: [100, 300, 200] };
  const left = removePlayer(rook, three, 2, seeded(1));
  assert.equal(left.isGameOver, true);
  assert.equal(left.currentPlayer, null);
  // Bob's team leads, so the highest-scoring team without him wins
  assert.deepEqual(left.winners, [3, 6]);
  assert.equal(left.gameStatus, 'Bob left, so the partnership is broken: Cara and Fay win');

  const two = { ...lobbyOf(6), started: true, scores: [100, 50] };
  const gone = removePlayer(rook, two, 1, seeded(1));
  assert.deepEqual(gone.winners, [2, 4, 6]);
  assert.equal(gone.gameStatus, 'Alice left, so the partnership is broken: Bob, Dan and Fay win');
});

test('a dismissal at five ends the game with no partnership to break', () => {
  const five = { ...lobbyOf(5), started: true, scores: [100, 300, 200, 50, 0] };
  const left = removePlayer(rook, five, 2, seeded(1));
  assert.equal(left.isGameOver, true);
  assert.deepEqual(left.winners, [3]);
  assert.equal(left.gameStatus, 'Bob left, so the game ends: Cara wins');
});

// Rook at 5 and 7: after naming trump the bidder calls cards, and whoever holds one is their partner for the hand

// The last trick at `cards.length` players, red trump: Alice (the bidder) leads red 13 and nobody beats it, the nest
// holds no counters. Each seat is its own team, `captured` are the counters each took before it
function calledLastTrick(cards: Card[], captured: number[], bid: number, called: Card[], scores = cards.map(() => 0), partners: number[] = []): GameState {
  const seats = cards.map((_card, index) => index + 1);
  const state: GameState = {
    ...game({
      activePlayers: seats,
      playerNames: Object.fromEntries(NAMES.slice(0, seats.length).map((name, index) => [index + 1, name])),
      dealer: seats.length,
      hands: Object.fromEntries(cards.map((card, index) => [index + 1, [card]])),
      nest: [black(6), yellow(6), yellow(7), yellow(8), black(8), black(9)],
      captured,
      tricksWon: seats.map(() => 0),
      scores,
      bid,
      bidding: { high: { seat: 1, amount: bid }, passed: seats.slice(1) }
    }),
    teams: seats.map(seat => [seat]),
    called: { cards: called, partners },
    houseRules: { ...withRules({ targetScore: 500 }), maxPlayers: seats.length }
  };
  let next = state;
  for (const seat of seats) next = ok(move(next, seat, { type: 'play', card: next.hands[seat][0] }));
  return next;
}

const FIVE_LAST = [red(13), green(12), green(14), green(11), yellow(13)];

test('five players call one partner card and it is 2 against 3', () => {
  assert.deepEqual([4, 5, 6, 7].map(calledCount), [0, 1, 0, 2]);
  const calling = toCalling(lobbyOf(5));
  assert.equal(calling.phase, 'callPartner');
  assert.equal(calling.currentPlayer, 1);
  assert.equal(calling.gameStatus, 'Alice named black trump');
  assert.deepEqual(move(calling, 1, { type: 'play', card: calling.hands[1][0] }), { error: 'Wait for Alice to call a partner' });
  assert.deepEqual(move(calling, 1, { type: 'callPartner', cards: [] }), { error: 'Call exactly 1 card' });
  const [card] = notHeldBy(calling, 1);
  const called = ok(move(calling, 1, { type: 'callPartner', cards: [card] }));
  assert.equal(called.phase, 'play');
  assert.equal(called.currentPlayer, 1); // the dealer's left leads
  assert.deepEqual(called.called, { cards: [card], partners: [] });
  assert.equal(called.gameStatus, `Alice called ${cardName(card)} for a partner`);
  assert.deepEqual(move(called, 1, { type: 'callPartner', cards: [card] }), { error: 'Only the bid winner calls partners, after naming trump' });

  // Cara holds the called green 14 and plays it in the last trick: Alice and Cara took 70 of the bid of 70, and the
  // three defenders took 50 together
  const done = calledLastTrick(FIVE_LAST, [40, 10, 20, 15, 25], 70, [green(14)]);
  assert.deepEqual(done.called?.partners, [3]);
  assert.deepEqual(done.roundSummary?.points, [50, 10, 20, 15, 25]);
  assert.equal(done.roundSummary?.made, true);
  assert.deepEqual(done.roundSummary?.partners, [3]);
  assert.deepEqual(done.roundSummary?.change, [70, 50, 70, 50, 50]);
  assert.equal(done.gameStatus, 'Alice and Cara bid 70 and took 70: they score 70');
});

test('seven players call two and it is 3 against 4', () => {
  const calling = toCalling(lobbyOf(7));
  assert.equal(calling.phase, 'callPartner');
  const cards = notHeldBy(calling, 1);
  assert.deepEqual(move(calling, 1, { type: 'callPartner', cards: [cards[0]] }), { error: 'Call exactly 2 cards' });
  assert.deepEqual(move(calling, 1, { type: 'callPartner', cards: [cards[0], cards[0]] }), { error: 'Call 2 different cards' });
  const called = ok(move(calling, 1, { type: 'callPartner', cards }));
  assert.equal(called.gameStatus, `Alice called ${cardName(cards[0])} and ${cardName(cards[1])} for partners`);
  const played = playOut(called);
  assert.equal(played.roundSummary?.points.reduce((sum, points) => sum + points, 0), MAX_BID);

  // Cara and Fay hold the called cards: Alice's side took 80 of 85 and is set, the four defenders took 40
  const set = calledLastTrick(
    [red(13), green(12), green(14), green(11), yellow(13), yellow(14), yellow(12)], [30, 10, 20, 10, 10, 10, 10], 85,
    [green(14), yellow(14)]
  );
  assert.deepEqual(set.called?.partners, [3, 6]);
  assert.equal(set.roundSummary?.made, false);
  assert.deepEqual(set.roundSummary?.change, [-85, 40, -85, 40, 40, -85, 40]);
  assert.equal(set.gameStatus, 'Alice, Cara and Fay bid 85 and took 80: they lose 85');

  // A player who holds both called cards is one partner: Cara played the yellow 14 earlier
  const both = calledLastTrick(
    [red(13), green(12), green(14), green(11), yellow(13), yellow(9), yellow(12)], [30, 10, 30, 10, 10, 10, 10], 85,
    [green(14), yellow(14)], undefined, [3]
  );
  assert.deepEqual(both.called?.partners, [3]);
});

test('a called card in the laid-aside cards leaves the bidder alone', () => {
  const calling = toCalling(lobbyOf(5));
  const [laidAside] = calling.nest;
  const called = ok(move(calling, 1, { type: 'callPartner', cards: [laidAside] }));
  const done = playOut(called);
  const summary = done.roundSummary ?? assert.fail('no summary');
  assert.deepEqual(done.called?.partners, []);
  assert.deepEqual(summary.partners, []);
  const defended = summary.points.slice(1).reduce((sum, points) => sum + points, 0);
  assert.deepEqual(summary.change.slice(1), [defended, defended, defended, defended]);
  assert.equal(summary.change[0], summary.made ? summary.points[0] : -70);
});

test('the bidder cannot call a card in their own hand', () => {
  const calling = toCalling(lobbyOf(5));
  assert.deepEqual(move(calling, 1, { type: 'callPartner', cards: [calling.hands[1][0]] }),
    { error: 'You cannot call a card in your own hand' });
  assert.deepEqual(move(calling, 2, { type: 'callPartner', cards: notHeldBy(calling, 1) }), { error: 'Not your turn' });
  assert.deepEqual(move(calling, 1, { type: 'callPartner', cards: [{ color: 'red', number: 4 }] }), { error: 'Invalid move' });
});

test('a partner stays hidden until the called card is played', () => {
  const calling = toCalling(lobbyOf(5));
  const [card] = notHeldBy(calling, 1);
  const holder = calling.activePlayers.find(seat => calling.hands[seat].some(held => sameCard(held, card)));
  assert.ok(holder !== undefined, 'the called card is in a hand for this seed');
  let state = ok(move(calling, 1, { type: 'callPartner', cards: [card] }));
  const viewers = [null, 1, 2, 3, 4, 5];
  while (state.called?.partners.length === 0) {
    assert.equal(state.phase, 'play');
    // No view says who holds the called card; only the holder sees it, in their own hand
    for (const viewer of viewers) {
      const view = rook.toPublicState(state, false, viewer);
      assert.deepEqual(view.called, { cards: [card], partners: [] });
      assert.equal(view.hand.some(held => sameCard(held, card)), viewer === holder);
    }
    const seat = state.currentPlayer ?? assert.fail('nobody to play');
    const next = state.hands[seat].find(held => canPlayCard(state.hands[seat], held, state.trick, 'black'));
    state = ok(move(state, seat, { type: 'play', card: next }));
  }
  assert.equal(state.lastMove?.type === 'play' && sameCard(state.lastMove.card, card), true);
  for (const viewer of viewers) assert.deepEqual(rook.toPublicState(state, false, viewer).called?.partners, [holder]);
  assert.match(state.gameStatus, new RegExp(`${NAMES[holder - 1]} is Alice's partner$`));
});

test('each player scores individually', () => {
  const done = calledLastTrick(FIVE_LAST, [40, 10, 20, 15, 25], 70, [green(14)], [100, 20, 30, 40, 50]);
  assert.deepEqual(done.scores, [170, 70, 100, 90, 100]);
  assert.equal(done.isGameOver, false);
  // The next hand calls partners afresh
  let next = done;
  for (const seat of [1, 2, 3, 4, 5]) next = ok(rook.applyAction?.(next, seat, { type: 'acknowledgeRound' }, seeded(1)) ?? assert.fail());
  assert.equal(next.called, null);
  assert.deepEqual(next.scores, [170, 70, 100, 90, 100]);
  const again = playHand(next);
  assert.equal(again.scores.length, 5);
});

test('equal top totals share the win', () => {
  const shared = calledLastTrick(FIVE_LAST, [40, 10, 20, 15, 25], 70, [green(14)], [450, 0, 450, 0, 0]);
  assert.equal(shared.isGameOver, true);
  assert.deepEqual(shared.winners, [1, 3]);
  assert.equal(shared.gameStatus, 'Alice and Cara win with 520 points!');

  const alone = calledLastTrick(FIVE_LAST, [40, 10, 20, 15, 25], 70, [green(14)], [450, 0, 440, 0, 0]);
  assert.deepEqual(alone.winners, [1]);
  assert.equal(alone.gameStatus, 'Alice wins with 520 points!');

  const over = playGame(lobbyOf(7));
  assert.ok(over.winners.length >= 1);
});

test('five players deal 7 each with a 6-card nest', () => {
  assert.deepEqual(dealSizes(5), { hand: 7, nest: 6 });
  const state = lobbyOf(5);
  assert.deepEqual(state.teams, [[1], [2], [3], [4], [5]]);
  assert.equal(state.nest.length, 6);
  for (const seat of [1, 2, 3, 4, 5]) assert.equal(state.hands[seat].length, 7);
  const calling = toCalling(state);
  assert.equal(calling.hands[1].length, 7);
  assert.equal(calling.nest.length, 6);
  // The bidder sees the laid-aside cards while calling, and may call one of them
  assert.equal(rook.toPublicState(calling, false, 1).discards.length, 6);
  assert.equal(rook.toPublicState(calling, false, 2).discards.length, 0);
});
