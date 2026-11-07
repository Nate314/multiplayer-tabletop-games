import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import { seeded } from '../testStates.ts';
import {
  allowsUndoVote, applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft,
  recordsAction, resetLobby, toPublicState, waitingOn
} from './rules.ts';
import type { Card, GameState, Result, Seat } from './types.ts';

function lobby(values: HouseRuleValues = {}, players = 3): GameState {
  const activePlayers = Array.from({ length: players }, (_, i) => i + 1);
  return resetLobby({
    ...createGameState('g1'),
    activePlayers,
    playerNames: Object.fromEntries(activePlayers.map(seat => [seat, ['Alice', 'Bob', 'Cara', 'Dan'][seat - 1]])),
    currentPlayer: 1,
    houseRules: withRules(values)
  }, seeded(3));
}

let nextId = 100;
const cards = (kind: Card['kind'], n: number): Card[] => Array.from({ length: n }, () => ({ id: nextId++, kind }));
const ids = (hand: Card[]) => hand.map(card => card.id);

// Alice: 5 saffron 4 silver; Bob: 5 silver 4 coffee; Cara: 5 coffee 4 saffron
function trading(values: HouseRuleValues = {}): GameState {
  return {
    ...lobby(values),
    hands: {
      1: [...cards('saffron', 5), ...cards('silver', 4)],
      2: [...cards('silver', 5), ...cards('coffee', 4)],
      3: [...cards('coffee', 5), ...cards('saffron', 4)]
    }
  };
}

const ok = (result: Result<GameState>): GameState => {
  if ('error' in result) assert.fail(result.error);
  return result.state;
};
const act = (state: GameState, seat: Seat, action: unknown) => ok(applyAction(state, seat, action, seeded(5)));
const failure = (result: Result<GameState>): string => {
  if (!('error' in result)) assert.fail('expected an error');
  return result.error;
};
const refused = (state: GameState, seat: Seat, action: unknown) => failure(applyAction(state, seat, action, seeded(5)));
const of = (state: GameState, seat: Seat, kind: Card['kind'], n: number) =>
  ids(state.hands[seat]!.filter(card => card.kind === kind).slice(0, n));
const offer = (state: GameState, seat: Seat, kind: Card['kind'], n: number) =>
  act(state, seat, { type: 'offer', cards: of(state, seat, kind, n) });
const offerIdOf = (state: GameState, seat: Seat) => state.offers.find(o => o.seat === seat)!.id;

test('an offer shows only its count', () => {
  const start = trading();
  const state = offer(start, 1, 'silver', 3);
  assert.equal(state.started, true);
  assert.equal(recordsAction(start, 1, { type: 'offer', cards: of(start, 1, 'silver', 3) }), false);
  const view = toPublicState(state, false, 2);
  assert.deepEqual(view.offers, [{ id: offerIdOf(state, 1), seat: 1, count: 3 }]);
  assert.ok(!JSON.stringify(view.offers).includes('silver'));
  assert.equal(refused(start, 1, { type: 'offer', cards: [...of(start, 1, 'silver', 1), ...of(start, 1, 'saffron', 1)] }),
    'Offer cards of one commodity');
});

test('a new offer replaces my open one', () => {
  const first = offer(trading(), 1, 'silver', 3);
  const second = offer(first, 1, 'saffron', 2);
  assert.equal(second.offers.length, 1);
  assert.notEqual(offerIdOf(second, 1), offerIdOf(first, 1));
  assert.deepEqual(second.offers[0].cards, of(second, 1, 'saffron', 2));
});

test('withdraw closes my offer', () => {
  const state = act(offer(trading(), 1, 'silver', 3), 1, { type: 'withdraw' });
  assert.deepEqual(state.offers, []);
  assert.equal(recordsAction(state, 1, { type: 'withdraw' }), false);
});

test('withdraw with nothing open is refused', () => {
  assert.equal(refused(trading(), 1, { type: 'withdraw' }), 'You have no open offer');
});

test('accepting swaps the two offers blind and records it', () => {
  let state = offer(trading(), 1, 'silver', 3);
  state = offer(state, 2, 'coffee', 3);
  const aliceGives = state.offers[0].cards, bobGives = state.offers[1].cards;
  const action = { type: 'accept', offer: offerIdOf(state, 1) };
  assert.equal(recordsAction(state, 2, action), true);
  const after = act(state, 2, action);
  assert.ok(bobGives.every(id => after.hands[1]!.some(card => card.id === id)));
  assert.ok(aliceGives.every(id => after.hands[2]!.some(card => card.id === id)));
  assert.ok(!aliceGives.some(id => after.hands[1]!.some(card => card.id === id)));
  assert.equal(after.hands[1]!.length, 9);
  assert.equal(after.hands[2]!.length, 9);
  assert.deepEqual(after.offers, []);
  assert.deepEqual(after.lastMove, { type: 'swap', seats: [2, 1], count: 3 });
  assert.equal(after.gameStatus, 'Bob and Alice swapped 3 cards');
});

test('a swap of one card says card', () => {
  const state = offer(offer(trading(), 1, 'silver', 1), 2, 'coffee', 1);
  assert.equal(act(state, 2, { type: 'accept', offer: offerIdOf(state, 1) }).gameStatus, 'Bob and Alice swapped 1 card');
});

test('accept needs my own open offer of the same count', () => {
  const state = offer(trading(), 1, 'silver', 3);
  const action = { type: 'accept', offer: offerIdOf(state, 1) };
  assert.equal(refused(state, 2, action), 'Make an offer of 3 first');
  assert.equal(refused(offer(state, 2, 'coffee', 2), 2, action), 'Your offer must be 3 cards');
  assert.equal(refused(state, 1, action), 'That is your own offer');
});

test('an offer withdrawn and replaced cannot be accepted by its old id', () => {
  let state = offer(trading(), 1, 'silver', 3);
  const oldId = offerIdOf(state, 1);
  state = act(state, 1, { type: 'withdraw' });
  state = offer(state, 1, 'saffron', 3);
  state = offer(state, 2, 'coffee', 3);
  const result = applyAction(state, 2, { type: 'accept', offer: oldId }, seeded(5));
  assert.deepEqual(result, { error: 'Already taken' });
  // The refusal changes nothing: Bob keeps his offer and his cards, and Alice's new offer stays open
  assert.deepEqual(state.offers.map(o => o.seat), [1, 2]);
  // Two accepts of the same offer: the first swaps, the second is quietly taken
  const swapped = act(offer(state, 3, 'saffron', 3), 2, { type: 'accept', offer: offerIdOf(state, 1) });
  const late = applyAction(swapped, 3, { type: 'accept', offer: offerIdOf(state, 1) }, seeded(5));
  assert.deepEqual(late, { error: 'Already taken' });
  assert.ok(swapped.offers.some(o => o.seat === 3));
});

test('Corner! with 9 scores the value and ends the round', () => {
  const state = { ...trading(), hands: { ...trading().hands, 1: cards('saffron', 9) } };
  assert.equal(recordsAction(state, 1, { type: 'corner' }), true);
  const after = act(offer(state, 2, 'coffee', 2), 1, { type: 'corner' });
  assert.equal(after.phase, 'summary');
  assert.deepEqual(after.scores, { 1: 100, 2: 0, 3: 0 });
  assert.deepEqual(after.offers, []);
  assert.equal(after.summary?.winner, 1);
  assert.deepEqual(after.summary?.corner, { commodity: 'saffron', points: 100, double: false });
  assert.equal(after.summary?.hand.length, 9);
  assert.deepEqual(after.lastMove, { type: 'corner', playerNumber: 1, commodity: 'saffron', points: 100, double: false });
  assert.equal(after.isGameOver, false);
  assert.equal(recordsAction(after, 1, { type: 'corner' }), false);
});

test('a hand without a corner is refused', () => {
  assert.equal(refused(trading(), 1, { type: 'corner' }), 'You have no corner');
});

test('Bull and Bear: 8 plus the Bull corners, 9 plus the Bull doubles, the Bear blocks, holders lose 20', () => {
  const base = trading({ bullBear: true });
  const eightBull = act({ ...base, hands: { ...base.hands, 1: [...cards('saffron', 8), ...cards('bull', 1)], 2: [...cards('silver', 9), ...cards('bear', 1)] } }, 1, { type: 'corner' });
  assert.deepEqual(eightBull.scores, { 1: 100, 2: -20, 3: 0 });
  assert.deepEqual(eightBull.summary?.penalties, { 2: -20 });

  const nineBull = act({ ...base, hands: { ...base.hands, 1: [...cards('saffron', 9), ...cards('bull', 1)], 3: [...cards('coffee', 9), ...cards('bear', 1)] } }, 1, { type: 'corner' });
  assert.deepEqual(nineBull.scores, { 1: 200, 2: 0, 3: -20 });
  assert.equal(nineBull.summary?.corner.double, true);

  const otherBull = act({ ...base, hands: { 1: cards('saffron', 9), 2: [...cards('silver', 9), ...cards('bull', 1)], 3: [...cards('coffee', 9), ...cards('bear', 1)] } }, 1, { type: 'corner' });
  assert.deepEqual(otherBull.scores, { 1: 100, 2: -20, 3: -20 });

  const bear = { ...base, hands: { ...base.hands, 1: [...cards('saffron', 9), ...cards('bear', 1)] } };
  assert.equal(refused(bear, 1, { type: 'corner' }), 'You have no corner');
});

test('the game ends when a score reaches the target; 250 under the house rule', () => {
  const near = (values: HouseRuleValues, score: number) =>
    ({ ...trading(values), scores: { 1: score, 2: 50, 3: 0 }, hands: { ...trading().hands, 1: cards('saffron', 9) } });
  const standard = act(near({}, 300), 1, { type: 'corner' });
  assert.equal(standard.isGameOver, false);
  const won = act(near({}, 400), 1, { type: 'corner' });
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.equal(refused(won, 2, { type: 'continue' }), 'The game is over');
  const short = act(near({ targetScore: 250 }, 150), 1, { type: 'corner' });
  assert.equal(short.isGameOver, true);
  assert.deepEqual(finalStandings(short).map(row => [row.seat, row.place, row.score]),
    [[1, 1, '250 points'], [2, 2, '50 points'], [3, 3, '0 points']]);
});

test('Continue deals the next round once everyone is ready', () => {
  let state = act({ ...trading(), hands: { ...trading().hands, 1: cards('saffron', 9) } }, 1, { type: 'corner' });
  assert.deepEqual(waitingOn(state), [1, 2, 3]);
  state = act(state, 1, { type: 'continue' });
  state = act(state, 3, { type: 'continue' });
  assert.deepEqual(waitingOn(state), [2]);
  assert.equal(state.phase, 'summary');
  state = act(state, 2, { type: 'continue' });
  assert.equal(state.phase, 'trading');
  assert.equal(state.round, 2);
  assert.equal(state.summary, null);
  assert.deepEqual(waitingOn(state), []);
  assert.deepEqual(state.scores, { 1: 100, 2: 0, 3: 0 });
  // Bull and Bear: round 1 deals 10 to seats 1 and 2, round 2 one seat on, to 2 and 3
  let bb = act({ ...trading({ bullBear: true }), hands: { ...trading().hands, 1: cards('saffron', 9) } }, 1, { type: 'corner' });
  assert.deepEqual([1, 2, 3].map(seat => lobby({ bullBear: true }).hands[seat]!.length), [10, 10, 9]);
  for (const seat of [1, 2, 3]) bb = act(bb, seat, { type: 'continue' });
  assert.deepEqual([1, 2, 3].map(seat => bb.hands[seat]!.length), [9, 10, 10]);
});

test('actions during the summary are refused except Continue', () => {
  const state = act({ ...trading(), hands: { ...trading().hands, 1: cards('saffron', 9) } }, 1, { type: 'corner' });
  assert.equal(refused(state, 2, { type: 'offer', cards: of(state, 2, 'silver', 1) }), 'The round is over');
  assert.equal(refused(state, 2, { type: 'withdraw' }), 'The round is over');
  assert.equal(refused(state, 2, { type: 'accept', offer: 1 }), 'The round is over');
  assert.equal(refused(state, 1, { type: 'corner' }), 'The round is over');
  assert.ok(act(state, 2, { type: 'continue' }));
  assert.equal(refused(trading(), 2, { type: 'continue' }), 'Nothing to continue');
  assert.equal(refused(trading(), 2, { type: 'dance' }), 'Unknown action');
});

test('a player leaving mid-round redeals for those left; below three the game ends with the scores as they stand', () => {
  const four = { ...lobby({}, 4), scores: { 1: 10, 2: 70, 3: 30, 4: 0 }, started: true };
  const offered = offer(four, 1, four.hands[1]![0].kind, 1);
  const left = onPlayerLeft({ ...offered, activePlayers: [1, 2, 3] }, 4, seeded(8));
  assert.equal(left.round, 2);
  assert.equal(left.phase, 'trading');
  assert.deepEqual(left.offers, []);
  assert.deepEqual(Object.keys(left.hands), ['1', '2', '3']);
  const all = [1, 2, 3].flatMap(seat => left.hands[seat]!);
  assert.equal(all.length, 27);
  assert.equal(new Set(all.map(card => card.kind)).size, 3);
  assert.equal(left.isGameOver, false);
  assert.deepEqual(left.scores, { 1: 10, 2: 70, 3: 30, 4: 0 });

  const ended = onPlayerLeft({ ...left, activePlayers: [1, 2] }, 3, seeded(8));
  assert.equal(ended.isGameOver, true);
  assert.deepEqual(ended.winners, [2]);
  assert.equal(ended.currentPlayer, null);
});

test('a disconnected player\'s offer is withdrawn', () => {
  const state = offer(offer(trading(), 1, 'silver', 3), 2, 'coffee', 1);
  const after = onPlayerDisconnected({ ...state, disconnected: [1] }, 1, seeded(1));
  assert.deepEqual(after.offers.map(o => o.seat), [2]);
});

test('there are no turns and no undo vote', () => {
  const state = lobby();
  assert.equal(state.currentPlayer, null);
  assert.equal(state.phase, 'trading');
  assert.equal(state.round, 1);
  assert.deepEqual(state.scores, { 1: 0, 2: 0, 3: 0 });
  assert.deepEqual([1, 2, 3].map(seat => state.hands[seat]!.length), [9, 9, 9]);
  assert.equal(allowsUndoVote(), false);
  assert.deepEqual(applyMove(), { error: 'Trading Floor has no turns' });
});
