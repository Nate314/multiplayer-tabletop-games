import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StatsGame } from '../../shared/stats.ts';
import { filterGames, gameStats, headToHead, peopleStats } from './aggregate.ts';

const MINUTE = 60_000;
let count = 0;
const game = (gameType: string, finishedAt: number, players: [name: string, place: number, score?: string][], minutes = 10): StatsGame => ({
  archiveId: `${gameType}/g${++count}#1`, gameType, gameId: `g${count}`, startedAt: finishedAt - minutes * MINUTE, finishedAt,
  moveCount: 5, historyAvailable: true,
  players: players.map(([name, place, score]) => ({ name, place, ...(score === undefined ? {} : { score }), you: false }))
});

const NOW = new Date(2026, 9, 20, 12).getTime();
const day = (n: number) => NOW - n * 24 * 60 * MINUTE;

// Ann wins twice, then Bo wins the latest; 'ann' is Ann in another spelling
const games = [
  game('connectfour', day(1), [['Ann', 2], ['Bo', 1]], 4),
  game('connectfour', day(2), [['ann', 1], ['Bo', 2]], 8),
  game('chess', day(3), [['Ann', 1], ['Former player', 2]], 30)
];

test('people: wins, win rate, streak and favorite game, names grouped ignoring case', () => {
  const people = peopleStats(games);
  const ann = people.find(p => p.name === 'Ann');
  const bo = people.find(p => p.name === 'Bo');
  assert.deepEqual(people.map(p => p.name).sort(), ['Ann', 'Bo']);
  assert.equal(ann?.games, 3);
  assert.equal(ann?.wins, 2);
  assert.equal(ann?.winRate, 2 / 3);
  assert.equal(ann?.streak, 0);
  assert.equal(ann?.favoriteGame, 'connectfour');
  assert.equal(bo?.streak, 1);
  assert.equal(bo?.wins, 1);
});

test('people: shown in the spelling of the most recent game, favorite ties go to the most recent', () => {
  const people = peopleStats([game('chess', day(1), [['ANN', 1], ['Bo', 2]]), game('uno', day(2), [['ann', 1], ['Bo', 2]])]);
  assert.equal(people.find(p => p.name === 'ANN')?.favoriteGame, 'chess');
});

test('people: Former player is left out', () => {
  assert.equal(peopleStats(games).some(p => p.name === 'Former player'), false);
});

test('games: played count and the median length in whole minutes', () => {
  const stats = gameStats(games);
  const four = stats.find(s => s.gameType === 'connectfour');
  assert.equal(four?.played, 2);
  assert.equal(four?.usualMinutes, 6);
  assert.equal(stats.find(s => s.gameType === 'chess')?.usualMinutes, 30);
});

test('games: a high score only where the winner always holds the largest score', () => {
  const hearts = [game('hearts', day(1), [['Ann', 1, '12'], ['Bo', 2, '80']]), game('hearts', day(2), [['Ann', 1, '20'], ['Bo', 2, '101']])];
  const yahtzee = [game('yahtzee', day(1), [['Ann', 1, '250'], ['Bo', 2, '200']]), game('yahtzee', day(2), [['Ann', 2, '180 points'], ['Bo', 1, '301 points']])];
  const stats = gameStats([...hearts, ...yahtzee, ...games]);
  assert.equal(stats.find(s => s.gameType === 'hearts')?.highScore, undefined);
  assert.deepEqual(stats.find(s => s.gameType === 'yahtzee')?.highScore, { score: 301, name: 'Bo' });
  assert.equal(stats.find(s => s.gameType === 'connectfour')?.highScore, undefined);
});

test('head to head counts only the games both played', () => {
  assert.deepEqual(headToHead(games, 'Ann', 'Bo'), { games: 2, aWins: 1, bWins: 1, other: 0 });
  assert.deepEqual(headToHead(games, 'bo', 'ANN'), { games: 2, aWins: 1, bWins: 1, other: 0 });
});

test('head to head counts a shared first place for neither player', () => {
  const tie = [game('hearts', day(1), [['Ann', 1], ['Bo', 1], ['Cy', 3]])];
  assert.deepEqual(headToHead(tie, 'Ann', 'Bo'), { games: 1, aWins: 0, bWins: 0, other: 1 });
});

test('filter by game type and this calendar month', () => {
  const lastMonth = game('connectfour', new Date(2026, 8, 30, 23).getTime(), [['Ann', 1], ['Bo', 2]]);
  const all = [...games, lastMonth];
  assert.equal(filterGames(all, { gameType: null, range: 'all' }, NOW).length, 4);
  assert.deepEqual(filterGames(all, { gameType: null, range: 'month' }, NOW), games);
  assert.deepEqual(filterGames(all, { gameType: 'chess', range: 'all' }, NOW), [games[2]]);
});
