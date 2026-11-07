import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { hintgrid } from './index.ts';
import type { GameState, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';
import { seeded } from '../testStates.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'hintgrid/g1';

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

// Alice and Bob are red (clue-giver, guesser), Cara and Dan blue
function started(): Manager {
  const manager = rememberingKeys(createGameManager([hintgrid], seeded(42)));
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan']) manager.join('hintgrid', 'g1', name);
  agreeAll(manager, ROOM);
  ok(manager.action(ROOM, 1, { type: 'pickRole', team: 'red', clueGiver: true }));
  ok(manager.action(ROOM, 2, { type: 'pickRole', team: 'red', clueGiver: false }));
  ok(manager.action(ROOM, 3, { type: 'pickRole', team: 'blue', clueGiver: true }));
  ok(manager.action(ROOM, 4, { type: 'pickRole', team: 'blue', clueGiver: false }));
  return manager;
}

const steps = (manager: Manager) => stepsOf(manager, 'hintgrid') ?? [];
const keyOf = (view: unknown) => (view as PublicGameState).key;

// The starting team's clue-giver clues, then its guesser turns over two of its own words
function twoGuesses(manager: Manager) {
  const state = manager.rawState(ROOM) as unknown as GameState;
  const [giver, guesser] = state.startingTeam === 'red' ? [1, 2] : [3, 4];
  const own = state.key.flatMap((kind, i) => (kind === state.startingTeam ? [i] : []));
  ok(manager.move(ROOM, giver, { type: 'clue', word: 'zzzz', count: 3 }));
  ok(manager.move(ROOM, guesser, { type: 'guess', index: own[0] }));
  ok(manager.move(ROOM, guesser, { type: 'guess', index: own[1] }));
  return { guesser, index: own[1] };
}

test('a clue and two guesses are history steps and the picks are not', () => {
  const manager = started();
  const before = steps(manager).length;
  twoGuesses(manager);
  assert.equal(steps(manager).length, before + 3);
});

test('an approved undo turns a guessed card face down again', () => {
  const manager = started();
  const { guesser, index } = twoGuesses(manager);
  ok(manager.requestUndo(ROOM, guesser));
  for (const seat of [1, 2, 3, 4].filter(s => s !== guesser)) manager.voteUndo(ROOM, seat, true);
  assert.equal((manager.rawState(ROOM) as unknown as GameState).revealed[index], false);
  const other = guesser === 2 ? 4 : 2;
  assert.equal(keyOf(manager.getState(ROOM, other))[index], null);
  assert.equal(keyOf(manager.getState(ROOM, null))[index], null);
});

test("no history step shows a face-down card's kind", () => {
  const manager = started();
  twoGuesses(manager);
  const state = manager.rawState(ROOM) as unknown as GameState;
  for (const step of steps(manager)) {
    const key = keyOf(step);
    assert.ok(key.every((entry, i) => entry === null || state.revealed[i]), 'a face-down card is named');
  }
});
