import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Seat } from '../../shared/types.ts';
import { clueGiverOf, dealKey, evenOut, teamsReady } from './teams.ts';
import type { Role } from './types.ts';

const seeded = (seed: number) => () => {
  seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 374761393) >>> 0;
  return seed / 4294967296;
};
const red = (clueGiver = false): Role => ({ team: 'red', clueGiver });
const blue = (clueGiver = false): Role => ({ team: 'blue', clueGiver });
const four: Partial<Record<Seat, Role>> = { 1: red(true), 2: red(), 3: blue(true), 4: blue() };
const onTeam = (roles: Partial<Record<Seat, Role>>, seats: Seat[], team: string) => seats.filter((s) => roles[s]?.team === team);

test('the key has 9, 8, 7 and 1', () => {
  const starters = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) {
    const { startingTeam, key } = dealKey(seeded(seed * 7919));
    starters.add(startingTeam);
    const other = startingTeam === 'red' ? 'blue' : 'red';
    const count = (k: string) => key.filter((c) => c === k).length;
    assert.deepEqual([count(startingTeam), count(other), count('bystander'), count('trap'), key.length], [9, 8, 7, 1, 25]);
  }
  assert.equal(starters.size, 2);
});

test('teamsReady needs everyone placed, one clue-giver and a guesser on each team', () => {
  assert.equal(teamsReady(four, [1, 2, 3, 4]), true);
  assert.equal(teamsReady({ ...four, 4: undefined }, [1, 2, 3, 4]), false);
  assert.equal(teamsReady({ ...four, 2: red(true) }, [1, 2, 3, 4]), false);
  assert.equal(teamsReady({ ...four, 4: red() }, [1, 2, 3, 4]), false);
});

test('evenOut with nobody placed alternates teams and makes the first of each the clue-giver', () => {
  const roles = evenOut({}, [1, 2, 3, 4]);
  assert.deepEqual(onTeam(roles, [1, 2, 3, 4], 'red'), [1, 3]);
  assert.deepEqual(onTeam(roles, [1, 2, 3, 4], 'blue'), [2, 4]);
  assert.equal(clueGiverOf(roles, 'red'), 1);
  assert.equal(clueGiverOf(roles, 'blue'), 2);
});

test('evenOut keeps a clue-giver where they are', () => {
  const seats = [1, 2, 3, 4, 5];
  const roles = evenOut({ 3: red(true) }, seats);
  assert.deepEqual(onTeam(roles, seats, 'red'), [2, 3, 5]);
  assert.deepEqual(onTeam(roles, seats, 'blue'), [1, 4]);
  assert.equal(clueGiverOf(roles, 'red'), 3);
  assert.equal(clueGiverOf(roles, 'blue'), 1);
  assert.equal(teamsReady(roles, seats), true);
});

test('evenOut balances teams within one', () => {
  const starts: Partial<Record<Seat, Role>>[] = [{}, { 1: red(true), 2: red(), 3: red() }, { 2: blue(true), 5: blue(true) }];
  for (let n = 4; n <= 8; n++) {
    const seats = Array.from({ length: n }, (_, i) => i + 1);
    for (const start of starts) {
      const reds = onTeam(evenOut(start, seats), seats, 'red').length;
      assert.ok(Math.abs(reds - (n - reds)) <= 1, `${n} seats: ${reds} red`);
    }
  }
});
