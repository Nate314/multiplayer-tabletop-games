import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIVE_SIX_BOARD } from './board.ts';
import { longestRoadOf } from './roads.ts';
import { createGameState, resetLobby } from './rules.ts';
import { resources } from './resources.ts';
import { FIVE_SIX_LAYOUT, dice, fiveSixGame, game, holding, move, played } from './testing.ts';
import type { GameState, Random } from './types.ts';

// The same rolls on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A lobby with `count` active players, seats 1 to count
function lobby(count: number): GameState {
  const seats = Array.from({ length: count }, (_, index) => index + 1);
  return {
    ...createGameState('g'),
    activePlayers: seats,
    playerNames: Object.fromEntries(seats.map(seat => [seat, `P${seat}`]))
  };
}

test('five seated get the 30-hex board, 24 of each resource and 34 development cards; back at four the base game', () => {
  const five = resetLobby(lobby(5), seeded(1));
  assert.equal(five.layout.hexes.length, 30);
  assert.deepEqual(five.bank, resources({ wood: 24, brick: 24, sheep: 24, wheat: 24, ore: 24 }));
  assert.equal(five.devDeck.length, 34);
  assert.equal(five.layout.hexes[five.robber].resource, null);
  const four = resetLobby({ ...five, activePlayers: [1, 2, 3, 4] }, seeded(1));
  assert.equal(four.layout.hexes.length, 19);
  assert.equal(four.bank.wood, 19);
  assert.equal(four.devDeck.length, 25);
});

test('setup on the large board snakes through all six players', () => {
  const { order } = resetLobby(lobby(6), seeded(2)).setup ?? assert.fail('no setup');
  assert.equal(order.length, 12);
  assert.deepEqual([...order.slice(0, 6)].sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(order.slice(6), order.slice(0, 6).reverse());
});

test('an intersection past the base board is an invalid move there and a real one on the large board', () => {
  assert.deepEqual(move(game({ rolled: true }), 1, { type: 'buildSettlement', vertex: 79 }), { error: 'Invalid move' });
  assert.notDeepEqual(move(fiveSixGame({ rolled: true }), 1, { type: 'buildSettlement', vertex: 79 }), { error: 'Invalid move' });
  assert.deepEqual(move(game(), 1, { type: 'moveRobber', hex: 29, victim: null }), { error: 'Invalid move' });
});

test('a roll on the large board pays settlements on its far hexes', () => {
  const vertex = FIVE_SIX_BOARD.hexVertices[27][0];
  const hex = FIVE_SIX_LAYOUT.hexes[27];
  const number = hex.number ?? assert.fail('hex 27 has no number');
  const resource = hex.resource ?? assert.fail('hex 27 has no resource');
  const first = Math.min(6, number - 1);
  const state = fiveSixGame({ buildings: { [vertex]: { seat: 5, city: false } } });
  const after = played(state, 1, { type: 'roll' }, dice(first, number - first));
  assert.ok(after.hands[5][resource] >= 1);
});

test('a 2:1 sheep port on the large board trades 2 sheep for 1', () => {
  const port = FIVE_SIX_LAYOUT.ports.find(candidate => candidate.kind === 'sheep') ?? assert.fail('no sheep port');
  const vertex = FIVE_SIX_BOARD.edges[port.edge][0];
  const state = holding(fiveSixGame({ rolled: true, buildings: { [vertex]: { seat: 1, city: false } } }), 1, { sheep: 2 });
  const after = played(state, 1, { type: 'bankTrade', give: 'sheep', get: 'ore' });
  assert.deepEqual(after.hands[1], resources({ ore: 1 }));
});

test('Longest Road is counted on the large board', () => {
  const corners = FIVE_SIX_BOARD.hexVertices[29];
  const roundHex = corners.map((corner, index) => {
    const other = corners[(index + 1) % 6];
    return FIVE_SIX_BOARD.edges.findIndex(([a, b]) => (a === corner && b === other) || (a === other && b === corner));
  });
  assert.ok(roundHex.every(edge => edge >= 0));
  const roads = Object.fromEntries(roundHex.slice(0, 4).map(edge => [edge, 5]));
  const state = holding(fiveSixGame({ turnHolder: 5, currentPlayer: 5, rolled: true, roads }), 5, { wood: 1, brick: 1 });
  const after = played(state, 5, { type: 'buildRoad', edge: roundHex[4] });
  assert.equal(longestRoadOf(after, 5), 5);
  assert.equal(after.longestRoad, 5);
});
