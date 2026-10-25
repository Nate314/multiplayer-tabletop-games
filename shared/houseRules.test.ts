import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  afterSeatChange, agreeToHouseRules, describeHouseRules, everyoneAgreed, houseRule, houseRulesOf, minimumToStart,
  needsAgreement, setHouseRules, tableLimit, targetScoreRule, type ChoiceRule, type HouseRulesProposal, type ToggleRule
} from './houseRules.ts';
import { rulesGame, testGame, type TestState } from './testGame.ts';
import type { Seat } from './types.ts';

const info = rulesGame.info;
const [FAST, GOAL] = info.houseRules as [ToggleRule, ChoiceRule<number>];
const CATAN = { minPlayers: 3, maxPlayers: 6, stretchedPlayers: { min: 2, max: 6 } };
const UNO = { minPlayers: 2, maxPlayers: 8, stretchedPlayers: { min: 2, max: 10 } };

function lobby(seats: Seat[], patch: Partial<TestState> = {}): TestState {
  const names = Object.fromEntries(seats.map(seat => [seat, `P${seat}`]));
  const base: TestState = { ...rulesGame.createGameState('g'), activePlayers: seats, playerNames: names, ...patch };
  return { ...base, houseRules: afterSeatChange(info, base.houseRules, seats) };
}

function propose(state: TestState, seat: Seat, proposal: Partial<HouseRulesProposal>) {
  return setHouseRules(info, state, seat, { values: {}, maxPlayers: null, ...proposal });
}

function ok<T>(result: { state: T } | { error: string }): T {
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

test('needsAgreement is false only for a game with no rules and no stretched range', () => {
  assert.equal(needsAgreement(testGame.info), false);
  assert.equal(needsAgreement(rulesGame.info), true);
  assert.equal(needsAgreement({ ...testGame.info, stretchedPlayers: { min: 2, max: 6 } }), true);
});

test('houseRule falls back to the standard value for a state saved before house rules', () => {
  assert.equal(houseRule({}, FAST), false);
  assert.equal(houseRule({}, GOAL), 3);
  const chosen = ok(propose(lobby([1, 2]), 1, { values: { goal: 5 } }));
  assert.equal(houseRule(chosen, GOAL), 5);
});

test('houseRulesOf builds defaults for a state saved before house rules', () => {
  assert.deepEqual(houseRulesOf(info, { activePlayers: [2, 3, 4] }), {
    host: 2, values: { fast: false, goal: 3, big: false }, maxPlayers: null, agreed: [], revision: 0
  });
});

test('afterSeatChange gives the first seat the host and keeps the host while seated', () => {
  const first = afterSeatChange(info, undefined, [2, 3]);
  assert.equal(first.host, 2);
  assert.equal(afterSeatChange(info, first, [1, 2, 3]).host, 2);
});

test('afterSeatChange moves a departed host to the next seat in seat order, wrapping', () => {
  const three = { ...afterSeatChange(info, undefined, [1, 2, 3, 4]), host: 3 };
  assert.equal(afterSeatChange(info, three, [1, 2, 4]).host, 4);
  const four = { ...three, host: 4 };
  assert.equal(afterSeatChange(info, four, [1, 2, 3]).host, 1);
});

test('afterSeatChange clears every agreement and bumps the revision', () => {
  const rules = { ...afterSeatChange(info, undefined, [1, 2]), agreed: [1, 2] };
  const next = afterSeatChange(info, rules, [1, 2, 3]);
  assert.deepEqual(next.agreed, []);
  assert.equal(next.revision, rules.revision + 1);
});

test('afterSeatChange adds a rule offered at the new seat count and drops one no longer offered', () => {
  const two = afterSeatChange(info, undefined, [1, 2]);
  assert.deepEqual(Object.keys(two.values), ['fast', 'goal']);
  const three = afterSeatChange(info, { ...two, values: { ...two.values, fast: true } }, [1, 2, 3]);
  assert.deepEqual(three.values, { fast: true, goal: 3, big: false });
  assert.deepEqual(Object.keys(afterSeatChange(info, three, [1, 2]).values), ['fast', 'goal']);
});

test('setHouseRules refuses everyone but the host', () => {
  assert.deepEqual(propose(lobby([1, 2]), 2, {}), { error: 'Only the host can change the house rules' });
});

test('setHouseRules refuses after the first move', () => {
  assert.deepEqual(propose(lobby([1, 2], { started: true }), 1, {}), { error: 'The house rules are locked once play starts' });
});

test('setHouseRules refuses an undeclared key, a wrong type and a value not in the choices', () => {
  const state = lobby([1, 2]);
  assert.deepEqual(propose(state, 1, { values: { nope: true } }), { error: 'That is not a house rule of this game' });
  assert.deepEqual(propose(state, 1, { values: { fast: 'yes' } }), { error: 'That value is not allowed for Fast' });
  assert.deepEqual(propose(state, 1, { values: { goal: 4 } }), { error: 'That value is not allowed for Goal' });
  assert.deepEqual(setHouseRules(info, state, 1, 'junk'), { error: 'Invalid house rules' });
});

test('setHouseRules refuses a rule not offered at this seat count', () => {
  assert.deepEqual(propose(lobby([1, 2]), 1, { values: { big: true } }), { error: 'That is not a house rule of this game' });
});

test('setHouseRules allows a rule that depends on another value sent in the same proposal', () => {
  const next = ok(propose(lobby([1, 2, 3]), 1, { values: { big: true, bigger: true } }));
  assert.deepEqual(next.houseRules?.values, { fast: false, goal: 3, big: true, bigger: true });
  assert.deepEqual(propose(lobby([1, 2, 3]), 1, { values: { bigger: true } }), { error: 'That is not a house rule of this game' });
});

test('setHouseRules checks the table size', () => {
  const plain = lobby([1, 2]);
  assert.deepEqual(setHouseRules(testGame.info, plain, 1, { values: {}, maxPlayers: 4 }), { error: 'This game has no player-count house rule' });
  for (const maxPlayers of [7, 4.5, '6', 1e9, 1]) {
    assert.deepEqual(propose(plain, 1, { maxPlayers: maxPlayers as number }), { error: 'Most players must be from 2 to 6' });
  }
  assert.deepEqual(propose(lobby([1, 2, 3]), 1, { maxPlayers: 2 }), { error: '3 players are already seated' });
  const five = ok(propose(lobby([1, 2, 3, 4, 5]), 1, { maxPlayers: 6 }));
  assert.equal(five.houseRules?.maxPlayers, 6);
  assert.deepEqual(propose(five, 1, { maxPlayers: null }), { error: '5 players are already seated' });
});

test('setHouseRules stores the normal maximum as null and ignores a leftover override', () => {
  const raised = ok(propose(lobby([1, 2]), 1, { maxPlayers: 6 }));
  assert.equal(ok(propose(raised, 1, { maxPlayers: 4 })).houseRules?.maxPlayers, null);
  const old = ok(setHouseRules(info, lobby([1, 2]), 1, { values: {}, maxPlayers: 5 }));
  assert.deepEqual(old.houseRules, { ...old.houseRules!, maxPlayers: 5 });
  assert.equal('override' in old.houseRules!, false);
});

test('houseRulesOf and tableLimit read a room saved with the old override flag', () => {
  const saved = (override: boolean, maxPlayers: number | null) =>
    lobby([1, 2], { houseRules: { ...afterSeatChange(info, undefined, [1, 2]), override, maxPlayers } as TestState['houseRules'] });
  const on = saved(true, 6);
  assert.equal(tableLimit(info, on), 6);
  assert.equal(houseRulesOf(info, on).maxPlayers, 6);
  assert.equal('override' in houseRulesOf(info, on), false);
  const off = saved(false, 6);
  assert.equal(tableLimit(info, off), 4);
  assert.equal(houseRulesOf(info, off).maxPlayers, null);
  assert.equal(tableLimit(info, saved(false, null)), 4);
});

test('setHouseRules keeps unsent values, clears agreements and bumps the revision', () => {
  const start = lobby([1, 2]);
  const agreed = ok(agreeToHouseRules(info, start, 2, start.houseRules?.revision));
  const set = ok(propose(agreed, 1, { values: { fast: true } }));
  const again = ok(propose(set, 1, { values: { goal: 5 } }));
  assert.deepEqual(again.houseRules?.values, { fast: true, goal: 5 });
  assert.deepEqual(again.houseRules?.agreed, []);
  assert.equal(again.houseRules?.revision, (start.houseRules?.revision ?? 0) + 2);
  assert.equal(again.gameStatus, 'P1 changed the house rules');
});

test('agreeToHouseRules refuses a stale revision and play already started', () => {
  const state = lobby([1, 2]);
  const revision = state.houseRules!.revision;
  assert.deepEqual(agreeToHouseRules(info, state, 2, revision - 1), { error: 'The house rules changed. Check them and agree again' });
  assert.deepEqual(agreeToHouseRules(info, state, 2, String(revision)), { error: 'The house rules changed. Check them and agree again' });
  assert.deepEqual(agreeToHouseRules(info, { ...state, started: true }, 2, revision), { error: 'The house rules are locked once play starts' });
});

test('agreeToHouseRules is idempotent and everyoneAgreed waits for every seat', () => {
  const state = lobby([1, 2, 3]);
  const revision = state.houseRules!.revision;
  const one = ok(agreeToHouseRules(info, state, 3, revision));
  assert.equal(one.gameStatus, state.gameStatus);
  assert.deepEqual(ok(agreeToHouseRules(info, one, 3, revision)).houseRules?.agreed, [3]);
  const two = ok(agreeToHouseRules(info, one, 1, revision));
  assert.deepEqual(two.houseRules?.agreed, [1, 3]);
  assert.equal(everyoneAgreed(info, two), false);
  assert.equal(everyoneAgreed(info, ok(agreeToHouseRules(info, two, 2, revision))), true);
});

test('tableLimit follows Most players and minimumToStart is the stretched minimum', () => {
  const plain = lobby([1, 2]);
  assert.equal(tableLimit(info, plain), 4);
  assert.equal(tableLimit(info, ok(propose(plain, 1, { maxPlayers: 6 }))), 6);
  assert.equal(tableLimit(info, {}), 4);
  assert.equal(minimumToStart(CATAN), 2);
  assert.equal(minimumToStart(testGame.info), testGame.info.minPlayers);
});

test('describeHouseRules marks non-standard values and lists a raised table', () => {
  const state = ok(propose(lobby([1, 2]), 1, { values: { fast: true }, maxPlayers: 6 }));
  assert.deepEqual(describeHouseRules(info, state.houseRules!, 2), [
    { label: 'Fast', value: 'On', standard: false },
    { label: 'Goal', value: '3', standard: true },
    { label: 'Most players', value: '6', standard: false }
  ]);
  assert.deepEqual(describeHouseRules(UNO, { ...state.houseRules!, values: {}, maxPlayers: 10 }, 9),
    [{ label: 'Most players', value: '10', standard: false }]);
  assert.equal(tableLimit(UNO, { houseRules: { ...state.houseRules!, maxPlayers: 10 } }), 10);
});

test('describeHouseRules lists a seat count below the normal minimum', () => {
  const rules = afterSeatChange(CATAN, undefined, [1, 2]);
  assert.deepEqual(describeHouseRules(CATAN, rules, 2), [{ label: 'Players', value: '2', standard: false }]);
  assert.deepEqual(describeHouseRules(CATAN, rules, 3), []);
  // Still waiting for players, not a smaller table
  assert.deepEqual(describeHouseRules(CATAN, afterSeatChange(CATAN, undefined, [1]), 1), []);
  assert.deepEqual(describeHouseRules(UNO, afterSeatChange(UNO, undefined, [1]), 1), []);
});

test('targetScoreRule offers the standard target among the others, sorted', () => {
  const rule = targetScoreRule(500, [250, 1000]);
  assert.equal(rule.id, 'targetScore');
  assert.deepEqual(rule.choices.map(choice => choice.value), [250, 500, 1000]);
  assert.equal(rule.standard, 500);
  assert.equal(targetScoreRule(10000, []).choices[0].label, '10,000');
});
