import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictionary } from './index.ts';
import { applyAction, createGameState, finalStandings, onDeadline, privateSeatView, spectatorState, toPublicState } from './rules.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import { withRules } from '../../server/testing.ts';
import type { Result, Seat } from '../../shared/types.ts';
import type { GameState } from './types.ts';

const NOW = 1_000_000;
const WORDS = ['xylophone', 'quokka', 'zeppelin'];
const first = () => 0;

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Alice (seat 1) choosing from the distinctive words, with Bob, Cara and Dan guessing
function choosing(): GameState {
  let state: GameState = { ...createGameState('g'), houseRules: withRules({}) };
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan']) state = ok(addPlayer(pictionary, state, name, first));
  return { ...state, wordChoices: [...WORDS], deck: [...WORDS] };
}

// Alice drawing "xylophone" from NOW
const drawing = () => ok(applyMove(pictionary, choosing(), 1, { type: 'choose', index: 0 }, first, NOW));
const say = (state: GameState, seat: Seat, text: string) => applyAction(state, seat, { type: 'chat', text }, first, NOW + 1_000);
const chat = (state: GameState, seat: Seat, text: string) => ok(say(state, seat, text));
const texts = (view: { chat: { text: string }[] }) => view.chat.map(line => line.text);

test('a guesser never receives the word, the choices or the deck in any phase', () => {
  for (const state of [choosing(), drawing(), chat(drawing(), 3, 'xylophone')]) {
    const view = toPublicState(state, false, 2);
    const json = JSON.stringify(view);
    for (const word of WORDS) assert.equal(json.includes(word), false, `${state.phase} leaks ${word}`);
    assert.equal('deck' in view, false);
  }
});

test('the drawer sees the choices, then the word', () => {
  assert.deepEqual(toPublicState(choosing(), false, 1).wordChoices, WORDS);
  const view = toPublicState(drawing(), false, 1);
  assert.equal(view.word, 'xylophone');
  assert.deepEqual(view.wordChoices, []);
});

test('a guesser sees the word after guessing it', () => {
  assert.equal(toPublicState(chat(drawing(), 2, 'xylophone'), false, 2).word, 'xylophone');
});

test('the history view hides the word until the reveal', () => {
  const view = toPublicState(drawing(), false, null);
  assert.equal(view.word, null);
  assert.equal(view.mask, '_________');
  assert.equal(toPublicState(onDeadline(drawing(), NOW + 90_000, first), false, null).word, 'xylophone');
});

test('a correct guess shows as "<name> guessed the word!" and never as the guess', () => {
  const state = chat(drawing(), 2, 'is it a Xylophone?');
  assert.equal(state.chat.at(-1)?.text, 'Bob guessed the word!');
  assert.equal(state.chat.at(-1)?.kind, 'guessed');
  assert.equal(state.chat.at(-1)?.audience, 'all');
  assert.equal(state.chat.some(line => line.text === 'is it a Xylophone?'), false);
  assert.equal(state.lastMove?.type, 'guess');
});

test('a near guess shows "So close!" only to the guesser', () => {
  const state = chat(drawing(), 2, 'xylophon');
  const own = toPublicState(state, false, 2).chat;
  assert.equal(own.at(-1)?.kind, 'close');
  assert.ok(own.at(-1)?.text.includes('xylophon'));
  assert.ok(own.at(-1)?.text.includes('So close!'));
  for (const view of [toPublicState(state, false, 3), toPublicState(state, false, null), spectatorState(state, false, false)]) {
    assert.equal(view.chat.some(line => line.kind === 'close'), false);
    assert.equal(texts(view).some(text => text.includes('xylophon')), false);
  }
});

test('guessed players chat only among themselves', () => {
  const state = chat(chat(drawing(), 2, 'xylophone'), 2, 'nice one');
  assert.equal(state.chat.at(-1)?.audience, 'guessed');
  for (const view of [toPublicState(state, false, 1), toPublicState(state, false, 2), spectatorState(state, false, false)]) {
    assert.ok(texts(view).includes('nice one'));
  }
  for (const view of [toPublicState(state, false, 3), toPublicState(state, false, null)]) {
    assert.equal(texts(view).includes('nice one'), false);
  }
});

test('the drawer chats only with those who guessed while drawing, and with everyone otherwise', () => {
  assert.equal(chat(drawing(), 1, 'hint').chat.at(-1)?.audience, 'guessed');
  assert.equal(chat(choosing(), 2, 'hello').chat.at(-1)?.audience, 'all');
  assert.equal(chat(onDeadline(drawing(), NOW + 90_000, first), 1, 'gg').chat.at(-1)?.audience, 'all');
  assert.equal(chat(drawing(), 3, 'a piano').chat.at(-1)?.audience, 'all');
});

test('the reveal opens the guessed-only chat to everyone', () => {
  const state = onDeadline(chat(chat(drawing(), 2, 'xylophone'), 2, 'nice one'), NOW + 90_000, first);
  assert.equal(state.chat.some(line => line.audience === 'guessed'), false);
  assert.ok(texts(toPublicState(state, false, null)).includes('nice one'));
});

test('lastMove and gameStatus never carry the word before the reveal', () => {
  for (const state of [drawing(), chat(drawing(), 2, 'xylophone'), onDeadline(choosing(), NOW, first)]) {
    assert.equal(JSON.stringify([state.lastMove, state.gameStatus]).includes('xylophone'), false);
  }
});

test('a spectator sees the word and the guessed chat; a table screen sees only the blanks', () => {
  const state = chat(chat(drawing(), 2, 'xylophone'), 1, 'well done');
  const spectator = spectatorState(state, false, false);
  assert.equal(spectator.word, 'xylophone');
  assert.ok(texts(spectator).includes('well done'));
  assert.deepEqual(spectatorState(choosing(), false, false).wordChoices, WORDS);
  const screen = spectatorState(state, true, true);
  assert.deepEqual(screen, toPublicState(state, true, null));
  assert.equal(screen.word, null);
  assert.equal(screen.mask, '_________');
});

// Before any chat; once there is chat, `chat` is the seat's whole chat, so laying it over the null view gives the seat's view
test('privateSeatView of a guesser who has not guessed is empty', () => {
  assert.deepEqual(privateSeatView(drawing(), 2), { word: null, wordChoices: [], chat: [] });
  assert.equal(privateSeatView(drawing(), 1).word, 'xylophone');
});

test('the null view plus privateSeatView is the seat view', () => {
  const state = chat(chat(chat(chat(drawing(), 3, 'a piano'), 2, 'xylophon'), 4, 'xylophone'), 4, 'easy');
  for (const seat of [1, 2, 3, 4]) {
    assert.deepEqual({ ...toPublicState(state, false, null), ...privateSeatView(state, seat) }, toPublicState(state, false, seat));
  }
  assert.deepEqual(texts(privateSeatView(state, 2)), ['a piano', 'xylophon: So close!', 'Dan guessed the word!']);
});

test('finalStandings shares a place between equal scores', () => {
  const state = { ...drawing(), activePlayers: [1, 2, 3], scores: { 1: 40, 2: 100, 3: 100 } };
  assert.deepEqual(finalStandings(state), [
    { seat: 2, place: 1, score: '100 points' },
    { seat: 3, place: 1, score: '100 points' },
    { seat: 1, place: 3, score: '40 points' }
  ]);
});

test('chat keeps the last 200 lines', () => {
  let state = choosing();
  for (let i = 1; i <= 205; i++) state = chat(state, 2, `line ${i}`);
  assert.equal(state.chat.length, 200);
  assert.equal(state.chat[0].text, 'line 6');
  assert.equal(state.chat.at(-1)?.text, 'line 205');
});

test('an empty or 101-character message is refused', () => {
  for (const text of ['   ', 'a'.repeat(101)]) {
    assert.deepEqual(say(drawing(), 2, text), { error: 'Messages are 1 to 100 characters' });
  }
  assert.equal(chat(drawing(), 2, 'a'.repeat(100)).chat.length, 1);
});
