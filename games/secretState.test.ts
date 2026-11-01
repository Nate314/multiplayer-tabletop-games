import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GAMES } from './registry.ts';
import { dealt } from './testStates.ts';

const WITH_SECRET = [
  'azul', 'carcassonne', 'catan', 'dominoes', 'euchre', 'gofish', 'holdem', 'jenga', 'monopoly', 'phase10', 'pictionary',
  'racko', 'risk', 'rook', 'rummikub', 'scrabble', 'skipbo', 'splendor', 'sudoku', 'thecrew', 'tickettoride', 'uno', 'war'
];

const isEmpty = (value: unknown) => Array.isArray(value) ? value.length === 0
  : value !== null && typeof value === 'object' ? Object.keys(value).length === 0 : false;

it('exactly the games with a secret declare one', () => {
  assert.deepEqual(GAMES.filter(g => g.secretState).map(g => g.info.id).sort(), [...WITH_SECRET].sort());
});

it('thecrew hides the face-down tasks of a distribution', () => {
  const crew = GAMES.find(g => g.info.id === 'thecrew')!;
  const state = dealt(crew);
  const tasks = [{ card: { suit: 'blue', value: 1 } }, { card: { suit: 'pink', value: 2 } }, { card: { suit: 'green', value: 3 } }]
    .map(t => ({ ...t, token: null, owner: null, done: false }));
  const distributing = { ...state, phase: 'distribute', tasks };
  const hidden = crew.secretState!(distributing) as { tasks: typeof tasks };
  assert.deepEqual(hidden.tasks, tasks.slice(1));
  for (const viewer of [null, ...state.activePlayers]) {
    // Only the tasks: the dealt hands may hold the same cards, which is not a leak
    const shown = JSON.stringify((crew.toPublicState(distributing, false, viewer) as { tasks: unknown }).tasks);
    for (const t of hidden.tasks) assert.ok(!shown.includes(JSON.stringify(t.card)), `${JSON.stringify(t.card)} shown to ${viewer}`);
  }
});

for (const game of GAMES.filter(g => g.secretState)) {
  describe(game.info.id, () => {
    it('no view shows a secret field as it is', () => {
      const state = dealt(game);
      const secret = Object.entries(game.secretState!(state) as Record<string, unknown>).filter(([, v]) => !isEmpty(v));
      for (const viewer of [null, ...state.activePlayers]) {
        const view = game.toPublicState(state, false, viewer) as Record<string, unknown>;
        for (const [key, value] of secret) assert.notDeepEqual(view[key], value, `${key} shown to ${viewer}`);
      }
    });

    it('secretState keys are fields of the state', () => {
      const state = dealt(game);
      for (const key of Object.keys(game.secretState!(state) as object)) assert.ok(key in state, key);
    });
  });
}
