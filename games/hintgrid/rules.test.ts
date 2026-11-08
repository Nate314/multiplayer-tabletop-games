import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, applyMove as platformMove, removePlayer } from '../../shared/seating.ts';
import type { Seat } from '../../shared/types.ts';
import { hintgrid as game } from './index.ts';
import { applyAction, createGameState, finalStandings } from './rules.ts';
import type { CardKind, GameState, Team } from './types.ts';

const names = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn'];

function seat(state: GameState, count: number): GameState {
  for (const name of names.slice(0, count)) {
    const added = addPlayer(game, state, name, () => 0.3);
    if ('error' in added) assert.fail(added.error);
    state = added.state;
  }
  return state;
}

function pick(state: GameState, who: Seat, team: Team, clueGiver: boolean): GameState {
  const result = applyAction(state, who, { type: 'pickRole', team, clueGiver }, () => 0.3);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function ready(): GameState {
  let state = seat(createGameState('g'), 4);
  state = pick(pick(pick(pick(state, 1, 'red', true), 2, 'red', false), 3, 'blue', true), 4, 'blue', false);
  const key: CardKind[] = ['red', 'red', 'bystander', 'blue', 'trap'];
  const rest: CardKind[] = [...Array<CardKind>(7).fill('red'), ...Array<CardKind>(7).fill('blue'), ...Array<CardKind>(6).fill('bystander')];
  return { ...state, words: ['ocean', 'whale', 'anchor', ...state.words.slice(3)], key: [...key, ...rest], startingTeam: 'red', turn: 'red' };
}

const move = (state: GameState, who: Seat, m: object): GameState => {
  const result = platformMove(game, state, who, m);
  if ('error' in result) assert.fail(result.error);
  return result.state;
};
const clued = (state = ready()): GameState => move(state, 1, { type: 'clue', word: 'sea', count: 1 });

test('the lobby has no current player until the teams are ready', () => {
  let state = seat(createGameState('g'), 4);
  state = pick(pick(pick(state, 1, 'red', true), 2, 'red', false), 3, 'blue', true);
  assert.equal(state.currentPlayer, null);
  state = pick(state, 4, 'blue', false);
  assert.equal(state.currentPlayer, 1);
  const more = addPlayer(game, state, 'Eve', () => 0.3);
  if ('error' in more) assert.fail(more.error);
  assert.equal(Object.keys(more.state.roles).length, 4);
  assert.equal(more.state.currentPlayer, null);
});

test('a second clue-giver on one team is refused', () => {
  const state = pick(seat(createGameState('g'), 4), 1, 'red', true);
  assert.deepEqual(applyAction(state, 2, { type: 'pickRole', team: 'red', clueGiver: true }, () => 0.3), { error: 'Red already has a clue-giver' });
});

test('a clue-giver who steps down gets a new grid and key, other picks keep it', () => {
  const state = pick(seat(createGameState('g'), 4), 1, 'red', true);
  const same = pick(state, 2, 'red', false);
  assert.deepEqual(same.words, state.words);
  const after = applyAction(state, 1, { type: 'pickRole', team: 'red', clueGiver: false }, () => 0.9);
  if ('error' in after) assert.fail(after.error);
  assert.notDeepEqual(after.state.words, state.words);
  assert.notDeepEqual(after.state.key, state.key);
  const evened = applyAction(state, 1, { type: 'evenOut' }, () => 0.9);
  if ('error' in evened) assert.fail(evened.error);
  assert.deepEqual(evened.state.words, state.words);
});

test('role picks are refused once the game has started', () => {
  const state = clued();
  assert.deepEqual(applyAction(state, 2, { type: 'pickRole', team: 'blue', clueGiver: false }, () => 0.3), { error: 'Teams are set once the game starts' });
  assert.deepEqual(applyAction(state, 2, { type: 'evenOut' }, () => 0.3), { error: 'Teams are set once the game starts' });
});

test('a clue that is a grid word is refused, whatever its case, and other words are taken', () => {
  const state = ready();
  const clue = (word: string, count = 1) => platformMove(game, state, 1, { type: 'clue', word, count });
  assert.deepEqual(clue('Ocean'), { error: 'Your clue is a word on the grid' });
  assert.ok('state' in clue('oceans'));
  assert.ok('state' in clue('sea'));
  assert.deepEqual(clue('ice cream'), { error: 'Give one word' });
  assert.deepEqual(clue('sea', 0), { error: 'The number is 1 to 9' });
  assert.deepEqual(clue('sea', 10), { error: 'The number is 1 to 9' });
});

test("only the team's guessers may guess, and only after the clue", () => {
  const state = ready();
  assert.deepEqual(platformMove(game, state, 2, { type: 'guess', index: 0 }), { error: 'Not your turn' });
  const after = clued(state);
  assert.deepEqual(platformMove(game, after, 1, { type: 'guess', index: 0 }), { error: 'Not your turn' });
  assert.deepEqual(platformMove(game, after, 4, { type: 'guess', index: 0 }), { error: 'Not your turn' });
});

test('a team word lets the team guess on, up to the number plus one', () => {
  let state = move(clued(), 2, { type: 'guess', index: 0 });
  assert.equal(state.phase, 'guessing');
  assert.equal(state.guessesLeft, 1);
  state = move(state, 2, { type: 'guess', index: 1 });
  assert.equal(state.turn, 'blue');
  assert.equal(state.phase, 'clue');
  assert.equal(state.currentPlayer, 3);
});

test("a bystander or the other team's word ends the turn", () => {
  for (const index of [2, 3]) {
    const state = move(clued(), 2, { type: 'guess', index });
    assert.equal(state.turn, 'blue');
    assert.equal(state.currentPlayer, 3);
  }
});

test('End guessing needs a guess first', () => {
  const state = clued();
  assert.deepEqual(platformMove(game, state, 2, { type: 'endGuessing' }), { error: 'Make at least one guess first' });
  const ended = move(move(state, 2, { type: 'guess', index: 0 }), 2, { type: 'endGuessing' });
  assert.equal(ended.turn, 'blue');
});

test('the trap loses at once', () => {
  const state = move(clued(), 2, { type: 'guess', index: 4 });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [3, 4]);
  assert.equal(state.gameStatus, 'Red turned over the trap. Blue wins!');
});

test("turning over the other team's last word wins it for them", () => {
  const base = clued();
  const revealed = base.key.map((kind, i) => kind === 'blue' && i !== 3);
  const state = move({ ...base, revealed }, 2, { type: 'guess', index: 3 });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [3, 4]);
  assert.equal(state.gameStatus, 'Blue found all its words!');
});

test('a dismissed clue-giver ends the game with the team with fewer words left winning', () => {
  let state = seat(createGameState('g'), 6);
  const roles: [Seat, Team, boolean][] = [[1, 'red', true], [2, 'red', false], [3, 'red', false], [4, 'blue', true], [5, 'blue', false], [6, 'blue', false]];
  for (const [who, team, clueGiver] of roles) state = pick(state, who, team, clueGiver);
  const key: CardKind[] = [...Array<CardKind>(9).fill('red'), ...Array<CardKind>(8).fill('blue'), ...Array<CardKind>(7).fill('bystander'), 'trap'];
  // Red has 4 of 9 turned over (5 left); Blue has 5 of 8 (3 left)
  const started = { ...state, key, started: true, revealed: key.map((kind, i) => (kind === 'red' && i < 4) || (kind === 'blue' && i >= 9 && i < 14)) };
  const dismissed = removePlayer(game, started, 1);
  assert.equal(dismissed.isGameOver, true);
  assert.deepEqual(dismissed.winners, [4, 5, 6]);
  const level = key.map((kind, i) => (kind === 'red' && i < 6) || (kind === 'blue' && i >= 9 && i < 14));
  const tie = removePlayer(game, { ...started, revealed: level }, 1);
  assert.deepEqual(tie.winners, []);
  assert.equal(tie.gameStatus, 'Not enough players left: a draw');
});

test("standings list the winning team's players first", () => {
  const state = move(clued(), 2, { type: 'guess', index: 4 });
  assert.deepEqual(finalStandings(state).map(row => [row.seat, row.place, row.score]), [
    [3, 1, 'Blue team'], [4, 1, 'Blue team'], [1, 2, 'Red team'], [2, 2, 'Red team']
  ]);
});
