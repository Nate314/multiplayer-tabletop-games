import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { RESOURCES, boardOf } from './board.ts';
import { cityError, roadSpots, settlementError, settlementSpotError } from './building.ts';
import { robberVictims } from './dice.ts';
import { COSTS, covers, total } from './resources.ts';
import { tradeRatio } from './trades.ts';
import { catan } from './index.ts';
import type { Move, PublicGameState, Resources, Seat } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'catan/g1';
const NAMES = ['A', 'B', 'C'];

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

function gameWith(seed: number, names = NAMES): Manager {
  const manager = rememberingKeys(createGameManager([catan], seeded(seed)));
  for (const name of names) manager.join('catan', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Catan's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: Seat | null = null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

const verticesOf = (state: PublicGameState) => Array.from({ length: boardOf(state.layout).vertexCount }, (_, vertex) => vertex);
const mine = (state: PublicGameState, seat: Seat) => verticesOf(state).filter(vertex => state.buildings[vertex]?.seat === seat);

// The first `count` cards of a hand, for a discard
function firstCards(hand: Resources, count: number): Resources {
  const cards = { ...hand };
  let left = count;
  for (const resource of RESOURCES) {
    cards[resource] = Math.min(left, hand[resource]);
    left -= cards[resource];
  }
  return cards;
}

// A simple player: builds a city, a settlement, a road or a card when it can, else trades its most plentiful
// resource with the bank for what it lacks, else ends the turn
function chooseBuild(state: PublicGameState, seat: Seat, hand: Resources): Move | null {
  const city = mine(state, seat).find(vertex => cityError(state, seat, vertex) === null);
  if (city !== undefined && covers(hand, COSTS.city)) return { type: 'buildCity', vertex: city };
  const spot = verticesOf(state).find(vertex => settlementError(state, seat, vertex) === null);
  if (spot !== undefined && covers(hand, COSTS.settlement)) return { type: 'buildSettlement', vertex: spot };
  const roads = roadSpots(state, seat);
  if (spot === undefined && roads.length > 0 && covers(hand, COSTS.road)) return { type: 'buildRoad', edge: roads[0] };
  if (state.devDeckCount > 0 && covers(hand, COSTS.devCard) && spot === undefined) return { type: 'buyDevCard' };
  const want = RESOURCES.find(resource => hand[resource] === 0 && state.bank[resource] > 0);
  const give = RESOURCES.find(resource => hand[resource] >= tradeRatio(state, seat, resource) + 1);
  if (want && give) return { type: 'bankTrade', give, get: want };
  return null;
}

function step(manager: Manager): PublicGameState {
  const table = viewOf(manager);
  const { pending } = table;
  if (pending?.kind === 'discard') {
    const [who, count] = Object.entries(pending.counts)[0];
    const seat = Number(who);
    const hand = viewOf(manager, seat).hand ?? assert.fail('no hand');
    return ok(manager.action(ROOM, seat, { type: 'discard', resources: firstCards(hand, count) }));
  }
  const seat = table.currentPlayer ?? assert.fail('nobody to act');
  const view = viewOf(manager, seat);
  const hand = view.hand ?? assert.fail('no hand');
  const send = (move: Move) => ok(manager.move(ROOM, seat, move));
  if (view.setup) {
    if (view.setup.settlement === null) {
      const vertex = verticesOf(view).find(v => settlementSpotError(view, v) === null) ?? assert.fail('no room');
      return send({ type: 'placeSettlement', vertex });
    }
    const edge = boardOf(view.layout).vertexEdges[view.setup.settlement].find(e => view.roads[e] === undefined) ?? assert.fail('no edge');
    return send({ type: 'placeRoad', edge });
  }
  if (pending?.kind === 'robber') {
    const hex = Array.from({ length: boardOf(view.layout).hexCount }, (_, h) => h).find(h => h !== view.robber) ?? 0;
    const victim = robberVictims(view, seat, hex, other => view.handCounts[other])[0] ?? null;
    return send({ type: 'moveRobber', hex, victim });
  }
  if (pending?.kind === 'roadBuilding') return send({ type: 'placeRoad', edge: roadSpots(view, seat)[0] });
  if (!view.rolled) {
    if (view.myDevCards.includes('knight') && !view.devPlayed) return send({ type: 'playKnight' });
    return send({ type: 'roll' });
  }
  if (!view.devPlayed && view.myDevCards.includes('roadBuilding') && roadSpots(view, seat).length > 0) return send({ type: 'playRoadBuilding' });
  return send(chooseBuild(view, seat, hand) ?? { type: 'endTurn' });
}

function playUntil(manager: Manager, done: (state: PublicGameState) => boolean, limit = 3000): PublicGameState {
  let state = viewOf(manager);
  for (let moves = 0; !done(state) && moves < limit; moves++) state = step(manager);
  assert.ok(done(state), 'the condition never came up');
  return viewOf(manager);
}

test('a rejoin mid-turn shows the same robber to move and the same hand', () => {
  const manager = gameWith(3);
  const state = playUntil(manager, view => view.pending?.kind === 'robber');
  const seat = state.currentPlayer ?? assert.fail('nobody to act');
  const hand = viewOf(manager, seat).hand;
  manager.disconnect(ROOM, seat);
  const rejoined = manager.join('catan', 'g1', NAMES[seat - 1], true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.deepEqual(view.pending, { kind: 'robber' });
  assert.equal(view.currentPlayer, seat);
  assert.deepEqual(view.hand, hand);
  const after = step(manager);
  assert.equal(after.pending, null);
});

test('undo takes back a roll and what it produced', () => {
  const manager = gameWith(5);
  const before = playUntil(manager, view => view.setup === null);
  const seat = before.currentPlayer ?? assert.fail('nobody to act');
  ok(manager.move(ROOM, seat, { type: 'roll' }));
  ok(manager.requestUndo(ROOM, seat));
  for (const other of [1, 2, 3].filter(voter => voter !== seat)) manager.voteUndo(ROOM, other, true);
  const restored = viewOf(manager);
  assert.equal(restored.rolled, false);
  assert.deepEqual(restored.handCounts, before.handCounts);
  assert.deepEqual(restored.bank, before.bank);
});

test('a seeded game plays to 10 points, and no table step shows a hand', () => {
  const manager = gameWith(7);
  const state = playUntil(manager, view => view.isGameOver, 6000);
  assert.equal(state.winners.length, 1);
  assert.ok(state.points[state.winners[0]] >= 10);

  const steps = manager.history('catan', 'g1') ?? assert.fail('no history');
  assert.ok(steps.length > 50);
  for (const past of steps) {
    const view = past as unknown as PublicGameState;
    for (const key of ['hands', 'devDeck', 'devCards', 'boughtThisTurn']) assert.equal(key in view, false);
    assert.equal(view.hand, null);
    assert.deepEqual(view.myDevCards, []);
    assert.equal(view.steal?.resource ?? null, null);
  }
  const file = manager.gameFile('catan', 'g1', new Date());
  assert.ok(file && 'file' in file);
  const seatView = file.file.steps.at(-1)?.views?.[1] as unknown as PublicGameState;
  assert.ok(seatView.hand !== null);
  assert.equal(total(seatView.hand), seatView.handCounts[1]);
});

test('dismissing a player mid-game leaves their pieces and play goes on', () => {
  const manager = gameWith(11, ['A', 'B', 'C', 'D']);
  let state = playUntil(manager, view => view.setup === null && view.rolled && view.currentPlayer === 4);
  manager.disconnect(ROOM, 4);
  ok(manager.requestDismiss(ROOM, 1, 4));
  ok(manager.voteDismiss(ROOM, 2, true));
  state = ok(manager.voteDismiss(ROOM, 3, true));
  assert.deepEqual(state.activePlayers, [1, 2, 3]);
  assert.equal(state.currentPlayer, 1);
  assert.equal(mine(state, 4).length >= 2, true);
  assert.equal(state.handCounts[4], 0);
  assert.equal(Object.values(state.roads).filter(owner => owner === 4).length >= 2, true);
  state = step(manager);
  assert.equal(state.isGameOver, false);
});

test('a seeded five-player game plays to 10 points on the large board', () => {
  const state = playUntil(gameWith(13, ['A', 'B', 'C', 'D', 'E']), view => view.isGameOver, 9000);
  assert.equal(state.layout.hexes.length, 30);
  assert.equal(state.winners.length, 1);
  assert.ok(state.points[state.winners[0]] >= 10);
});

test('a seeded six-player game plays to 10 points, and no table step shows a hand', () => {
  const manager = gameWith(17, ['A', 'B', 'C', 'D', 'E', 'F']);
  const state = playUntil(manager, view => view.isGameOver, 12000);
  assert.equal(state.layout.hexes.length, 30);
  assert.equal(state.winners.length, 1);
  assert.ok(state.points[state.winners[0]] >= 10);
  const steps = manager.history('catan', 'g1') ?? assert.fail('no history');
  assert.ok(steps.length > 50);
  for (const past of steps) {
    const view = past as unknown as PublicGameState;
    for (const key of ['hands', 'devDeck', 'devCards', 'boughtThisTurn']) assert.equal(key in view, false);
    assert.equal(view.hand, null);
    assert.deepEqual(view.myDevCards, []);
    assert.equal(view.steal?.resource ?? null, null);
  }
});
