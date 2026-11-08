import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hintgrid } from './index.ts';
import { privateSeatView, spectatorState, toPublicState } from './rules.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import { spectatorView } from '../../shared/spectators.ts';
import type { GameState } from './types.ts';

const first = () => 0;
const EVE = { id: 's1', name: 'Eve', tableScreen: false, allowedSeats: [] };

// Alice and Bob are red (clue-giver, guesser), Cara and Dan blue; cards 0 and 1 are face up
function guessing(): GameState {
  let state = hintgrid.createGameState('g');
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan']) {
    const added = addPlayer(hintgrid, state, name, first);
    if ('error' in added) assert.fail(added.error);
    state = added.state;
  }
  return {
    ...state, started: true, phase: 'guessing', turn: 'red', currentPlayer: 2,
    roles: { 1: { team: 'red', clueGiver: true }, 2: { team: 'red', clueGiver: false }, 3: { team: 'blue', clueGiver: true }, 4: { team: 'blue', clueGiver: false } },
    revealed: state.key.map((_, i) => i < 2)
  };
}

const faceUpOnly = (state: GameState, key: unknown[]) => key.every((entry, i) => entry === (state.revealed[i] ? state.key[i] : null));

test('a guesser and History see only face-up cards', () => {
  const state = guessing();
  assert.equal(state.key.length, 25);
  for (const viewer of [2, 4, null]) assert.ok(faceUpOnly(state, toPublicState(state, false, viewer).key), `viewer ${viewer}`);
});

test('clue-givers see the whole key', () => {
  const state = guessing();
  for (const viewer of [1, 3]) assert.deepEqual(toPublicState(state, false, viewer).key, state.key);
});

test('a spectator sees the key, a table screen does not', () => {
  const state = guessing();
  assert.deepEqual((spectatorView(hintgrid, state, EVE) as { key: unknown }).key, state.key);
  const screen = spectatorView(hintgrid, state, { ...EVE, tableScreen: true }) as { key: unknown[] };
  assert.ok(faceUpOnly(state, screen.key));
  assert.deepEqual(spectatorState(state, false, true), toPublicState(state, false, null));
});

test('everyone sees the key once the game is over', () => {
  const state = { ...guessing(), isGameOver: true };
  for (const viewer of [2, 4, null]) assert.deepEqual(toPublicState(state, false, viewer).key, state.key);
});

test('the null view plus privateSeatView is the seat view', () => {
  const state = guessing();
  for (const seat of [1, 2, 3, 4]) {
    assert.deepEqual({ ...toPublicState(state, false, null), ...privateSeatView(state, seat) }, toPublicState(state, false, seat));
  }
  assert.deepEqual(privateSeatView(state, 2), {});
});

test('left counts face-down words per team', () => {
  const state = guessing();
  const down = (team: string) => state.key.filter((kind, i) => kind === team && !state.revealed[i]).length;
  assert.deepEqual(toPublicState(state, false, null).left, { red: down('red'), blue: down('blue') });
});

test("lastMove and gameStatus never name a face-down card's kind", () => {
  const base = guessing();
  let state: GameState = { ...base, phase: 'clue', turn: 'red', currentPlayer: 1, revealed: base.key.map(() => false), clue: null, guessesLeft: 0 };
  const at = (kind: string, skip = -1) => state.key.findIndex((k, i) => k === kind && i !== skip);
  const red = at('red');
  const bystander = at('bystander');
  const blue = at('blue');
  const steps: [number, object][] = [
    [1, { type: 'clue', word: 'zzzz', count: 2 }], [2, { type: 'guess', index: red }], [2, { type: 'guess', index: bystander }],
    [3, { type: 'clue', word: 'yyyy', count: 1 }], [4, { type: 'guess', index: blue }]
  ];
  for (const [seat, move] of steps) {
    const result = applyMove(hintgrid, state, seat, move, first);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
    const { lastMove, gameStatus } = toPublicState(state, false, null);
    if (lastMove?.type === 'guess') assert.ok(state.revealed[lastMove.index], 'lastMove names a face-down card');
    const text = JSON.stringify(lastMove) + gameStatus;
    state.words.forEach((word, i) => assert.ok(state.revealed[i] || !text.includes(word), `names the face-down word ${word}`));
    assert.ok(!/trap/.test(text) && (state.revealed[bystander] || !/bystander/.test(text)));
  }
  assert.equal(state.turn, 'blue');
});
