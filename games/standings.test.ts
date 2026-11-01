import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from './registry.ts';
import { addPlayer } from '../shared/seating.ts';
import { standingsOf } from '../shared/standings.ts';

// These end with a winner and a loser or a whole crew, so the platform fallback is their standings
const FALLBACK_GAMES = ['chess', 'checkers', 'connectfour', 'quoridor', 'thecrew', 'naval'];

test('every game but the fallback games has finalStandings', () => {
  for (const game of GAMES) {
    assert.equal(Boolean(game.finalStandings), !FALLBACK_GAMES.includes(game.info.id), game.info.id);
  }
});

for (const game of GAMES) {
  test(`${game.info.id} standings list every seat once with the winners at place 1`, () => {
    let state = game.createGameState('t');
    for (let i = 1; i <= game.info.minPlayers; i++) {
      const added = addPlayer(game, state, `P${i}`);
      if ('error' in added) assert.fail(added.error);
      state = added.state;
    }
    const finished = { ...state, isGameOver: true, currentPlayer: null, winners: [state.activePlayers[0]] };
    const rows = standingsOf(game, finished);
    assert.deepEqual(rows.map(row => row.seat).sort((a, b) => a - b), finished.activePlayers);
    assert.ok(rows.every(row => Number.isInteger(row.place) && row.place >= 1));
    assert.deepEqual(rows.map(row => row.place), rows.map(row => row.place).sort((a, b) => a - b));
    assert.deepEqual(rows.filter(row => row.place === 1).map(row => row.seat), finished.winners);
  });
}
