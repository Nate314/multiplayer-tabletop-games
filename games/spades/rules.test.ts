import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import { HAND_SIZE, LOSING_SCORE, targetScore, canPlayCard, createGameState, dealHand, teamOf, toPublicState, trickWinnerOf } from './rules.ts';
import { spades } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import { cardName, standardDeck } from '../../shared/playingCards.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, GameState, Move, PublicGameState, Result, Seat, Suit, TeamScores } from './types.ts';

type Rank = Card['rank'];
const card = (suit: Suit) => (rank: Rank): Card => ({ suit, rank });
const S = card('spades');
const H = card('hearts');
const C = card('clubs');
const D = card('diamonds');

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
    const result = addPlayer(spades, state, name, seeded(7));
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
  applyMove(spades, state, seat, m, random);
const act = (state: GameState, seat: number, action: unknown) =>
  spades.applyAction?.(state, seat, action, seeded(1), 0) ?? assert.fail('no actions');

const NO_TRICKS = { 1: 0, 2: 0, 3: 0, 4: 0 };

// A hand under way, seat 4 dealt, everyone has bid and seat 1 leads. Two cards each.
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3, 4],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' },
    dealer: 4,
    phase: 'play',
    hands: { 1: [H('5'), C('9')], 2: [H('K'), D('7')], 3: [S('2'), C('3')], 4: [H('A'), S('Q')] },
    bids: { 1: 3, 2: 4, 3: 2, 4: 3 },
    tricksTaken: { ...NO_TRICKS },
    ...overrides
  };
}

// The last trick of a hand: hearts all round, and `winner` holds the ace. `taken` are the tricks before it, 12 in all.
function lastTrickOf(bids: Record<Seat, number>, taken: Record<Seat, number>, scores: TeamScores = [0, 0], bags: TeamScores = [0, 0], winner: Seat = 1, overrides: Partial<GameState> = {}): GameState {
  const low: Rank[] = ['2', '3', '4'];
  const cards = Object.fromEntries([1, 2, 3, 4].map(seat => [seat, H(seat === winner ? 'A' : low.shift() ?? '5')]));
  let state = game({
    hands: Object.fromEntries([1, 2, 3, 4].map(seat => [seat, [cards[seat]]])),
    bids,
    tricksTaken: taken,
    scores,
    bags,
    spadesBroken: true,
    ...overrides
  });
  for (const seat of [1, 2, 3, 4]) state = ok(move(state, seat, { type: 'play', card: cards[seat] }));
  return state;
}

const countCards = (state: GameState) => Object.values(state.hands).flat().length;

test('the whole deck is dealt, 13 cards each', () => {
  const state = lobby();
  assert.equal(countCards(state), 52);
  assert.equal(new Set(Object.values(state.hands).flat().map(cardName)).size, 52);
  for (const seat of [1, 2, 3, 4]) assert.equal(state.hands[seat].length, HAND_SIZE);
  assert.equal(state.dealer, 4);
  assert.equal(state.phase, 'bidding');
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.bids, {});
  assert.equal(state.spadesBroken, false);
});

test('nothing is dealt until four players are seated', () => {
  assert.equal(countCards(lobby(3)), 0);
});

test('partners sit across: seats 1 and 3 against 2 and 4', () => {
  assert.deepEqual([1, 2, 3, 4].map(teamOf), [0, 1, 0, 1]);
});

test('bidding goes around once from the dealer\'s left', () => {
  let state = dealHand(lobby(), 2, seeded(1));
  assert.equal(state.currentPlayer, 3);
  assert.deepEqual(move(state, 1, { type: 'bid', tricks: 3 }), { error: 'Not your turn' });
  state = ok(move(state, 3, { type: 'bid', tricks: 4 }));
  assert.equal(state.gameStatus, 'Cara bid 4');
  state = ok(move(state, 4, { type: 'bid', tricks: 0 }));
  assert.equal(state.gameStatus, 'Dan bid nil');
  state = ok(move(state, 1, { type: 'bid', tricks: 13 }));
  assert.equal(state.phase, 'bidding');
  state = ok(move(state, 2, { type: 'bid', tricks: 2 }));
  // Once the dealer has bid the play starts, and the dealer's left leads
  assert.equal(state.phase, 'play');
  assert.deepEqual(state.bids, { 1: 13, 2: 2, 3: 4, 4: 0 });
  assert.equal(state.currentPlayer, 3);
  assert.deepEqual(move(state, 3, { type: 'bid', tricks: 3 }), { error: 'The bidding is over' });
});

test('must follow suit when able, and a trick goes to the highest spade or else the highest of the suit led, ace high', () => {
  const state = game({ currentPlayer: 2, trick: [{ seat: 1, card: H('5') }] });
  assert.deepEqual(move(state, 2, { type: 'play', card: D('7') }), { error: 'Follow suit: play hearts' });
  assert.equal(canPlayCard([S('2'), C('3')], S('2'), state.trick, false), true);
  assert.equal(trickWinnerOf([
    { seat: 1, card: H('5') }, { seat: 2, card: H('K') }, { seat: 3, card: C('A') }, { seat: 4, card: H('A') }
  ]), 4);
  assert.equal(trickWinnerOf([
    { seat: 1, card: H('5') }, { seat: 2, card: H('K') }, { seat: 3, card: S('2') }, { seat: 4, card: H('A') }
  ]), 3);
  assert.equal(trickWinnerOf([
    { seat: 1, card: D('5') }, { seat: 2, card: S('3') }, { seat: 3, card: S('10') }, { seat: 4, card: D('A') }
  ]), 3);
});

test('spades cannot be led until broken unless the hand is all spades', () => {
  const state = game({ hands: { 1: [S('A'), H('5')], 2: [H('K'), D('7')], 3: [S('2'), C('3')], 4: [H('A'), S('Q')] } });
  assert.deepEqual(move(state, 1, { type: 'play', card: S('A') }), { error: 'Spades are not broken yet: lead another suit' });
  assert.equal(canPlayCard([S('A'), S('3')], S('A'), [], false), true);
  const allSpades = ok(move(game({ hands: { ...state.hands, 1: [S('A'), S('3')] } }), 1, { type: 'play', card: S('A') }));
  assert.equal(allSpades.spadesBroken, true);

  // Cara, out of hearts, trumps with a spade: that breaks spades, and she may lead one next
  let next = ok(move(game({ hands: { ...state.hands, 3: [S('2'), S('5')] } }), 1, { type: 'play', card: H('5') }));
  next = ok(move(next, 2, { type: 'play', card: H('K') }));
  assert.equal(next.spadesBroken, false);
  next = ok(move(next, 3, { type: 'play', card: S('2') }));
  assert.equal(next.spadesBroken, true);
  next = ok(move(next, 4, { type: 'play', card: H('A') }));
  assert.equal(next.currentPlayer, 3);
  assert.equal(canPlayCard([S('5'), C('3')], S('5'), [], next.spadesBroken), true);
});

test('the winner of a trick leads the next and the tricks are counted per player', () => {
  let state = game();
  state = ok(move(state, 1, { type: 'play', card: H('5') }));
  state = ok(move(state, 2, { type: 'play', card: H('K') }));
  state = ok(move(state, 3, { type: 'play', card: C('3') }));
  assert.equal(state.gameStatus, 'Cara played the 3 of clubs');
  state = ok(move(state, 4, { type: 'play', card: H('A') }));
  assert.deepEqual(state.trick, []);
  assert.equal(state.lastTrick?.winner, 4);
  assert.deepEqual(state.tricksTaken, { 1: 0, 2: 0, 3: 0, 4: 1 });
  assert.equal(state.currentPlayer, 4);
  assert.equal(state.gameStatus, 'Dan played the ace of hearts and took the trick');
});

test('a made contract scores 10 per trick bid plus 1 per bag', () => {
  // Alice and Cara bid 3 + 2 and take 5 + 2 with the last trick
  const state = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 4, 2: 4, 3: 2, 4: 2 });
  const result = state.roundSummary?.teams[0] ?? assert.fail('no summary');
  assert.deepEqual(result, { contract: 5, tricks: 7, made: true, overtricks: 2, bagPenalty: false, nils: [], change: 52 });
  assert.deepEqual(state.bags, [2, 0]);
  assert.equal(state.scores[0], 52);
  assert.equal(state.phase, 'handOver');
  assert.equal(state.currentPlayer, null);
});

test('a set contract loses 10 per trick bid', () => {
  // Bob and Dan bid 4 + 3 and take 6, with no bags
  const state = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 4, 2: 4, 3: 2, 4: 2 }, [30, 20], [0, 5]);
  const result = state.roundSummary?.teams[1] ?? assert.fail('no summary');
  assert.deepEqual(result, { contract: 7, tricks: 6, made: false, overtricks: 0, bagPenalty: false, nils: [], change: -70 });
  assert.deepEqual(state.scores, [82, -50]);
  assert.deepEqual(state.bags, [2, 5]);
  assert.equal(state.gameStatus, 'Alice and Cara score +52, Bob and Dan score -70');
});

test('ten bags cost 100', () => {
  // Alice and Cara had 8 bags and take 3 more: 50 + 3 - 100, and 1 bag carries on
  const state = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 5, 2: 3, 3: 2, 4: 2 }, [200, 0], [8, 0]);
  const result = state.roundSummary?.teams[0] ?? assert.fail('no summary');
  assert.equal(result.overtricks, 3);
  assert.equal(result.bagPenalty, true);
  assert.equal(result.change, -47);
  assert.deepEqual(state.bags, [1, 0]);
  assert.equal(state.scores[0], 153);
});

test('nil scores 100 made and loses 100 broken, apart from the partner\'s contract', () => {
  // Alice bids nil and takes nothing; Cara bids 5 and takes 5 with the last trick
  const made = lastTrickOf({ 1: 0, 2: 4, 3: 5, 4: 4 }, { 1: 0, 2: 4, 3: 4, 4: 4 }, [0, 0], [0, 0], 3).roundSummary?.teams[0];
  assert.deepEqual(made, { contract: 5, tricks: 5, made: true, overtricks: 0, bagPenalty: false, nils: [{ seat: 1, made: true }], change: 150 });

  // Alice takes the last trick: her nil is broken and Cara's 5 is set, each scored on its own
  const broken = lastTrickOf({ 1: 0, 2: 4, 3: 5, 4: 4 }, { 1: 0, 2: 4, 3: 3, 4: 5 }).roundSummary?.teams[0];
  assert.deepEqual(broken, { contract: 5, tricks: 4, made: false, overtricks: 0, bagPenalty: false, nils: [{ seat: 1, made: false }], change: -150 });
  // The nil bidder's trick still counts toward the partner's contract
  const counted = lastTrickOf({ 1: 0, 2: 4, 3: 4, 4: 4 }, { 1: 0, 2: 4, 3: 4, 4: 4 }).roundSummary?.teams[0];
  assert.deepEqual(counted, { contract: 4, tricks: 5, made: true, overtricks: 1, bagPenalty: false, nils: [{ seat: 1, made: false }], change: -59 });

  // Both partners nil: no contract and no bags, only the two nils
  const both = lastTrickOf({ 1: 0, 2: 4, 3: 0, 4: 4 }, { 1: 0, 2: 6, 3: 0, 4: 6 }).roundSummary?.teams[0];
  assert.deepEqual(both, { contract: 0, tricks: 1, made: true, overtricks: 0, bagPenalty: false, nils: [{ seat: 1, made: false }, { seat: 3, made: true }], change: 0 });
});

test('500 wins and minus 200 loses', () => {
  const won = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 4, 2: 4, 3: 2, 4: 2 }, [460, 300]);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1, 3]);
  assert.equal(won.gameStatus, 'Alice and Cara win with 512 points!');
  assert.deepEqual(act(won, 1, { type: 'acknowledgeRound' }), { error: 'The game is over' });

  const fell = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 4, 2: 4, 3: 2, 4: 2 }, [0, -150]);
  assert.equal(fell.isGameOver, true);
  assert.deepEqual(fell.winners, [1, 3]);
  assert.equal(fell.gameStatus, 'Bob and Dan fell to -220: Alice and Cara win');
  assert.equal(LOSING_SCORE, -200);

  // Both past 500: the higher wins, and a tie plays another hand
  const higher = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 4, 2: 4, 3: 2, 4: 2 }, [490, 650]);
  assert.deepEqual(higher.winners, [2, 4]);
  const tie = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 4, 2: 4, 3: 2, 4: 2 }, [500, 622]);
  assert.equal(tie.isGameOver, false);
  assert.match(tie.gameStatus, /Both teams are tied at 552, so another hand is played$/);
  assert.equal(targetScore({}), 500);
});

test('Continue deals the next hand once every connected player is ready, the deal passing left', () => {
  let state = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 4, 2: 4, 3: 2, 4: 2 });
  assert.deepEqual(move(state, 1, { type: 'bid', tricks: 3 }), { error: 'Not your turn' });
  for (const seat of [1, 2, 3]) state = ok(act(state, seat, { type: 'acknowledgeRound' }));
  assert.equal(state.phase, 'handOver');
  assert.deepEqual(state.roundSummary?.acknowledged, [1, 2, 3]);
  state = ok(act(state, 4, { type: 'acknowledgeRound' }));
  assert.equal(state.phase, 'bidding');
  assert.equal(state.handNumber, 2);
  assert.equal(state.dealer, 1);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'Hand 2: Alice deals');
  assert.deepEqual(state.bids, {});
  assert.deepEqual(state.tricksTaken, NO_TRICKS);
  assert.equal(state.spadesBroken, false);
  assert.deepEqual(state.scores, [52, -70]);
  assert.deepEqual(state.bags, [2, 0]);
  assert.equal(countCards(state), 52);
});

test('the next hand does not wait for disconnected players', () => {
  let state = lastTrickOf({ 1: 3, 2: 4, 3: 2, 4: 3 }, { 1: 4, 2: 4, 3: 2, 4: 2 });
  for (const seat of [1, 2, 3]) state = ok(act(state, seat, { type: 'acknowledgeRound' }));
  state = disconnectPlayer(spades, state, 4, seeded(1));
  assert.equal(state.phase, 'bidding');
});

test('a player leaving ends the game and the other team wins', () => {
  const state = removePlayer(spades, game(), 3, seeded(1));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2, 4]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.gameStatus, 'Cara left, so the partnership is broken: Bob and Dan win');
});

test('dismissed player mid-turn', () => {
  // Dismissed while it is their turn to bid
  let state = dealHand(lobby(), 4, seeded(1));
  state = ok(move(state, 1, { type: 'bid', tricks: 3 }));
  const bidding = removePlayer(spades, disconnectPlayer(spades, state, 2, seeded(1)), 2, seeded(1));
  assert.equal(bidding.isGameOver, true);
  assert.deepEqual(bidding.winners, [1, 3]);
  assert.deepEqual(move(bidding, 3, { type: 'bid', tricks: 3 }), { error: 'The game is over' });
  // Dismissed while it is their turn to play
  const playing = removePlayer(spades, disconnectPlayer(spades, game(), 1, seeded(1)), 1, seeded(1));
  assert.equal(playing.isGameOver, true);
  assert.deepEqual(playing.winners, [2, 4]);
});

test('invalid moves', () => {
  const state = game();
  const bad: unknown[] = [
    null, 'play', 7, {}, { type: 'shout' }, { type: 'pass' },
    { type: 'play' }, { type: 'play', card: { suit: 'hearts', rank: '1' } }, { type: 'play', card: { suit: 'stars', rank: '5' } },
    { type: 'play', card: 'H5' }, { type: 'play', card: D('7') }, { type: 'bid', tricks: 3 }
  ];
  for (const m of bad) {
    const result = move(state, 1, m);
    assert.ok('error' in result, `expected an error for ${JSON.stringify(m)}`);
    assert.deepEqual(state, game());
  }
  assert.deepEqual(move(state, 1, { type: 'play', card: D('7') }), { error: 'You do not have that card' });
  assert.deepEqual(move(state, 2, { type: 'play', card: H('K') }), { error: 'Not your turn' });

  const bidding = dealHand(lobby(), 4, seeded(1));
  for (const tricks of [-1, 14, 2.5, '3', null, Number.NaN]) {
    assert.ok('error' in move(bidding, 1, { type: 'bid', tricks }), `expected an error for ${tricks}`);
  }
  assert.deepEqual(move(bidding, 1, { type: 'bid', tricks: 14 }), { error: 'Bid 0 (nil) to 13 tricks' });
  assert.deepEqual(move(bidding, 1, { type: 'play', card: bidding.hands[1][0] }), { error: 'Finish the bidding first' });

  assert.deepEqual(act(state, 1, { type: 'acknowledgeRound' }), { error: 'Nothing to continue' });
  assert.deepEqual(act(state, 1, { type: 'other' }), { error: 'Unknown action' });
  assert.deepEqual(act(state, 1, null), { error: 'Unknown action' });
});

test('table view hides hands', () => {
  // Every step of a short hand: the bidding and a few tricks
  let state = dealHand(lobby(), 4, seeded(5));
  const steps: GameState[] = [state];
  for (const seat of [1, 2, 3, 4]) steps.push(state = ok(move(state, seat, { type: 'bid', tricks: seat === 2 ? 0 : 3 })));
  for (let i = 0; i < 12; i++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to play');
    const hand = state.hands[seat];
    const played = hand.find(held => canPlayCard(hand, held, state.trick, state.spadesBroken));
    steps.push(state = ok(move(state, seat, { type: 'play', card: played })));
  }
  for (const step of steps) {
    const table = toPublicState(step, false, null) as PublicGameState;
    const text = JSON.stringify(table);
    assert.deepEqual(table.hand, []);
    assert.equal('hands' in table, false);
    const shown = [...step.trick, ...(step.lastTrick?.plays ?? [])].map(play => JSON.stringify(play.card));
    for (const held of Object.values(step.hands).flat()) {
      if (!shown.includes(JSON.stringify(held))) assert.equal(text.includes(JSON.stringify(held)), false);
    }
    for (const seat of [1, 2, 3, 4]) {
      const own = toPublicState(step, false, seat);
      assert.deepEqual(own.hand, step.hands[seat]);
      assert.equal(own.handCounts[seat], step.hands[seat].length);
    }
  }
});

test('a whole hand of legal plays takes 13 tricks', () => {
  for (const seed of [1, 2, 3]) {
    let state = dealHand(lobby(), 4, seeded(seed));
    for (const seat of [1, 2, 3, 4]) state = ok(move(state, seat, { type: 'bid', tricks: 3 }));
    while (state.phase === 'play') {
      const seat = state.currentPlayer ?? assert.fail('nobody to play');
      const hand = state.hands[seat];
      state = ok(move(state, seat, { type: 'play', card: hand.find(held => canPlayCard(hand, held, state.trick, state.spadesBroken)) }));
    }
    const teams = state.roundSummary?.teams ?? assert.fail('no summary');
    assert.equal(teams[0].tricks + teams[1].tricks, 13);
    assert.equal(standardDeck().length, 52);
  }
});

test('the game ends at the chosen target', () => {
  const bids = { 1: 3, 2: 4, 3: 2, 4: 3 };
  const taken = { 1: 4, 2: 4, 3: 2, 4: 2 };
  const rules = (value: number) => ({ houseRules: withRules({ targetScore: value }) });
  const won = lastTrickOf(bids, taken, [200, 0], [0, 0], 1, rules(250)); // the first team bid 5 and took 6: +51
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1, 3]);
  assert.equal(lastTrickOf(bids, taken, [190, 0], [0, 0], 1, rules(250)).isGameOver, false);
  assert.equal(lastTrickOf(bids, taken, [200, 0], [0, 0], 1, rules(500)).isGameOver, false);
  assert.equal(targetScore(rules(300)), 300);
});

test('a team still loses at -200 whatever the target', () => {
  const bids = { 1: 3, 2: 4, 3: 2, 4: 3 };
  const taken = { 1: 4, 2: 4, 3: 2, 4: 2 };
  const fell = lastTrickOf(bids, taken, [0, -150], [0, 0], 1, { houseRules: withRules({ targetScore: 250 }) });
  assert.equal(fell.isGameOver, true);
  assert.deepEqual(fell.winners, [1, 3]);
});
