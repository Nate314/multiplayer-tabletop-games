import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../../games/registry.ts';
import type { GameCategory } from '../../shared/categories.ts';
import { DEFAULT_FILTERS, activeFilterCount, arrangeGames, hasActiveFilters, matchesFilters, needsHouseRule, parsePlayers } from './gameFilters.ts';

const fake = (name: string, category: GameCategory, min = 2, max = 4, description = '') => ({ info: { id: name, name, description, minPlayers: min, maxPlayers: max, category } });

const carcassonne = fake('Carcassonne', 'tile', 2, 5, 'Place tiles and claim meeples');
const connect = fake('Connect Four', 'classic', 2, 2, 'Drop discs');
const uno = fake('UNO', 'card', 2, 10, 'Shed your cards');

test('search matches the name or the description, ignoring case and spaces around it', () => {
  assert.equal(matchesFilters(carcassonne.info, { ...DEFAULT_FILTERS, search: '  MEEPLES ' }), true);
  assert.equal(matchesFilters(connect.info, { ...DEFAULT_FILTERS, search: '  MEEPLES ' }), false);
  assert.equal(matchesFilters(connect.info, { ...DEFAULT_FILTERS, search: 'conn' }), true);
});

test('no categories picked shows every category, and several can be picked', () => {
  const all = [carcassonne, connect, uno];
  const names = (categories: GameCategory[]) => arrangeGames(all, { ...DEFAULT_FILTERS, categories, sort: 'name' }).flatMap(s => s.games.map(g => g.info.name));
  assert.deepEqual(names([]), ['Carcassonne', 'Connect Four', 'UNO']);
  assert.deepEqual(names(['card', 'tile']), ['Carcassonne', 'UNO']);
});

test('the player count keeps games whose range includes it', () => {
  const game = fake('G', 'card', 2, 4).info;
  const keeps = (players: number) => matchesFilters(game, { ...DEFAULT_FILTERS, players });
  assert.deepEqual([1, 2, 3, 4, 5].map(keeps), [false, true, true, true, false]);
});

test('the player count includes the stretched range, and only those counts need a house rule', () => {
  const game = { ...fake('G', 'card', 3, 4).info, stretchedPlayers: { min: 2, max: 6 } };
  const keeps = (players: number) => matchesFilters(game, { ...DEFAULT_FILTERS, players });
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(keeps), [false, true, true, true, true, true, false]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(players => needsHouseRule(game, players)), [false, true, false, false, true, true, false]);
});

test('sorting by category keeps the group order, and A to Z is one list with no heading', () => {
  const all = [carcassonne, connect, uno];
  const byCategory = arrangeGames(all, DEFAULT_FILTERS);
  assert.deepEqual(byCategory.map(s => [s.key, s.heading]), [['card', 'Card games'], ['tile', 'Tile games'], ['classic', 'Classic board games']]);
  const byName = arrangeGames(all, { ...DEFAULT_FILTERS, sort: 'name' });
  assert.deepEqual(byName.map(s => [s.key, s.heading]), [['all', null]]);
  assert.deepEqual(byName[0].games.map(g => g.info.name), ['Carcassonne', 'Connect Four', 'UNO']);
});

test('nothing matching gives no sections', () => {
  assert.deepEqual(arrangeGames([uno], { ...DEFAULT_FILTERS, search: 'zzz' }), []);
  assert.deepEqual(arrangeGames([uno], { ...DEFAULT_FILTERS, search: 'zzz', sort: 'name' }), []);
});

test('only search, categories and players count as active filters', () => {
  assert.equal(hasActiveFilters(DEFAULT_FILTERS), false);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'name' }), false);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, search: '   ' }), false);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, search: 'a' }), true);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, categories: ['card'] }), true);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, players: 3 }), true);
});

test('the Filter button counts picked categories and a player count, not search or sort', () => {
  assert.equal(activeFilterCount(DEFAULT_FILTERS), 0);
  assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, search: 'uno', sort: 'name' }), 0);
  assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, categories: ['classic', 'card'], players: 4 }), 3);
});

test('player counts are whole numbers from 1 to 99', () => {
  assert.equal(parsePlayers('3'), 3);
  assert.equal(parsePlayers('99'), 99);
  for (const bad of ['', '0', '-1', '2.5', 'abc', '100']) assert.equal(parsePlayers(bad), null, bad);
});

test('every registered game is shown with the default filters', () => {
  assert.equal(arrangeGames(GAMES, DEFAULT_FILTERS).flatMap(s => s.games).length, 40);
});

test('seven players lists the ten games that seat seven, two of them only as a house rule', () => {
  const games = arrangeGames(GAMES, { ...DEFAULT_FILTERS, players: 7, sort: 'name' })[0].games;
  assert.deepEqual(games.map(g => g.info.name), ['Farkle', 'Jenga', 'Jigsaw', 'Monopoly', 'Phase 10', 'Pictionary', 'Rook', "Texas Hold'em", 'UNO', 'Yahtzee']);
  assert.deepEqual(games.filter(g => needsHouseRule(g.info, 7)).map(g => g.info.name), ['Phase 10', 'Rook']);
});
