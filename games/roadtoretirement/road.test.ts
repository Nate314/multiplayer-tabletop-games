import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MID_FORK, ROAD, START_FORK, isStop, nextSpace, pathLength, type SpaceKind } from './road.ts';

const KINDS: SpaceKind[] = ['start', 'payday', 'job', 'event', 'house', 'family', 'risk', 'graduation', 'marriage', 'houseStop', 'retirement', 'fork'];
const LENGTHS = ['short', 'full'] as const;

// Walk with nextSpace from a space (inclusive) to retirement, pausing at the mid fork to take the given branch.
const walk = (from: number, length: 'short' | 'full', branch: number): number[] => {
  const seen = [from];
  let at = from;
  while (ROAD[at].kind !== 'retirement') {
    at = at === MID_FORK.space ? branch : nextSpace(at, length);
    assert.ok(!seen.includes(at), 'no loops');
    seen.push(at);
  }
  return seen;
};

test('about 90 spaces on the full road, fewer on the short', () => {
  // pathLength counts spaces walked from start to retirement, both inclusive
  const full = pathLength('work', 'safe', 'full');
  assert.ok(full >= 80 && full <= 100, `full is ${full}`);
  for (const route of ['college', 'work'] as const) for (const road of ['safe', 'fast'] as const) {
    assert.ok(pathLength(route, road, 'short') <= pathLength(route, road, 'full') - 20);
  }
});

test('every space type appears', () => {
  for (const k of KINDS) assert.ok(ROAD.some(s => s.kind === k), k);
});

test('both forks rejoin and every path ends at retirement', () => {
  assert.equal(ROAD.filter(s => s.kind === 'retirement').length, 1);
  assert.deepEqual(ROAD[0].next, [START_FORK.college, START_FORK.work]);
  assert.deepEqual(ROAD[MID_FORK.space].next, [MID_FORK.safe, MID_FORK.fast]);
  for (const length of LENGTHS) for (const start of [START_FORK.college, START_FORK.work]) for (const b of [MID_FORK.safe, MID_FORK.fast]) {
    const path = walk(start, length, b);
    assert.ok(path.includes(b) && path.includes(MID_FORK.space));
  }
  for (const route of ['college', 'work'] as const) for (const road of ['safe', 'fast'] as const) for (const length of LENGTHS) {
    const start = route === 'college' ? START_FORK.college : START_FORK.work;
    const branch = road === 'safe' ? MID_FORK.safe : MID_FORK.fast;
    assert.equal(pathLength(route, road, length), 1 + walk(start, length, branch).length);
  }
  assert.equal(ROAD.filter(s => s.kind === 'graduation').length, 1);
  assert.ok(walk(START_FORK.college, 'full', MID_FORK.safe).some(i => ROAD[i].kind === 'graduation'));
  assert.ok(!walk(START_FORK.work, 'full', MID_FORK.safe).some(i => ROAD[i].kind === 'graduation'));
});

test('stop spaces are never fullOnly', () => {
  for (const s of ROAD) if (isStop(s.kind)) assert.ok(!s.fullOnly);
  assert.deepEqual(KINDS.filter(isStop).sort(), ['fork', 'graduation', 'houseStop', 'marriage', 'retirement']);
});

test('event spaces carry a text and an amount', () => {
  for (const s of ROAD) {
    if (s.kind === 'event') {
      assert.ok(s.text && s.text.endsWith('.') && !s.text.includes('\u2014'));
      assert.ok(Number.isInteger(s.amount) && s.amount !== 0);
    } else assert.ok(s.text === undefined && s.amount === undefined);
  }
  assert.ok(ROAD.some(s => (s.amount ?? 0) > 0) && ROAD.some(s => (s.amount ?? 0) < 0));
});
