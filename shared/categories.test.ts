import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/registry.ts';
import { CATEGORIES, groupByCategory } from './categories.ts';
import type { GameCategory } from './categories.ts';

const fake = (name: string, category: GameCategory) => ({ info: { id: name, name, description: '', minPlayers: 2, maxPlayers: 2, category } });

test('groupByCategory keeps the spec\'s group order and sorts by name', () => {
  const groups = groupByCategory([fake('Zed', 'classic'), fake('Beta', 'card'), fake('Alpha', 'classic'), fake('Gamma', 'card')]);
  assert.deepEqual(groups.map(g => g.name), ['Card games', 'Classic board games']);
  assert.deepEqual(groups.map(g => g.games.map(game => game.info.name)), [['Beta', 'Gamma'], ['Alpha', 'Zed']]);
});

test('the Puzzles group sits after Classic board games and is dropped while empty', () => {
  assert.deepEqual(CATEGORIES.map(c => c.id), ['card', 'dice', 'tile', 'classic', 'puzzle', 'strategy', 'party']);
  assert.equal(CATEGORIES.find(c => c.id === 'puzzle')?.name, 'Puzzles');
  assert.deepEqual(groupByCategory([fake('Alpha', 'classic'), fake('Beta', 'party')]).map(g => g.category), ['classic', 'party']);
  assert.deepEqual(groupByCategory([fake('Alpha', 'classic'), fake('Grid', 'puzzle')]).map(g => g.category), ['classic', 'puzzle']);
});

test('every registered game has the spec\'s category', () => {
  const expected: Record<GameCategory, string[]> = {
    card: ['euchre', 'gofish', 'hearts', 'phase10', 'racko', 'rook', 'skipbo', 'spades', 'holdem', 'thecrew', 'uno', 'war'],
    dice: ['farkle', 'yahtzee'],
    tile: ['azul', 'carcassonne', 'dominoes', 'rummikub', 'scrabble'],
    classic: ['backgammon', 'checkers', 'chess', 'connectfour', 'mancala', 'parchisi', 'quoridor'],
    puzzle: [],
    strategy: ['catan', 'monopoly', 'risk', 'splendor', 'tickettoride'],
    party: ['jenga', 'pictionary']
  };
  const actual = Object.fromEntries(Object.keys(expected).map(c => [c, GAMES.filter(g => g.info.category === c).map(g => g.info.id).sort()]));
  const sorted = Object.fromEntries(Object.entries(expected).map(([c, ids]) => [c, [...ids].sort()]));
  assert.deepEqual(actual, sorted);
  const grouped = groupByCategory(GAMES).flatMap(g => g.games.map(game => game.info.id));
  assert.equal(grouped.length, 33);
  assert.equal(new Set(grouped).size, 33);
});
