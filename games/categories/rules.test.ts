import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, applyMove, createGameState, deadline, finalStandings, onDeadline, onPlayerLeft, recordsAction, resetLobby, votersOf, waitingOn } from './rules.ts';
import { verdicts } from './scoring.ts';
import type { GameState, Seat } from './types.ts';
import { withRules } from '../../server/testing.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import { seeded } from '../testStates.ts';

const NOW = 1_000_000;
const NAMES: Record<number, string> = { 1: 'Ann', 2: 'Bob', 3: 'Cy' };

function table(seats: Seat[], values: HouseRuleValues = {}, seed = 1): GameState {
  const state: GameState = {
    ...createGameState('g1'),
    activePlayers: seats,
    playerNames: Object.fromEntries(seats.map(s => [s, NAMES[s]])),
    houseRules: withRules(values)
  };
  return resetLobby(state, seeded(seed));
}

// Clock running, letter B, a list of two
function running(seats: Seat[] = [1, 2, 3], values: HouseRuleValues = {}): GameState {
  return { ...table(seats, values), letter: 'B', list: ['Fruits', 'Animals'], phaseStartedAt: NOW };
}

function act(state: GameState, seat: Seat, action: unknown, now = NOW): GameState {
  const result = applyAction(state, seat, action, Math.random, now);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const error = (state: GameState, seat: Seat, action: unknown) => {
  const result = applyAction(state, seat, action, Math.random, NOW);
  return 'error' in result ? result.error : 'no error';
};

function review(answers: Record<number, string[]>, seats: Seat[] = [1, 2, 3], values: HouseRuleValues = {}): GameState {
  let state = running(seats, values);
  for (const seat of seats) state = act(state, seat, { type: 'done', answers: answers[seat] });
  return state;
}

const without = (state: GameState, seat: Seat): GameState => ({ ...state, activePlayers: state.activePlayers.filter(s => s !== seat) });

test("round one deals a letter and a list of the rule's size, from the easy letters by default", () => {
  assert.equal(table([1, 2], { listSize: 8 }).list.length, 8);
  for (let seed = 1; seed <= 50; seed++) assert.ok(!'QUVXYZ'.includes(table([1, 2], {}, seed).letter));
  const hard = table([1, 2], { hardLetters: true });
  assert.equal(hard.letters.length + 1, 26);
});

test('an action before the clock starts is refused', () => {
  const state = table([1, 2]);
  assert.equal(error(state, 1, { type: 'answers', answers: Array(12).fill('') }), 'Wait for everyone to agree to the house rules');
  assert.deepEqual(applyMove(), { error: 'Categories has no turns' });
});

test('answers are stored, a long answer is refused, and Done locks them', () => {
  let state = act(running(), 1, { type: 'answers', answers: [' Banana ', ''] });
  assert.deepEqual(state.answers[1], ['Banana', '']);
  assert.equal(error(state, 1, { type: 'answers', answers: ['x'.repeat(41), ''] }), 'Answers are up to 40 characters');
  assert.equal(error(state, 1, { type: 'answers', answers: ['Banana'] }), 'Send one answer per category');
  state = act(state, 1, { type: 'done', answers: ['Banana', 'Bear'] });
  assert.deepEqual(state.done, [1]);
  assert.equal(state.gameStatus, 'Ann is done');
  assert.equal(error(state, 1, { type: 'answers', answers: ['', ''] }), 'You are done for this round');
});

test('answering closes when everyone is done, or on the deadline', () => {
  const closed = review({ 1: ['Banana', ''], 2: ['Bear', ''], 3: ['Bat', ''] });
  assert.equal(closed.phase, 'review');
  assert.deepEqual(closed.lastMove, { type: 'closeAnswers', reason: 'allDone' });
  assert.equal(error(closed, 1, { type: 'answers', answers: ['', ''] }), 'Answering is over');

  const open = running();
  assert.equal(deadline(open), NOW + 120_000);
  const late = onDeadline(act(open, 1, { type: 'answers', answers: ['Banana', ''] }));
  assert.equal(late.phase, 'review');
  assert.deepEqual(late.lastMove, { type: 'closeAnswers', reason: 'timeUp' });
  assert.deepEqual(late.answers[2], ['', '']);
  assert.deepEqual(late.answers[3], ['', '']);
});

test('a challenge by the only other player rejects at once', () => {
  let state = review({ 1: ['Banana', ''], 2: ['Bear', ''] }, [1, 2]);
  state = act(state, 2, { type: 'challenge', category: 0, seat: 1 });
  assert.equal(state.challenges[0].verdict, 'rejected');
  assert.deepEqual(state.lastMove, { type: 'verdict', category: 0, seat: 1, rejected: true });
  assert.equal(state.gameStatus, "Ann's answer for Fruits was rejected");
});

test('with three players a majority of the other two rejects, and a split keeps', () => {
  const start = review({ 1: ['Banana', 'Bear'], 2: ['Bean', 'Bat'], 3: ['Beet', 'Boar'] });
  let state = act(start, 2, { type: 'challenge', category: 0, seat: 1 });
  assert.equal(state.challenges[0].verdict, 'open');
  assert.equal(error(state, 1, { type: 'judge', category: 0, seat: 1, reject: true }), 'You do not vote on your own answer');
  state = act(state, 3, { type: 'judge', category: 0, seat: 1, reject: true });
  assert.equal(state.challenges[0].verdict, 'rejected');
  assert.equal(error(state, 3, { type: 'judge', category: 0, seat: 1, reject: true }), 'No open challenge on that answer');

  state = act(start, 2, { type: 'challenge', category: 1, seat: 1 });
  assert.equal(error(state, 2, { type: 'judge', category: 1, seat: 1, reject: true }), 'You already voted');
  state = act(state, 3, { type: 'judge', category: 1, seat: 1, reject: false });
  assert.equal(state.challenges[0].verdict, 'kept');
  assert.equal(state.gameStatus, "Ann's answer for Animals was kept");
  assert.deepEqual(votersOf(state, 1), [2, 3]);
});

test('only a scoring answer may be challenged, never your own, and once', () => {
  let state = review({ 1: ['Banana', 'Cat'], 2: ['Banana', 'Bat'], 3: ['Beet', ''] });
  assert.equal(error(state, 1, { type: 'challenge', category: 0, seat: 1 }), 'You cannot challenge your own answer');
  assert.equal(error(state, 3, { type: 'challenge', category: 0, seat: 1 }), 'Only a scoring answer can be challenged'); // duplicate
  assert.equal(error(state, 3, { type: 'challenge', category: 1, seat: 1 }), 'Only a scoring answer can be challenged'); // wrong letter
  assert.equal(error(state, 1, { type: 'challenge', category: 1, seat: 3 }), 'Only a scoring answer can be challenged'); // empty
  state = act(state, 1, { type: 'challenge', category: 0, seat: 3 });
  assert.equal(error(state, 2, { type: 'challenge', category: 0, seat: 3 }), 'That answer was already challenged');
});

test('a new challenge clears every Continue', () => {
  let state = review({ 1: ['Banana', ''], 2: ['Bear', ''], 3: ['Bat', ''] });
  state = act(act(state, 1, { type: 'continue' }), 2, { type: 'continue' });
  state = act(state, 3, { type: 'challenge', category: 0, seat: 2 });
  assert.deepEqual(state.review?.acknowledged, []);
  assert.equal(error(state, 1, { type: 'continue' }), 'Vote on the open challenges first');
  assert.deepEqual(waitingOn(state), [1, 2, 3]);
});

test('Continue adds the round points and starts the next round with a new letter and list', () => {
  let state = review({ 1: ['Banana', 'Bear'], 2: ['Bean', 'Bear'], 3: ['Beet', 'Cat'] });
  const { letter, list } = state;
  for (const seat of [1, 2, 3] as Seat[]) state = act(state, seat, { type: 'continue' }, NOW + 5);
  assert.deepEqual(state.scores, { 1: 1, 2: 1, 3: 1 });
  assert.equal(state.round, 2);
  assert.equal(state.phase, 'answering');
  assert.equal(state.phaseStartedAt, NOW + 5);
  assert.notEqual(state.letter, letter);
  assert.ok(state.list.every(c => !list.includes(c)));
  assert.deepEqual(state.answers, {});
  assert.deepEqual(state.lastMove, { type: 'nextRound', round: 2, letter: state.letter });
});

test('the last round ends the game with the top total winning', () => {
  const play = (answers: Record<number, string[]>) => {
    let state = review(answers, [1, 2, 3], { rounds: 1 });
    for (const seat of [1, 2, 3] as Seat[]) state = act(state, seat, { type: 'continue' });
    return state;
  };
  let end = play({ 1: ['Banana', 'Bear'], 2: ['Bean', 'Bat'], 3: ['Beet', 'Bat'] });
  assert.equal(end.isGameOver, true);
  assert.deepEqual(end.winners, [1]);
  assert.equal(end.gameStatus, 'Ann won with 2 points');
  assert.deepEqual(finalStandings(end).map(r => [r.seat, r.place, r.score]), [[1, 1, '2 points'], [2, 2, '1 point'], [3, 2, '1 point']]);
  end = play({ 1: ['Banana', ''], 2: ['Bean', ''], 3: ['', ''] });
  assert.deepEqual(end.winners, [1, 2]);
  assert.equal(end.gameStatus, 'Ann and Bob won with 1 point');
});

test("a dismissed player's duplicate partner scores", () => {
  const state = review({ 1: ['Bear', ''], 2: ['Bat', ''], 3: ['Bear', ''] });
  assert.equal(verdicts(state.answers, state.activePlayers, 'B', [])[1]?.[0], 'duplicate');
  const left = onPlayerLeft(without(state, 3), 3);
  assert.equal(verdicts(left.answers, left.activePlayers, 'B', [])[1]?.[0], 'valid');
  assert.equal(left.answers[3], undefined);
});

test('a dismissed voter no longer blocks a challenge', () => {
  let state = review({ 1: ['Banana', ''], 2: ['Bean', ''], 3: ['Beet', ''] });
  state = act(state, 2, { type: 'challenge', category: 0, seat: 1 });
  assert.equal(state.challenges[0].verdict, 'open');
  state = onPlayerLeft(without(state, 3), 3);
  assert.equal(state.challenges[0].verdict, 'rejected');
});

test('status and lastMove never hold an answer while answering', () => {
  const state = act(running(), 1, { type: 'answers', answers: ['Banana', 'Bear'] });
  assert.ok(!JSON.stringify([state.gameStatus, state.lastMove]).includes('Banana'));
  assert.ok(recordsAction(state, 1, { type: 'done' }));
  assert.ok(recordsAction(table([1, 2]), 1, { type: 'answers' }));
  assert.ok(!recordsAction({ ...state, started: true }, 1, { type: 'answers' }));
});
