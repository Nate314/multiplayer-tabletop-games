import { test } from 'node:test';
import assert from 'node:assert/strict';
import { houseRulesOf, offeredChoices, standardOf, type RulesInfo } from './houseRules.ts';
import { addContribution, modeOf, modeRule, MODE_RULE, playsAtOnce, raceProgress, visibleBoards } from './puzzleModes.ts';

const infoFor = (rule: typeof MODE_RULE): RulesInfo => ({ minPlayers: 1, maxPlayers: 4, houseRules: [rule] });
const stateFor = (rule: typeof MODE_RULE, seats: number[]) =>
  ({ houseRules: houseRulesOf(infoFor(rule), { houseRules: undefined, activePlayers: seats }) });

test('MODE_RULE is solo at 1 seat and together at 2', () => {
  assert.equal(modeOf(stateFor(MODE_RULE, [1]), MODE_RULE), 'solo');
  assert.equal(modeOf(stateFor(MODE_RULE, [1, 2]), MODE_RULE), 'together');
  assert.deepEqual(offeredChoices(MODE_RULE, 1, {}).map(c => c.value), ['solo']);
  assert.deepEqual(offeredChoices(MODE_RULE, 2, {}).map(c => c.value), ['together', 'race']);
  assert.equal(MODE_RULE.id, 'mode');
});

test('extra choices and standardAt', () => {
  const rule = modeRule([{ value: 'classic', label: 'Classic', offered: s => s === 2 }], s => s === 2 ? 'classic' : s === 1 ? 'solo' : 'together');
  assert.deepEqual(offeredChoices(rule, 2, {}).map(c => c.value), ['together', 'race', 'classic']);
  assert.deepEqual(offeredChoices(rule, 3, {}).map(c => c.value), ['together', 'race']);
  assert.equal(standardOf(rule, 2), 'classic');
  assert.equal(modeOf(stateFor(rule as never, [1, 2]), rule), 'classic');
  assert.equal(modeOf(stateFor(rule as never, [1, 2, 3]), rule), 'together');
});

test('visibleBoards', () => {
  const boards = { 1: 'a', 2: 'b' };
  assert.deepEqual(visibleBoards(boards, 1, false), { 1: 'a' });
  assert.deepEqual(visibleBoards(boards, null, false), {});
  assert.deepEqual(visibleBoards(boards, null, true), boards);
  assert.deepEqual(visibleBoards(boards, 3, false), {});
});

test('raceProgress rounds, addContribution counts, playsAtOnce', () => {
  assert.deepEqual(raceProgress({ 1: 1, 2: 2 }, n => n * 33.4), { 1: 33, 2: 67 });
  assert.deepEqual(addContribution({}, 2), { 2: 1 });
  assert.deepEqual(addContribution({ 2: 1 }, 2, 3), { 2: 4 });
  assert.equal(playsAtOnce('solo'), false);
  assert.equal(playsAtOnce('together'), true);
  assert.equal(playsAtOnce('race'), true);
});
