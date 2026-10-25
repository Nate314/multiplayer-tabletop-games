import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COSTS, describeResources, resources } from '../resources.ts';
import { toPublicState } from '../rules.ts';
import { game, holding } from '../testing.ts';
import { buildBlocker, trayBlocker } from './tray.ts';
import type { GameState } from '../types.ts';

const KINDS = ['road', 'settlement', 'city'] as const;
const viewOf = (state: GameState) => toPublicState(state, false, 1) as Parameters<typeof trayBlocker>[0];
const blockers = (state: GameState) => KINDS.map(kind => trayBlocker(viewOf(state), kind, 1));

test('a piece you cannot afford needs its cost, and one with nowhere to go says so', () => {
  assert.equal(buildBlocker('city', resources({ ore: 2 }), 3), `Needs ${describeResources(COSTS.city)}`);
  assert.equal(buildBlocker('road', resources({ wood: 1, brick: 1 }), 0), 'Nowhere to build a road');
  assert.equal(buildBlocker('road', resources({ wood: 1, brick: 1 }), 2), '');
});

test('setup offers only the piece the step asks for', () => {
  const order = [1, 2, 3, 3, 2, 1];
  assert.deepEqual(blockers(game({ setup: { order, step: 0, settlement: null } })), ['Not now', '', 'Not now']);
  assert.deepEqual(blockers(game({ setup: { order, step: 0, settlement: 4 } })), ['', 'Not now', 'Not now']);
});

test('free roads offer only the road, and before the roll or with the robber pending every piece waits', () => {
  assert.deepEqual(blockers(game({ rolled: true, pending: { kind: 'roadBuilding', roads: 2 } })), ['', 'Not now', 'Not now']);
  assert.deepEqual(blockers(game({ rolled: false })), ['Not now', 'Not now', 'Not now']);
  assert.deepEqual(blockers(game({ rolled: true, pending: { kind: 'robber' } })), ['Not now', 'Not now', 'Not now']);
});

test('after the roll an affordable piece with a spot is ready', () => {
  const state = holding(game({ rolled: true }), 1, COSTS.road);
  assert.equal(trayBlocker(viewOf(state), 'road', 1), '');
  assert.equal(trayBlocker(viewOf(state), 'road', 0), 'Nowhere to build a road');
  assert.equal(trayBlocker(viewOf(state), 'city', 1), `Needs ${describeResources(COSTS.city)}`);
});

test('in a special build phase the tray works only for the player whose build chance it is, whatever was rolled', () => {
  const chance = (builder: number) => holding(game({ rolled: false, turnHolder: 2, specialBuild: { builders: [builder] } }), 1, COSTS.road);
  assert.equal(trayBlocker(viewOf(chance(1)), 'road', 1), '');
  assert.equal(trayBlocker(viewOf(chance(1)), 'city', 1), `Needs ${describeResources(COSTS.city)}`);
  assert.equal(trayBlocker(viewOf(chance(3)), 'road', 1), 'Not now');
});
