import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictionary } from './index.ts';
import { CHOOSE_MS, REVEAL_MS } from './clock.ts';
import { DRAWER_POINTS, applyAction, createGameState, deadline, guesserPoints, onDeadline, recordsAction, resumeClock } from './rules.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import { withRules } from '../../server/testing.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import type { Result } from '../../shared/types.ts';
import type { GameState } from './types.ts';

const NOW = 1_000_000;
const TURN_MS = 90_000;
const first = () => 0;

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function lobby(names: string[], values: HouseRuleValues = {}): GameState {
  let state: GameState = { ...createGameState('g'), houseRules: withRules(values) };
  for (const name of names) {
    const result = addPlayer(pictionary, state, name, first);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// Alice (seat 1) drawing "castle" from NOW, with Bob and Cara guessing
function drawing(names = ['Alice', 'Bob', 'Cara']): GameState {
  const state = { ...lobby(names), wordChoices: ['castle', 'apple', 'tree'] };
  return ok(applyMove(pictionary, state, 1, { type: 'choose', index: 0 }, first, NOW));
}

const chat = (state: GameState, seat: number, text: string, now = NOW) => ok(applyAction(state, seat, { type: 'chat', text }, first, now));

test('the drawer is offered wordChoices words', () => {
  for (const count of [3, 5]) {
    const state = lobby(['Alice', 'Bob'], { wordChoices: count });
    assert.equal(state.phase, 'choosing');
    assert.equal(state.currentPlayer, 1);
    assert.equal(state.wordChoices.length, count);
    assert.equal(new Set(state.wordChoices).size, count);
    assert.equal(state.wordChoices.some(word => state.deck.includes(word)), false);
    assert.equal(state.phaseStartedAt, null);
  }
});

test('choosing a word starts the drawing and the clock', () => {
  const state = drawing();
  assert.equal(state.started, true);
  assert.equal(state.phase, 'drawing');
  assert.equal(state.word, 'castle');
  assert.deepEqual(state.wordChoices, []);
  assert.equal(state.phaseStartedAt, NOW);
  assert.deepEqual(state.lastMove, { type: 'choose', playerNumber: 1 });
  assert.equal(deadline(state), NOW + TURN_MS);
});

test('only the drawer may choose, and only while choosing', () => {
  const state = lobby(['Alice', 'Bob']);
  assert.deepEqual(applyMove(pictionary, state, 2, { type: 'choose', index: 0 }, first, NOW), { error: 'Not your turn' });
  assert.ok('error' in applyMove(pictionary, state, 1, { type: 'choose', index: 3 }, first, NOW));
  assert.ok('error' in applyMove(pictionary, state, 1, { type: 'nonsense' }, first, NOW));
  assert.ok('error' in applyMove(pictionary, drawing(), 1, { type: 'choose', index: 0 }, first, NOW));
});

test('time running out reveals the word', () => {
  const state = onDeadline(drawing(), NOW + TURN_MS, first);
  assert.equal(state.phase, 'reveal');
  assert.deepEqual(state.lastMove, { type: 'reveal', word: 'castle', reason: 'timeUp' });
  assert.equal(state.chat.at(-1)?.text, 'The word was castle');
  assert.equal(state.chat.at(-1)?.kind, 'system');
  assert.equal(state.chat.at(-1)?.audience, 'all');
  assert.equal(state.gameStatus, 'The word was castle');
  assert.equal(state.draws[1], 1);
  assert.equal(deadline(state), NOW + TURN_MS + REVEAL_MS);
});

test('the reveal deadline passes the turn to the next seat', () => {
  const revealed = onDeadline(drawing(), NOW + TURN_MS, first);
  const now = NOW + TURN_MS + REVEAL_MS;
  const state = onDeadline(revealed, now, first);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.phase, 'choosing');
  assert.equal(state.word, null);
  assert.equal(state.wordChoices.length, 3);
  assert.deepEqual(state.lastMove, { type: 'nextTurn', playerNumber: 2 });
  assert.equal(deadline(state), now + CHOOSE_MS);
});

test('the choosing deadline picks a word for the drawer', () => {
  let state = onDeadline(drawing(), NOW, first);
  state = onDeadline(state, NOW, first);
  const choices = state.wordChoices;
  state = onDeadline(state, NOW + CHOOSE_MS, () => 0.99);
  assert.equal(state.phase, 'drawing');
  assert.equal(state.word, choices[2]);
  assert.deepEqual(state.lastMove, { type: 'autoChoose', playerNumber: 2 });
  assert.equal(state.gameStatus.includes(choices[2]), false);
});

test('each player draws drawsPerPlayer times, then the game ends', () => {
  let state = drawing();
  const drawers = [state.currentPlayer];
  while (!state.isGameOver) {
    state = onDeadline(state, NOW, first);
    if (state.lastMove?.type === 'nextTurn') drawers.push(state.lastMove.playerNumber);
    if (drawers.length === 9 && state.phase === 'reveal') state = { ...state, scores: { 1: 50, 2: 80, 3: 80 } };
  }
  assert.deepEqual(drawers, [1, 2, 3, 1, 2, 3, 1, 2, 3]);
  assert.deepEqual(state.draws, { 1: 3, 2: 3, 3: 3 });
  assert.deepEqual(state.winners, [2, 3]);
  assert.equal(state.gameStatus, 'Bob and Cara won with 80 points');
  assert.equal(state.currentPlayer, null);
  assert.equal(deadline(state), null);
});

test('guesserPoints is 100 at once, 10 at the buzzer, and in between scales with time left', () => {
  assert.equal(guesserPoints(90_000, 90_000), 100);
  assert.equal(guesserPoints(0, 90_000), 10);
  assert.equal(guesserPoints(45_000, 90_000), 55);
});

test('a correct guess scores for the guesser and the drawer, and the last one reveals the word', () => {
  let state = chat(drawing(), 2, 'is it a CASTLE?', NOW + 45_000);
  assert.deepEqual(state.guessed, [2]);
  assert.deepEqual(state.scores, { 1: DRAWER_POINTS, 2: 55, 3: 0 });
  assert.deepEqual(state.lastMove, { type: 'guess', playerNumber: 2, points: 55 });
  assert.equal(state.phase, 'drawing');
  state = chat(state, 3, 'castle', NOW + TURN_MS);
  assert.deepEqual(state.scores, { 1: 2 * DRAWER_POINTS, 2: 55, 3: 10 });
  assert.equal(state.phase, 'reveal');
  assert.deepEqual(state.lastMove, { type: 'reveal', word: 'castle', reason: 'allGuessed' });
});

test('only a correct first guess by a guesser while drawing is recorded', () => {
  const state = drawing();
  const say = (text: string) => ({ type: 'chat', text });
  assert.equal(recordsAction(state, 2, say('castle')), true);
  assert.equal(recordsAction(state, 2, say('catapult')), false);
  assert.equal(recordsAction(state, 1, say('castle')), false);
  assert.equal(recordsAction(chat(state, 2, 'castle'), 2, say('castle')), false);
  assert.equal(recordsAction(lobby(['Alice', 'Bob']), 2, say('castle')), false);
  assert.equal(recordsAction(state, 2, { type: 'chat', text: 5 }), false);
});

test('a wrong guess is a chat line and scores nothing', () => {
  const state = chat(drawing(), 2, 'a house');
  assert.deepEqual(state.guessed, []);
  assert.deepEqual(state.scores, { 1: 0, 2: 0, 3: 0 });
  assert.deepEqual(state.chat.at(-1), { id: state.chat.at(-1)?.id, kind: 'chat', seat: 2, text: 'a house', audience: 'all' });
});

test('the drawer leaving mid-turn reveals the word', () => {
  const state = removePlayer(pictionary, drawing(), 1, first);
  assert.equal(state.phase, 'reveal');
  assert.deepEqual(state.lastMove, { type: 'reveal', word: 'castle', reason: 'drawerLeft' });
  assert.equal(onDeadline(state, NOW, first).currentPlayer, 2);
});

test('a guesser leaving when everyone left has guessed ends the drawing at once, with the reveal timed from then', () => {
  const left = removePlayer(pictionary, chat(drawing(), 2, 'castle'), 3, first);
  assert.equal(left.phase, 'drawing');
  assert.ok((deadline(left) ?? Infinity) <= NOW);
  const state = onDeadline(left, NOW + 7_000, first);
  assert.equal(state.phase, 'reveal');
  assert.equal(state.phaseStartedAt, NOW + 7_000);
  assert.deepEqual(state.lastMove, { type: 'reveal', word: 'castle', reason: 'allGuessed' });
  assert.equal(removePlayer(pictionary, drawing(['A', 'B', 'C', 'D']), 3, first).phaseStartedAt, NOW);
});

test('a drawing deadline after the drawer left reveals with the drawerLeft reason', () => {
  const state = onDeadline({ ...drawing(), activePlayers: [2, 3] }, NOW + 7_000, first);
  assert.deepEqual(state.lastMove, { type: 'reveal', word: 'castle', reason: 'drawerLeft' });
});

test('resumeClock gives the current phase its full time', () => {
  const state = resumeClock(drawing(), NOW + 5_000);
  assert.equal(state.phaseStartedAt, NOW + 5_000);
  assert.equal(deadline(state), NOW + 5_000 + TURN_MS);
  assert.equal(resumeClock(lobby(['Alice', 'Bob']), NOW).phaseStartedAt, null);
});

test('no deadline in the lobby', () => {
  assert.equal(deadline(lobby(['Alice', 'Bob'])), null);
});
