import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, fileOf, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { codebreaker } from './index.ts';
import type { Color, GameState, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';
import { seeded } from '../testStates.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'codebreaker/g1';
const CODE: Color[] = ['red', 'blue', 'green', 'yellow'];
const WRONG: Color[] = ['purple', 'purple', 'purple', 'purple'];

// Seats `names` in `mode` (the seat count's standard when omitted) and agrees to the house rules
function gameWith(names: string[], mode?: string): Manager {
  const manager = rememberingKeys(createGameManager([codebreaker], seeded(42)));
  for (const name of names) manager.join('codebreaker', 'g1', name);
  if (mode) ok(manager.setHouseRules(ROOM, 1, { values: { mode }, maxPlayers: null }));
  agreeAll(manager, ROOM);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to this game's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

const raw = (manager: Manager): GameState => manager.rawState(ROOM) as unknown as GameState;
// A guess sure to miss: every peg differs from the code's
const miss = (manager: Manager): Color[] => (raw(manager).code as Color[]).map(peg => peg === 'red' ? 'blue' : 'red');
const shows = (view: unknown, code: Color[]): boolean => JSON.stringify(view).includes(JSON.stringify(code));

test('a Classic game plays four rounds to a winner', () => {
  const manager = gameWith(['A', 'B']);
  assert.equal(raw(manager).maker, 1);
  // Seat 2 breaks in one guess each round, seat 1 in two
  for (const [maker, breaker, misses] of [[1, 2, 0], [2, 1, 1], [1, 2, 0], [2, 1, 1]] as const) {
    ok(manager.move(ROOM, maker, { type: 'setCode', pegs: CODE }));
    for (let i = 0; i < misses; i++) ok(manager.move(ROOM, breaker, { type: 'guess', pegs: WRONG }));
    const ended = ok(manager.move(ROOM, breaker, { type: 'guess', pegs: CODE }));
    assert.equal(ended.phase, 'summary');
    ok(manager.action(ROOM, 1, { type: 'continue' }));
    ok(manager.action(ROOM, 2, { type: 'continue' }));
  }
  const over = manager.getState(ROOM) as PublicGameState;
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [2]);
  assert.deepEqual(over.standings, [{ seat: 2, place: 1, score: '2 points' }, { seat: 1, place: 2, score: '4 points' }]);
});

test('no history step or view shows a Classic code to the breaker before the reveal', () => {
  const manager = gameWith(['A', 'B']);
  ok(manager.move(ROOM, 1, { type: 'setCode', pegs: CODE }));
  ok(manager.move(ROOM, 2, { type: 'guess', pegs: WRONG }));
  ok(manager.move(ROOM, 2, { type: 'guess', pegs: ['red', 'red', 'red', 'red'] }));
  const steps = stepsOf(manager, 'codebreaker');
  assert.ok(steps && steps.length >= 3);
  for (const step of steps) {
    assert.equal((step as unknown as PublicGameState).code, null);
    assert.ok(!shows(step, CODE));
  }
  assert.equal((manager.getState(ROOM, 2) as PublicGameState).code, null);
  assert.ok(!shows(manager.getState(ROOM, 2), CODE));
  assert.ok(!shows(manager.getState(ROOM, null), CODE));
  assert.deepEqual((manager.getState(ROOM, 1) as PublicGameState).code, CODE);
  assert.ok('error' in fileOf(manager, 'codebreaker', new Date()));
});

test('Together guesses from two seats are both recorded and never refused as stale', () => {
  const manager = gameWith(['A', 'B', 'C'], 'together');
  const before = stepsOf(manager, 'codebreaker')?.length ?? 0;
  const pegs = miss(manager);
  ok(manager.action(ROOM, 1, { type: 'guess', pegs }));
  const both = ok(manager.action(ROOM, 2, { type: 'guess', pegs }));
  assert.equal(both.board.guesses.length, 2);
  assert.equal(stepsOf(manager, 'codebreaker')?.length, before + 2);
  const undone = ok(manager.undoOwn(ROOM, 1));
  assert.deepEqual(undone.board.guesses.map(g => g.by), [2]);
  assert.equal(stepsOf(manager, 'codebreaker')?.length, before + 3);
  assert.ok('error' in manager.requestUndo(ROOM, 1), 'no undo vote in Together');
});

test('Race: the history never shows another board during play', () => {
  const manager = gameWith(['A', 'B'], 'race');
  const pegs = miss(manager);
  ok(manager.action(ROOM, 1, { type: 'guess', pegs }));
  ok(manager.action(ROOM, 2, { type: 'guess', pegs }));
  const mine = ok(manager.action(ROOM, 1, { type: 'guess', pegs }));
  assert.deepEqual(Object.keys(mine.boards), ['1']);
  assert.deepEqual(mine.guessesUsed, { 1: 2, 2: 1 });
  const steps = stepsOf(manager, 'codebreaker') ?? [];
  assert.ok(steps.length >= 3);
  for (const step of steps) {
    assert.ok(!step.isGameOver);
    assert.deepEqual((step as unknown as PublicGameState).boards, {});
    assert.equal((step as unknown as PublicGameState).code, null);
  }
});

test('Solo: one player starts, plays and undoes at once', () => {
  const manager = gameWith(['A']);
  assert.equal(raw(manager).houseRules?.values.mode, 'solo');
  const guessed = ok(manager.move(ROOM, 1, { type: 'guess', pegs: miss(manager) }));
  assert.equal(guessed.board.guesses.length, 1);
  assert.equal(guessed.code, null);
  const undone = ok(manager.requestUndo(ROOM, 1));
  assert.equal(undone.undoVote, null);
  assert.deepEqual(undone.board.guesses, []);
});
