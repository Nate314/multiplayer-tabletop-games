import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import { spectatorView } from '../../shared/spectators.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import { seeded } from '../testStates.ts';
import { cribbage } from './index.ts';
import { applyMove, createGameState, toPublicState } from './rules.ts';
import { describeItems } from './scoring.ts';
import { applyAction, deadline, MUGGINS_MS, onDeadline, resumeClock, startShow, waitingOn } from './show.ts';
import type { Action, Card, GameState, Rank, Result, Seat, Suit } from './types.ts';

const SUIT_OF: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
// '5H' is the five of hearts, '10S' the ten of spades
const parse = (text: string): Card[] =>
  text.split(' ').filter(Boolean).map(code => ({ rank: code.slice(0, -1) as Rank, suit: SUIT_OF[code.slice(-1)] }));
const NAMES: Record<Seat, string> = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
const NOW = 1_000_000;

// With the starter 5S: seat 1 scores 8 (four fifteens), seat 2 scores 9 (three fifteens and a run of three),
// the crib scores 6 (two fifteens and a pair)
const PLAYED: Record<Seat, string> = { 1: '2C 3D 10H KS', 2: '4C 6D 9H QS', 3: '7D 8D 2H 3S', 4: 'AH 2S 3C JD' };
const CRIB = 'AC AD 7H 8C';

const NAME: HouseRuleValues = { muggins: true };
const SINGLE: HouseRuleValues = { muggins: true, mugginsStyle: 'single' };
const SHOWN: HouseRuleValues = { muggins: true, mugginsStyle: 'shown' };

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// The show of `players`, the last seat dealing, with every pegging card played
function atShow(players: number, values: HouseRuleValues = {}, scores?: Record<number, number>): GameState {
  const seats = [1, 2, 3, 4].slice(0, players);
  const sides = players === 4 ? [0, 1] : seats;
  const start = scores ?? Object.fromEntries(sides.map(side => [side, 0]));
  return startShow({
    ...createGameState('g'),
    started: true,
    activePlayers: seats,
    playerNames: Object.fromEntries(seats.map(seat => [seat, NAMES[seat]])),
    houseRules: withRules(values),
    dealer: players,
    starter: parse('5S')[0],
    hands: Object.fromEntries(seats.map(seat => [seat, []])),
    played: Object.fromEntries(seats.map(seat => [seat, parse(PLAYED[seat])])),
    crib: parse(CRIB),
    scores: start,
    handStartScores: start,
    pegs: Object.fromEntries(Object.entries(start).map(([side, score]) => [side, { front: score, back: 0 }]))
  });
}

const claim = (state: GameState, seat: Seat, points: number) => ok(applyMove(state, seat, { type: 'claim', points }, seeded(1), NOW));
const act = (state: GameState, seat: Seat, action: Action) => applyAction(state, seat, action, seeded(1));
const press = (state: GameState, seat: Seat, cards?: string) => ok(act(state, seat, { type: 'muggins', ...(cards && { cards: parse(cards) }) }));
const pass = (state: GameState, seat: Seat) => ok(act(state, seat, { type: 'noMuggins' }));

test('muggins off scores each show at once and the round summary lists the breakdowns', () => {
  const state = atShow(2, {}, { 1: 10, 2: 20 });
  assert.equal(state.phase, 'roundOver');
  assert.deepEqual(state.scores, { 1: 18, 2: 35 });
  const summary = state.roundSummary ?? assert.fail('expected a round summary');
  assert.deepEqual(summary.counts.map(c => [c.owner, c.crib, c.total]), [[1, false, 8], [2, false, 9], [2, true, 6]]);
  assert.equal(describeItems(summary.counts[1].items), 'Fifteen two, fifteen four, fifteen six, and a run of three is nine');
  assert.deepEqual(summary.change, { 1: 8, 2: 15 });
  assert.deepEqual(waitingOn(state), [1, 2]);
  const once = ok(act(state, 1, { type: 'acknowledgeRound' }));
  const next = ok(act(once, 2, { type: 'acknowledgeRound' }));
  assert.deepEqual([next.phase, next.handNumber, next.dealer, next.hands[1].length], ['discard', 2, 1, 6]);
  assert.deepEqual(next.handStartScores, { 1: 18, 2: 35 });
});

test('the show stops when a side reaches the target', () => {
  const state = atShow(2, {}, { 1: 115, 2: 110 });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.deepEqual(state.scores, { 1: 123, 2: 110 });
  assert.equal(state.shows.length, 1);
});

test('an overclaim is corrected to the true total', () => {
  let state = atShow(2, NAME);
  assert.deepEqual([state.phase, state.currentPlayer], ['show', 1]);
  state = claim(state, 1, 12);
  assert.equal(state.currentPlayer, null);
  state = pass(state, 2);
  assert.deepEqual(state.scores, { 1: 8, 2: 0 });
  assert.deepEqual([state.shows[0].closesAt, state.shows.length, state.currentPlayer], [null, 2, 2]);
});

test('a claim is a whole number from 0 to 29', () => {
  const state = atShow(2, NAME);
  for (const points of [-1, 2.5, 30, 1e300]) assert.ok('error' in applyMove(state, 1, { type: 'claim', points }, seeded(1), NOW), String(points));
  assert.equal(claim(state, 1, 29).shows[0].claimed, 29);
});

test('an underclaim with no press keeps only the claim', () => {
  const state = onDeadline(claim(atShow(2, NAME), 1, 6));
  assert.deepEqual(state.scores, { 1: 6, 2: 0 });
  assert.equal(state.currentPlayer, 2);
});

test("a correct selection takes that combination's points for the presser's side", () => {
  const state = press(claim(atShow(2, NAME), 1, 6), 2, '10H 5S');
  assert.deepEqual(state.scores, { 1: 6, 2: 2 });
  assert.deepEqual(state.shows[0].muggins, [{ by: 2, points: 2 }]);
});

test('a wrong selection is refused with no cost', () => {
  const under = claim(atShow(2, NAME), 1, 6);
  assert.deepEqual(act(under, 2, { type: 'muggins', cards: parse('2C 3D') }), { error: 'That is not a combination they missed' });
  // A real fifteen, but nothing was missed
  const exact = claim(atShow(2, NAME), 1, 8);
  assert.deepEqual(act(exact, 2, { type: 'muggins', cards: parse('10H 5S') }), { error: 'That is not a combination they missed' });
  assert.deepEqual(onDeadline(exact).scores, { 1: 8, 2: 0 });
});

test("at four players the points go to the presser's partnership", () => {
  let state = claim(atShow(4, NAME), 1, 6);
  state = press(state, 2, '10H 5S');
  assert.notEqual(state.shows[0].closesAt, null);
  assert.deepEqual(waitingOn(state), [4]);
  state = pass(state, 4);
  assert.deepEqual(state.scores, { 0: 6, 1: 2 });
});

test('the partner cannot press', () => {
  const state = claim(atShow(4, NAME), 1, 6);
  assert.ok('error' in act(state, 3, { type: 'muggins', cards: parse('10H 5S') }));
  assert.ok('error' in act(state, 1, { type: 'noMuggins' }));
});

test('a press takes the whole difference', () => {
  const state = press(claim(atShow(2, SINGLE), 1, 4), 2);
  assert.deepEqual(state.scores, { 1: 4, 2: 4 });
});

test('a press when nothing was missed costs 2, not below 0', () => {
  assert.deepEqual(press(claim(atShow(2, SINGLE, { 1: 0, 2: 5 }), 1, 8), 2).scores, { 1: 8, 2: 3 });
  assert.deepEqual(press(claim(atShow(2, SINGLE, { 1: 0, 2: 1 }), 1, 8), 2).scores, { 1: 8, 2: 0 });
});

test('the breakdown is visible during the window and the first press takes the missed points', () => {
  let state = claim(atShow(3, SHOWN), 1, 6);
  const shown = toPublicState(state, false, 2).shows[0];
  assert.deepEqual([shown.total, shown.items?.length], [8, 4]);
  state = press(state, 2);
  assert.deepEqual(state.shows[0].muggins, [{ by: 2, points: 2 }]);
});

test('a second press gets nothing', () => {
  let state = press(claim(atShow(3, SHOWN), 1, 6), 2);
  state = press(state, 3);
  assert.deepEqual(state.shows[0].muggins, [{ by: 2, points: 2 }, { by: 3, points: 0 }]);
  assert.deepEqual(state.scores, { 1: 6, 2: 2, 3: 0 });
});

test('the window closes early when every opponent has pressed or passed', () => {
  let state = pass(claim(atShow(3, NAME), 1, 6), 2);
  assert.notEqual(state.shows[0].closesAt, null);
  assert.deepEqual(waitingOn(state), [3]);
  assert.ok('error' in act(state, 2, { type: 'noMuggins' }));
  state = pass(state, 3);
  assert.equal(state.shows[0].closesAt, null);
  assert.equal(state.currentPlayer, 2);
});

test('onDeadline closes the window', () => {
  const state = claim(atShow(3, NAME), 1, 6);
  assert.equal(deadline(state), NOW + MUGGINS_MS);
  assert.equal(deadline(resumeClock(state, NOW + 5)), NOW + 5 + MUGGINS_MS);
  const closed = onDeadline(state);
  assert.equal(deadline(closed), null);
  assert.deepEqual([closed.scores[1], closed.currentPlayer], [6, 2]);
});

test('no view shows the true total during a hidden window', () => {
  for (const values of [NAME, SINGLE]) {
    const awaiting = atShow(3, values);
    for (const state of [awaiting, claim(awaiting, 1, 6)]) {
      const views = [
        ...[1, 2, null].map(viewer => toPublicState(state, false, viewer)),
        ...[false, true].map(tableScreen => spectatorView(cribbage, state, { id: 's1', name: 'Eve', tableScreen, allowedSeats: [1, 2] }))
      ];
      for (const view of views) assert.doesNotMatch(JSON.stringify(view), /"items"|"total"|"taken"/);
    }
  }
});
