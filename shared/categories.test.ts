import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/registry.ts';
import { groupByCategory } from './categories.ts';
import type { GameCategory } from './categories.ts';

const fake = (name: string, category: GameCategory) => ({ info: { id: name, name, description: '', minPlayers: 2, maxPlayers: 2, category } });

test('groupByCategory keeps the spec\'s group order and sorts by name', () => {
  const groups = groupByCategory([fake('Zed', 'classic'), fake('Beta', 'card'), fake('Alpha', 'classic'), fake('Gamma', 'card')]);
  assert.deepEqual(groups.map(g => g.name), ['Card games', 'Classic board games']);
  assert.deepEqual(groups.map(g => g.games.map(game => game.info.name)), [['Beta', 'Gamma'], ['Alpha', 'Zed']]);
});

test('every registered game has the spec\'s category', () => {
  const expected: Record<GameCategory, string[]> = {
    card: ['euchre', 'gofish', 'hearts', 'phase10', 'racko', 'rook', 'skipbo', 'spades', 'holdem', 'thecrew', 'uno', 'war'],
    dice: ['farkle', 'yahtzee'],
    tile: ['azul', 'carcassonne', 'dominoes', 'rummikub', 'scrabble'],
    classic: ['backgammon', 'checkers', 'chess', 'connectfour', 'mancala', 'parchisi', 'quoridor'],
    strategy: ['catan', 'monopoly', 'risk', 'splendor', 'tickettoride'],
    party: ['jenga']
  };
  const actual = Object.fromEntries(Object.keys(expected).map(c => [c, GAMES.filter(g => g.info.category === c).map(g => g.info.id).sort()]));
  const sorted = Object.fromEntries(Object.entries(expected).map(([c, ids]) => [c, [...ids].sort()]));
  assert.deepEqual(actual, sorted);
  const grouped = groupByCategory(GAMES).flatMap(g => g.games.map(game => game.info.id));
  assert.equal(grouped.length, 32);
  assert.equal(new Set(grouped).size, 32);
});
