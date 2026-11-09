import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { guessGame } from './turns.ts';
import { baseGameState } from '../seating.ts';
import type { ChoiceRule } from '../houseRules.ts';
import type { Result } from '../types.ts';
import type { GuessState } from './types.ts';

// The house rules a drawing game would pass in, kept here so this folder imports no game
const choiceRule = (id: string, standard: number, values: number[]): ChoiceRule<number> =>
  ({ id, label: id, kind: 'choice', standard, choices: values.map(value => ({ value, label: String(value) })) });
const TURN_SECONDS = choiceRule('turnSeconds', 90, [30, 60, 90, 120, 180]);
const CHOICES = choiceRule('wordChoices', 3, [3, 4, 5]);
const TURNS = choiceRule('drawsPerPlayer', 3, [1, 2, 3, 4, 5]);

type TestState = GuessState & { marker: number };
const NOW = 1_000_000;
const first = () => 0;

const game = guessGame<TestState>({
  words: ['juggling flamingos', 'knitting a scarf', 'walking on stilts'],
  turnSeconds: TURN_SECONDS, choices: CHOICES, turnsPerPlayer: TURNS,
  noun: 'prompt', verb: 'acting',
  freshTurn: () => ({ marker: 0 })
});

function ok(result: Result<TestState>): TestState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Alice (seat 1) about to choose from the three prompts, Bob guessing
function lobby(): TestState {
  const state: TestState = {
    ...baseGameState('g'), ...game.guessFields(), marker: 5,
    activePlayers: [1, 2], playerNames: { 1: 'Alice', 2: 'Bob' }, currentPlayer: 1
  };
  return { ...game.resetLobby(state, first), wordChoices: ['juggling flamingos', 'knitting a scarf', 'walking on stilts'], marker: 5 };
}

test('texts use the noun and verb', () => {
  const state = lobby();
  assert.deepEqual(game.applyMove(state, 1, { type: 'choose', index: 7 }, first, NOW), { error: 'Invalid prompt choice' });
  assert.deepEqual(game.applyMove(state, 2, { type: 'choose', index: 0 }, first, NOW),
    { error: 'You can choose a prompt only at the start of your turn' });
  const acting = ok(game.applyMove(state, 1, { type: 'choose', index: 0 }, first, NOW));
  assert.equal(acting.gameStatus, 'Alice is acting');
  const guessed = ok(game.chatAction(acting, 2, { type: 'chat', text: 'juggling flamingos' }, NOW + 1000));
  assert.ok(guessed.chat.some(line => line.text === 'Bob guessed the prompt!'));
  assert.equal(guessed.gameStatus, 'The prompt was juggling flamingos');
  // Bob's turn runs out twice over, then Alice chooses again
  const bobChoosing = game.onDeadline(guessed, NOW + 2000, first);
  assert.equal(bobChoosing.gameStatus, 'Bob is choosing a prompt');
  const bobActing = game.onDeadline(bobChoosing, NOW + 3000, first);
  assert.equal(bobActing.gameStatus, 'Bob ran out of time, so a prompt was chosen for them');
  const aliceChoosing = game.onDeadline(game.onDeadline(bobActing, NOW + 4000, first), NOW + 5000, first);
  assert.equal(aliceChoosing.gameStatus, 'Alice is choosing a prompt');
});

test('freshTurn runs when guessing starts', () => {
  const state = lobby();
  assert.equal(state.marker, 5);
  assert.equal(ok(game.applyMove(state, 1, { type: 'choose', index: 0 }, first, NOW)).marker, 0);
});

test('the module imports no game folder and names no commercial game', () => {
  const dir = import.meta.dirname;
  for (const file of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const imports = text.split('\n').filter(line => /^\s*(import|export) .* from /.test(line));
    for (const line of imports) assert.doesNotMatch(line, /(pict[i]onary|charades)\//, file);
    // Spelled in pieces so this file does not match itself
    assert.doesNotMatch(text, new RegExp(`${'pict'}ionary|${'balder'}dash`, 'i'), file);
  }
});
