import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import {
  HAND_SIZE, KITTY_SIZE, targetScore, buildDeck, canPlayCard, cardName, createGameState, dealHand, sittingOut, suitOf,
  teamOf, toPublicState, trickWinner
} from './rules.ts';
import { euchre } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, GameState, Move, PublicGameState, Result, Suit, TeamScores } from './types.ts';

const c = (suit: Suit, rank: Card['rank']): Card => ({ suit, rank });
const H = (rank: Card['rank']) => c('hearts', rank);
const D = (rank: Card['rank']) => c('diamonds', rank);
const S = (rank: Card['rank']) => c('spades', rank);
const C = (rank: Card['rank']) => c('clubs', rank);

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
    const result = addPlayer(euchre, state, name, seeded(7));
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
  applyMove(euchre, state, seat, m, random);
const act = (state: GameState, seat: number, action: unknown) =>
  euchre.applyAction?.(state, seat, action, seeded(1)) ?? assert.fail('no actions');

// A hand under way: seat 4 dealt, seat 1 ordered up hearts and leads. Two cards each.
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3, 4],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' },
    dealer: 4,
    phase: 'play',
    hands: { 1: [S('9'), H('10')], 2: [S('A'), C('9')], 3: [S('10'), D('J')], 4: [C('Q'), H('K')] },
    upcard: H('9'),
    kitty: [C('10'), D('9'), D('10')],
    discard: S('Q'),
    maker: 1,
    trump: 'hearts',
    tricksWon: [2, 1],
    ...overrides
  };
}

function countCards(state: GameState): number {
  return state.kitty.length + Object.values(state.hands).flat().length + (state.upcard && !state.trump ? 1 : 0)
    + (state.discard ? 1 : 0);
}

const every = (state: GameState) => [...Object.values(state.hands).flat(), ...state.kitty, ...(state.upcard ? [state.upcard] : [])];

test('24 cards, 5 each, one turned up and three in the kitty', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 24);
  assert.equal(new Set(deck.map(cardName)).size, 24);
  assert.deepEqual([...new Set(deck.map(card => card.rank))].sort(), ['10', '9', 'A', 'J', 'K', 'Q']);
  assert.equal(HAND_SIZE, 5);
  assert.equal(KITTY_SIZE, 3);

  const state = lobby();
  assert.equal(new Set(every(state).map(cardName)).size, 24);
  for (const seat of [1, 2, 3, 4]) assert.equal(state.hands[seat].length, 5);
  assert.equal(state.kitty.length, 3);
  assert.ok(state.upcard);
  assert.equal(state.phase, 'order');
  assert.equal(state.dealer, 4);
  assert.equal(state.currentPlayer, 1);
});

test('nothing is dealt until four players are seated', () => {
  const state = lobby(3);
  assert.equal(countCards(state), 0);
  assert.equal(state.upcard, null);
});

test('partners sit across: seats 1 and 3 against 2 and 4', () => {
  assert.deepEqual([1, 2, 3, 4].map(teamOf), [0, 1, 0, 1]);
});

test('the right and left bowers rank above the other trumps and the left bower follows trump, not its own suit', () => {
  assert.equal(suitOf(D('J'), 'hearts'), 'hearts');
  assert.equal(suitOf(H('J'), 'hearts'), 'hearts');
  assert.equal(suitOf(C('J'), 'hearts'), 'clubs');
  assert.equal(suitOf(D('J'), null), 'diamonds');
  // Right bower, then left bower, then the ace of trump
  assert.equal(trickWinner([{ seat: 1, card: H('A') }, { seat: 2, card: D('J') }, { seat: 3, card: H('J') }, { seat: 4, card: H('K') }], 'hearts'), 3);
  assert.equal(trickWinner([{ seat: 1, card: H('A') }, { seat: 2, card: D('J') }, { seat: 3, card: H('Q') }, { seat: 4, card: H('K') }], 'hearts'), 2);
  // The left bower trumps a diamond lead
  assert.equal(trickWinner([{ seat: 1, card: D('A') }, { seat: 2, card: D('J') }, { seat: 3, card: D('K') }, { seat: 4, card: S('A') }], 'hearts'), 2);
  // Off-suit: ace high, the led suit wins
  assert.equal(trickWinner([{ seat: 1, card: S('9') }, { seat: 2, card: S('A') }, { seat: 3, card: C('A') }, { seat: 4, card: S('K') }], 'hearts'), 2);
  // With diamonds led, the left bower does not follow diamonds; it may be played only when void, or on a trump lead
  assert.equal(canPlayCard([D('J'), D('9'), S('9')], D('J'), [{ seat: 1, card: D('A') }], 'hearts'), false);
  assert.equal(canPlayCard([D('J'), S('9')], D('J'), [{ seat: 1, card: D('A') }], 'hearts'), true);
  assert.equal(canPlayCard([D('J'), S('9')], S('9'), [{ seat: 1, card: H('9') }], 'hearts'), false);
  assert.equal(canPlayCard([D('J'), S('9')], D('J'), [{ seat: 1, card: H('9') }], 'hearts'), true);
  // The left bower led calls for trump
  assert.equal(canPlayCard([H('9'), D('9')], D('9'), [{ seat: 1, card: D('J') }], 'hearts'), false);
});

test('ordering up gives the dealer the turned card and a discard', () => {
  let state = lobby();
  const upcard = state.upcard ?? assert.fail('no upcard');
  assert.deepEqual(move(state, 1, { type: 'nameTrump', suit: 'clubs' }), { error: 'Order up the turned card or pass' });
  state = ok(move(state, 1, { type: 'orderUp' }));
  assert.equal(state.trump, upcard.suit);
  assert.equal(state.maker, 1);
  assert.equal(state.phase, 'alone');
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, `Alice ordered up ${upcard.suit}`);
  state = ok(move(state, 1, { type: 'goAlone', alone: false }));
  assert.equal(state.phase, 'discard');
  assert.equal(state.currentPlayer, 4);
  assert.equal(state.hands[4].length, 6);
  assert.ok(state.hands[4].some(card => cardName(card) === cardName(upcard)));
  const notHeld = buildDeck().find(card => !state.hands[4].some(held => cardName(held) === cardName(card)));
  assert.deepEqual(move(state, 4, { type: 'discard', card: notHeld }), { error: 'You do not have that card' });
  const laid = state.hands[4][0];
  state = ok(move(state, 4, { type: 'discard', card: laid }));
  assert.equal(state.hands[4].length, 5);
  assert.deepEqual(state.discard, laid);
  assert.equal(state.phase, 'play');
  assert.equal(state.currentPlayer, 1); // left of the dealer leads
  assert.equal(state.gameStatus, 'Dan discarded a card');
  // Only the dealer sees the discard
  assert.deepEqual(toPublicState(state, false, 4).discard, laid);
  for (const viewer of [1, 2, 3, null]) assert.equal(toPublicState(state, false, viewer).discard, null);

  // The dealer may pick it up themselves
  let picked = lobby();
  for (const seat of [1, 2, 3]) picked = ok(move(picked, seat, { type: 'pass' }));
  picked = ok(move(picked, 4, { type: 'orderUp' }));
  assert.equal(picked.gameStatus, `Dan picked up the ${cardName(upcard)}`);
  assert.equal(picked.maker, 4);
});

test('second round may not name the turned-down suit', () => {
  let state = lobby();
  const upcard = state.upcard ?? assert.fail('no upcard');
  for (const seat of [1, 2, 3, 4]) state = ok(move(state, seat, { type: 'pass' }));
  assert.equal(state.phase, 'name');
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.passed, []);
  assert.equal(state.gameStatus, 'Dan passed. The turned card is turned down');
  assert.deepEqual(move(state, 1, { type: 'orderUp' }), { error: 'The turned card was turned down: name another suit or pass' });
  assert.deepEqual(move(state, 1, { type: 'nameTrump', suit: upcard.suit }), { error: `${upcard.suit} was turned down: name another suit` });
  const other = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).find(suit => suit !== upcard.suit) ?? assert.fail();
  state = ok(move(state, 1, { type: 'pass' }));
  state = ok(move(state, 2, { type: 'nameTrump', suit: other }));
  assert.equal(state.trump, other);
  assert.equal(state.maker, 2);
  assert.equal(state.phase, 'alone');
  assert.equal(state.gameStatus, `Bob named ${other} trump`);
  // No pick-up in the second round: straight to play
  state = ok(move(state, 2, { type: 'goAlone', alone: false }));
  assert.equal(state.phase, 'play');
  assert.equal(state.hands[4].length, 5);
  assert.equal(state.currentPlayer, 1);
});

test('all pass twice redeals with the next dealer', () => {
  let state = lobby();
  for (let i = 0; i < 8; i++) state = ok(move(state, state.currentPlayer ?? assert.fail(), { type: 'pass' }));
  assert.equal(state.dealer, 1);
  assert.equal(state.phase, 'order');
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.passed, []);
  assert.equal(new Set(every(state).map(cardName)).size, 24);
  assert.deepEqual(state.lastMove, { type: 'pass', playerNumber: 4, turnedDown: false, redeal: true });
  assert.equal(state.gameStatus, 'Dan passed. Everyone passed twice, so Alice deals again');
});

test('a lone maker\'s partner sits out the hand', () => {
  // Alice orders up alone: Cara sits out, Dan picks up, and tricks have three cards
  let state = lobby();
  state = ok(move(state, 1, { type: 'orderUp' }));
  state = ok(move(state, 1, { type: 'goAlone', alone: true }));
  assert.equal(state.alone, true);
  assert.equal(sittingOut(state), 3);
  assert.equal(state.gameStatus, 'Alice goes alone; Cara sits out');
  state = ok(move(state, 4, { type: 'discard', card: state.hands[4][0] }));
  const trump = state.trump;
  for (const seat of [1, 2, 4]) {
    assert.equal(state.currentPlayer, seat);
    const card = state.hands[seat].find(held => canPlayCard(state.hands[seat], held, state.trick, trump)) ?? assert.fail();
    state = ok(move(state, seat, { type: 'play', card }));
  }
  assert.equal(state.trick.length, 0);
  assert.equal(state.lastTrick?.plays.length, 3);
  assert.equal(state.hands[3].length, 5);
  assert.deepEqual(move(state, 3, { type: 'play', card: state.hands[3][0] }), { error: 'Not your turn' });

  // Dan's partner Bob orders up alone: Dan sits out and does not pick up
  let dealer = lobby();
  dealer = ok(move(dealer, 1, { type: 'pass' }));
  dealer = ok(move(dealer, 2, { type: 'orderUp' }));
  dealer = ok(move(dealer, 2, { type: 'goAlone', alone: true }));
  assert.equal(sittingOut(dealer), 4);
  assert.equal(dealer.phase, 'play');
  assert.equal(dealer.hands[4].length, 5);
  assert.equal(dealer.currentPlayer, 1);

  // Cara goes alone and Alice, left of the dealer, sits out: Bob leads
  let lead = lobby();
  for (const seat of [1, 2, 3, 4]) lead = ok(move(lead, seat, { type: 'pass' }));
  lead = ok(move(lead, 1, { type: 'pass' }));
  lead = ok(move(lead, 2, { type: 'pass' }));
  const other = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).find(suit => suit !== lead.upcard?.suit) ?? assert.fail();
  lead = ok(move(lead, 3, { type: 'nameTrump', suit: other }));
  lead = ok(move(lead, 3, { type: 'goAlone', alone: true }));
  assert.equal(sittingOut(lead), 1);
  assert.equal(lead.currentPlayer, 2);
});

// The last trick: Alice leads the ace of trump and takes it; Alice and Cara had `before[0]` tricks
function lastTrick(before: TeamScores, overrides: Partial<GameState> = {}): GameState {
  let state = game({
    hands: { 1: [H('A')], 2: [S('9')], 3: [S('10')], 4: [C('9')] },
    tricksWon: before,
    ...overrides
  });
  const plays: [number, Card][] = [[1, H('A')], [2, S('9')], [3, S('10')], [4, C('9')]];
  for (const [seat, card] of plays) if (sittingOut(state) !== seat) state = ok(move(state, seat, { type: 'play', card }));
  return state;
}

test('scoring is 1 for 3 or 4 tricks, 2 for a march, 4 for a lone march, 2 to the defenders for a euchre', () => {
  assert.deepEqual(lastTrick([2, 2]).scores, [1, 0]);
  assert.deepEqual(lastTrick([3, 1]).scores, [1, 0]);
  const march = lastTrick([4, 0]);
  assert.deepEqual(march.scores, [2, 0]);
  assert.equal(march.gameStatus, 'Alice and Cara took all 5 tricks: a march, 2 points');
  assert.deepEqual(lastTrick([4, 0], { alone: true }).scores, [4, 0]);
  assert.deepEqual(lastTrick([2, 2], { alone: true }).scores, [1, 0]);
  const euchred = lastTrick([1, 3]);
  assert.deepEqual(euchred.scores, [0, 2]);
  assert.equal(euchred.gameStatus, 'Alice and Cara were euchred: Bob and Dan score 2');
  assert.deepEqual(euchred.roundSummary, { handNumber: 1, maker: 1, alone: false, tricks: [2, 3], change: [0, 2], acknowledged: [] });
  assert.equal(euchred.phase, 'handOver');
  assert.equal(euchred.currentPlayer, null);
  assert.equal(lastTrick([2, 2]).gameStatus, 'Alice and Cara made it with 3 tricks: 1 point');
});

test('Continue deals the next hand, the deal passing left', () => {
  let state = lastTrick([2, 2]);
  assert.deepEqual(move(state, 1, { type: 'pass' }), { error: 'Not your turn' });
  for (const seat of [1, 2, 3]) state = ok(act(state, seat, { type: 'acknowledgeRound' }));
  assert.equal(state.phase, 'handOver');
  state = ok(act(state, 4, { type: 'acknowledgeRound' }));
  assert.equal(state.phase, 'order');
  assert.equal(state.handNumber, 2);
  assert.equal(state.dealer, 1);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.scores, [1, 0]);
  assert.equal(state.trump, null);
  assert.equal(state.alone, false);
  assert.equal(new Set(every(state).map(cardName)).size, 24);
  assert.equal(state.gameStatus, 'Hand 2: Alice deals');
});

test('the next hand does not wait for disconnected players', () => {
  let state = lastTrick([2, 2]);
  for (const seat of [1, 2, 3]) state = ok(act(state, seat, { type: 'acknowledgeRound' }));
  state = disconnectPlayer(euchre, state, 4, seeded(1));
  assert.equal(state.phase, 'order');
});

test('first team to 10 wins', () => {
  const nine = lastTrick([2, 2], { scores: [8, 9] });
  assert.equal(nine.isGameOver, false);
  const won = lastTrick([4, 0], { scores: [8, 9] });
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1, 3]);
  assert.equal(won.gameStatus, 'Alice and Cara took all 5 tricks: a march, 2 points. Alice and Cara win with 10 points!');
  assert.deepEqual(act(won, 1, { type: 'acknowledgeRound' }), { error: 'The game is over' });
  const defenders = lastTrick([1, 3], { scores: [9, 8] });
  assert.deepEqual(defenders.winners, [2, 4]);
  assert.equal(targetScore({}), 10);
});

test('a player leaving ends the game and the other team wins', () => {
  const state = removePlayer(euchre, game(), 3, seeded(1));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2, 4]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.gameStatus, 'Cara left, so the partnership is broken: Bob and Dan win');
});

test('dismissed player mid-turn', () => {
  // Dismissed while deciding whether to order up, and while the dealer holds six cards
  let state = ok(move(lobby(), 1, { type: 'pass' }));
  const making = removePlayer(euchre, disconnectPlayer(euchre, state, 2, seeded(1)), 2, seeded(1));
  assert.equal(making.isGameOver, true);
  assert.deepEqual(making.winners, [1, 3]);
  state = ok(move(state, 2, { type: 'orderUp' }));
  state = ok(move(state, 2, { type: 'goAlone', alone: false }));
  const discarding = removePlayer(euchre, state, 4, seeded(1));
  assert.equal(discarding.isGameOver, true);
  assert.deepEqual(discarding.winners, [1, 3]);
  assert.deepEqual(move(discarding, 4, { type: 'discard', card: state.hands[4][0] }), { error: 'The game is over' });
});

test('invalid moves', () => {
  const state = game();
  const bad: unknown[] = [
    null, 'play', 7, {}, { type: 'shout' },
    { type: 'play' }, { type: 'play', card: { suit: 'hearts', rank: '2' } }, { type: 'play', card: { suit: 'stars', rank: '9' } },
    { type: 'play', card: H('A') }, { type: 'orderUp' }, { type: 'pass' }, { type: 'nameTrump', suit: 'clubs' },
    { type: 'nameTrump', suit: 'stars' }, { type: 'goAlone', alone: 'yes' }, { type: 'goAlone', alone: true }, { type: 'discard', card: S('9') }
  ];
  for (const m of bad) {
    const result = move(state, 1, m);
    assert.ok('error' in result, `expected an error for ${JSON.stringify(m)}`);
    assert.equal(state.phase, 'play');
  }
  assert.deepEqual(move(state, 1, { type: 'play', card: H('A') }), { error: 'You do not have that card' });
  assert.deepEqual(move(state, 2, { type: 'play', card: S('A') }), { error: 'Not your turn' });
  assert.deepEqual(move(state, 9, { type: 'play', card: S('A') }), { error: 'Not your turn' });
  const following = game({ currentPlayer: 2, trick: [{ seat: 1, card: S('9') }] });
  assert.deepEqual(move(following, 2, { type: 'play', card: C('9') }), { error: 'Follow suit: play spades' });

  const dealt = lobby();
  assert.deepEqual(move(dealt, 1, { type: 'play', card: dealt.hands[1][0] }), { error: 'Trump has not been made yet' });
  assert.deepEqual(move(dealt, 1, { type: 'goAlone', alone: true }), { error: 'Only the maker decides on going alone, once trump is made' });
  assert.deepEqual(move(dealt, 1, { type: 'discard', card: dealt.hands[1][0] }), { error: 'Only the dealer discards, after picking up' });
  const alone = ok(move(dealt, 1, { type: 'orderUp' }));
  assert.deepEqual(move(alone, 1, { type: 'pass' }), { error: 'Say whether you go alone' });
  assert.deepEqual(move(alone, 1, { type: 'play', card: alone.hands[1][0] }), { error: 'Trump has not been made yet' });

  assert.deepEqual(act(state, 1, { type: 'acknowledgeRound' }), { error: 'Nothing to continue' });
  assert.deepEqual(act(state, 1, { type: 'other' }), { error: 'Unknown action' });
});

test('table view hides hands', () => {
  // Every step of a short hand: both rounds of making trump, going alone, the discard and a few tricks
  for (const order of [true, false]) {
    let state = dealHand(lobby(), 4, seeded(5));
    const steps: GameState[] = [state];
    if (order) {
      steps.push(state = ok(move(state, 1, { type: 'pass' })));
      steps.push(state = ok(move(state, 2, { type: 'orderUp' })));
      steps.push(state = ok(move(state, 2, { type: 'goAlone', alone: false })));
      steps.push(state = ok(move(state, 4, { type: 'discard', card: state.hands[4][0] })));
    } else {
      for (const seat of [1, 2, 3, 4, 1]) steps.push(state = ok(move(state, seat, { type: 'pass' })));
      const suit = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).find(other => other !== state.upcard?.suit) ?? assert.fail();
      steps.push(state = ok(move(state, 2, { type: 'nameTrump', suit })));
      steps.push(state = ok(move(state, 2, { type: 'goAlone', alone: true })));
    }
    for (let i = 0; i < 6; i++) {
      const seat = state.currentPlayer ?? assert.fail('nobody to play');
      const card = state.hands[seat].find(held => canPlayCard(state.hands[seat], held, state.trick, state.trump));
      steps.push(state = ok(move(state, seat, { type: 'play', card })));
    }
    for (const step of steps) {
      const table = toPublicState(step, false, null) as PublicGameState;
      const text = JSON.stringify(table);
      assert.deepEqual(table.hand, []);
      assert.equal(table.discard, null);
      for (const key of ['hands', 'kitty']) assert.equal(key in table, false);
      // No hidden card shows up anywhere but in the trick being played, the last trick, and the turned-up card
      const shown = [...step.trick, ...(step.lastTrick?.plays ?? [])].map(play => JSON.stringify(play.card));
      if (step.upcard) shown.push(JSON.stringify(step.upcard));
      for (const card of [...Object.values(step.hands).flat(), ...step.kitty, ...(step.discard ? [step.discard] : [])]) {
        if (!shown.includes(JSON.stringify(card))) assert.equal(text.includes(JSON.stringify(card)), false);
      }
      for (const seat of [1, 2, 3, 4]) {
        const own = toPublicState(step, false, seat);
        assert.deepEqual(own.hand, step.hands[seat]);
        assert.equal(own.handCounts[seat], step.hands[seat].length);
      }
    }
  }
});

test('describes plays for the status line', () => {
  let state = game();
  state = ok(move(state, 1, { type: 'play', card: S('9') }));
  assert.equal(state.gameStatus, 'Alice played 9 of spades');
  state = ok(move(state, 2, { type: 'play', card: S('A') }));
  state = ok(move(state, 3, { type: 'play', card: S('10') }));
  state = ok(move(state, 4, { type: 'play', card: H('K') }));
  assert.equal(state.gameStatus, 'Dan played king of hearts and took the trick');
  assert.deepEqual(state.tricksWon, [2, 2]);
  assert.equal(state.currentPlayer, 4);
});

test('the game ends at the chosen target', () => {
  const rules = (value: number) => ({ houseRules: withRules({ targetScore: value }), scores: [3, 0] as TeamScores });
  assert.equal(targetScore(rules(5)), 5);
  const won = lastTrick([4, 0], rules(5)); // a march is 2 points: 3 + 2
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1, 3]);
  const standard = lastTrick([4, 0], rules(10));
  assert.equal(standard.isGameOver, false);
});
