import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charades } from './index.ts';
import { applyAction, createGameState, onDeadline } from './rules.ts';
import { PROMPTS } from './prompts.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import { spectatorView } from '../../shared/spectators.ts';
import { withRules } from '../../server/testing.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import type { Result, Seat } from '../../shared/types.ts';
import type { GameState } from './types.ts';

const NOW = 1_000_000;
const first = () => 0;

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function lobby(values: HouseRuleValues = {}): GameState {
  let state: GameState = { ...createGameState('g'), houseRules: withRules(values) };
  for (const name of ['Alice', 'Bob', 'Cara']) state = ok(addPlayer(charades, state, name, first));
  return state;
}

// Alice (seat 1) acting "juggling flamingos" from NOW, with Bob and Cara guessing
function acting(values: HouseRuleValues = {}): GameState {
  const state = { ...lobby(values), wordChoices: ['juggling flamingos', 'knitting a scarf', 'walking on stilts'] };
  return ok(applyMove(charades, state, 1, { type: 'choose', index: 0 }, first, NOW));
}

const chat = (state: GameState, seat: Seat, text: string) => ok(applyAction(state, seat, { type: 'chat', text }, first, NOW));

test('the actor is offered promptChoices prompts', () => {
  const state = lobby({ promptChoices: 5 });
  assert.equal(state.wordChoices.length, 5);
  assert.equal(new Set(state.wordChoices).size, 5);
  for (const prompt of state.wordChoices) assert.ok(PROMPTS.includes(prompt), prompt);
});

test('a multi-word prompt is guessed by its words in order, with any spacing or hyphens', () => {
  const state = chat(chat(acting(), 2, 'is it Juggling-Flamingos?'), 3, 'flamingos juggling');
  assert.deepEqual(state.guessed, [2]);
});

test('the actor cannot score by typing the prompt', () => {
  const state = chat(acting(), 1, 'juggling flamingos');
  assert.deepEqual(state.guessed, []);
  const line = state.chat.at(-1);
  assert.equal(line?.kind, 'chat');
  assert.equal(line?.audience, 'guessed');
});

test('each player acts turnsPerPlayer times, then the highest score wins', () => {
  let state = chat(acting({ turnsPerPlayer: 1 }), 2, 'juggling flamingos');
  const actors = [state.drawer];
  for (let i = 0; i < 20 && !state.isGameOver; i++) {
    state = onDeadline(state, NOW, first);
    if (state.lastMove?.type === 'nextTurn') actors.push(state.lastMove.playerNumber);
  }
  assert.equal(state.isGameOver, true);
  assert.deepEqual(actors, [1, 2, 3]);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.gameStatus, `Bob won with ${state.scores[2]} points`);
});

test('a guesser and History never see the prompt before the reveal; a spectator does, a table screen does not', () => {
  const state = acting();
  const eve = { id: 's', name: 'Eve', tableScreen: false, allowedSeats: [] };
  for (const view of [charades.toPublicState(state, false, 2), charades.toPublicState(state, false, null), spectatorView(charades, state, { ...eve, tableScreen: true })]) {
    assert.equal(JSON.stringify(view).includes('juggling'), false);
  }
  assert.ok(JSON.stringify(spectatorView(charades, state, eve)).includes('juggling'));
});

test('any action but chat is refused', () => {
  assert.deepEqual(applyAction(acting(), 1, { type: 'stroke' }, first, NOW), { error: 'Invalid action' });
});
