import { finalStandings, waitingOn } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import { EDGES, HEX_VERTICES, VERTEX_COUNT, VERTEX_EDGES, VERTEX_HEXES } from './board.ts';
import { settlementSpotError } from './building.ts';
import { longestRoadOf } from './roads.ts';
import { createGameState, toPublicState } from './rules.ts';
import { winningPoints } from './state.ts';
import { resources, total } from './resources.ts';
import { catan } from './index.ts';
import { addPlayer, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import { act, acted, dice, game, holding, move, ok, played } from './testing.ts';
import type { Building, GameState, Seat } from './types.ts';

const corner = (hex: number, k: number) => HEX_VERTICES[hex][k];

function edgeBetween(a: number, b: number): number {
  const edge = EDGES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  assert.ok(edge >= 0, `no edge between ${a} and ${b}`);
  return edge;
}

// The edges round a hex from corner `from` for `count` steps
const ring = (hex: number, from: number, count: number) =>
  Array.from({ length: count }, (_, step) => edgeBetween(corner(hex, (from + step) % 6), corner(hex, (from + step + 1) % 6)));

const roadsOf = (seat: Seat, edges: number[]) => Object.fromEntries(edges.map(edge => [edge, seat]));
const settlement = (seat: Seat): Building => ({ seat, city: false });
const city = (seat: Seat): Building => ({ seat, city: true });

function lobby(...names: string[]): GameState {
  let state = createGameState('g');
  for (const name of names) {
    const result = addPlayer(catan, state, name, dice(6, 6, 1, 1, 2, 2, 3, 3));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// Plays the whole setup, each placer taking the first free intersection and its first edge
function playSetup(state: GameState): GameState {
  let next = state;
  while (next.setup) {
    const seat = next.currentPlayer ?? assert.fail('nobody to place');
    const vertex = Array.from({ length: VERTEX_COUNT }, (_, v) => v).find(v => settlementSpotError(next, v) === null) ?? assert.fail('no room');
    next = played({ ...next, started: true }, seat, { type: 'placeSettlement', vertex });
    const edge = VERTEX_EDGES[vertex].find(e => next.roads[e] === undefined) ?? assert.fail('no edge');
    next = played(next, seat, { type: 'placeRoad', edge });
  }
  return next;
}

// A rolled turn for Alice
const rolled = (overrides: Partial<GameState> = {}) => game({ rolled: true, ...overrides });

test('setup: a random board, the robber on the desert, a full bank and the snake order', () => {
  const state = lobby('Alice', 'Bob', 'Cara');
  assert.equal(state.layout.hexes.length, 19);
  assert.equal(state.layout.hexes[state.robber].resource, null);
  assert.deepEqual(state.bank, resources({ wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 }));
  assert.equal(state.devDeck.length, 25);
  assert.deepEqual(state.setup?.order, [1, 2, 3, 3, 2, 1]); // Alice rolled 12, Bob 2, Cara 4
  assert.equal(state.currentPlayer, 1);
});

test('setup: settlement then road, the second settlement produces, then the first player rolls', () => {
  const start = lobby('Alice', 'Bob', 'Cara');
  const done = playSetup(start);
  assert.equal(done.setup, null);
  assert.equal(done.turnHolder, 1);
  assert.equal(done.currentPlayer, 1);
  assert.equal(done.rolled, false);
  for (const seat of [1, 2, 3]) {
    const mine = Object.entries(done.buildings).filter(([, b]) => b.seat === seat).map(([v]) => Number(v));
    assert.equal(mine.length, 2);
    assert.equal(Object.values(done.roads).filter(owner => owner === seat).length, 2);
  }
  // Only the second settlement produced: Alice's second placement was the last of setup
  const order = done.log.filter(line => line.includes('took'));
  assert.equal(order.length, 3);
  const handTotal = (seat: Seat) => total(done.hands[seat]);
  assert.ok([1, 2, 3].every(seat => handTotal(seat) <= 3));
  assert.equal(Object.values(done.bank).reduce((a, b) => a + b, 0) + [1, 2, 3].reduce((a, s) => a + handTotal(s), 0), 95);
});

test('setup: the distance rule, and the road must touch the new settlement', () => {
  let state = { ...lobby('Alice', 'Bob', 'Cara'), started: true };
  const vertex = corner(9, 0);
  state = played(state, 1, { type: 'placeSettlement', vertex });
  assert.deepEqual(move(state, 1, { type: 'placeSettlement', vertex: corner(9, 3) }), { error: 'Place a road next to your new settlement' });
  assert.deepEqual(move(state, 1, { type: 'placeRoad', edge: edgeBetween(corner(9, 2), corner(9, 3)) }),
    { error: 'The road must touch the settlement you just placed' });
  assert.deepEqual(move(state, 1, { type: 'roll' }), { error: 'Place a road next to your new settlement' });
  state = played(state, 1, { type: 'placeRoad', edge: edgeBetween(corner(9, 0), corner(9, 1)) });
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(move(state, 2, { type: 'placeSettlement', vertex: corner(9, 1) }), { error: 'Too close to another settlement or city' });
  assert.deepEqual(move(state, 2, { type: 'placeSettlement', vertex }), { error: 'That intersection is taken' });
});

test('a roll produces for settlements and cities, but not under the robber', () => {
  // Hex 0 is wood with a 2, hex 1 wood with a 3
  const base = game({ buildings: { [corner(0, 0)]: settlement(1), [corner(0, 3)]: city(2), [corner(1, 0)]: settlement(3) } });
  const two = played(base, 1, { type: 'roll' }, dice(1, 1));
  assert.equal(two.hands[1].wood, 1);
  assert.equal(two.hands[2].wood, 2);
  assert.equal(two.hands[3].wood, 0);
  assert.equal(two.bank.wood, 16);
  assert.equal(two.rolled, true);
  assert.deepEqual(move(two, 1, { type: 'roll' }), { error: 'You have rolled this turn' });

  const robbed = played({ ...base, robber: 0 }, 1, { type: 'roll' }, dice(1, 1));
  assert.equal(robbed.hands[1].wood, 0);
  assert.match(robbed.gameStatus, /Nobody produced anything/);
});

test('when the bank cannot pay everyone a resource nobody takes it, unless only one player is owed it', () => {
  const base = game({ buildings: { [corner(0, 0)]: settlement(1), [corner(0, 3)]: city(2) } });
  const short = played({ ...base, bank: { ...base.bank, wood: 2 } }, 1, { type: 'roll' }, dice(1, 1));
  assert.equal(short.hands[1].wood, 0);
  assert.equal(short.hands[2].wood, 0);
  assert.equal(short.bank.wood, 2);

  const alone = game({ buildings: { [corner(0, 3)]: city(2) } });
  const one = played({ ...alone, bank: { ...alone.bank, wood: 1 } }, 1, { type: 'roll' }, dice(1, 1));
  assert.equal(one.hands[2].wood, 1);
  assert.equal(one.bank.wood, 0);
});

test('a 7: more than 7 cards discard half, then the robber moves and steals', () => {
  const buildings = { [corner(4, 0)]: settlement(2), [corner(4, 3)]: settlement(3) };
  let state = holding(holding(game({ buildings }), 1, { wood: 5, brick: 4 }), 2, { sheep: 7 });
  state = holding(state, 3, { ore: 8 });
  state = played(state, 1, { type: 'roll' }, dice(3, 4));
  assert.deepEqual(state.pending, { kind: 'discard', counts: { 1: 4, 3: 4 } });
  assert.deepEqual(move(state, 1, { type: 'moveRobber', hex: 4, victim: 2 }), { error: 'Wait for everyone to discard' });
  assert.deepEqual(act(state, 2, { type: 'discard', resources: { sheep: 3 } }), { error: 'You have nothing to discard' });
  assert.deepEqual(act(state, 1, { type: 'discard', resources: { wood: 3 } }), { error: 'Discard exactly 4 cards' });
  assert.deepEqual(act(state, 1, { type: 'discard', resources: { ore: 4 } }), { error: 'You do not have those cards' });
  state = acted(state, 1, { type: 'discard', resources: { wood: 2, brick: 2 } });
  assert.equal(total(state.hands[1]), 5);
  state = acted(state, 3, { type: 'discard', resources: { ore: 4 } });
  assert.deepEqual(state.pending, { kind: 'robber' });
  assert.equal(state.bank.ore, 19 - 8 + 4);

  assert.deepEqual(move(state, 1, { type: 'endTurn' }), { error: 'Move the robber first' });
  assert.deepEqual(move(state, 1, { type: 'moveRobber', hex: 18, victim: null }), { error: 'Move the robber to a different hex' });
  assert.deepEqual(move(state, 1, { type: 'moveRobber', hex: 4, victim: null }), { error: 'Choose a player to steal from' });
  assert.deepEqual(move(state, 1, { type: 'moveRobber', hex: 4, victim: 1 }), { error: 'Choose a player to steal from' });
  const stolen = played(state, 1, { type: 'moveRobber', hex: 4, victim: 2 });
  assert.equal(stolen.robber, 4);
  assert.equal(stolen.pending, null);
  assert.equal(stolen.hands[2].sheep, 6);
  assert.equal(stolen.hands[1].sheep, 1);
  assert.deepEqual(stolen.steal, { thief: 1, victim: 2, resource: 'sheep' });
  assert.equal(toPublicState(stolen, false, 3).steal?.resource, null);
  assert.equal(toPublicState(stolen, false, 2).steal?.resource, 'sheep');
  assert.doesNotMatch(stolen.gameStatus, /sheep/);
  // An empty hex: nobody to steal from
  const empty = played(state, 1, { type: 'moveRobber', hex: 16, victim: null });
  assert.equal(empty.robber, 16);
  assert.deepEqual(move(state, 1, { type: 'moveRobber', hex: 16, victim: 2 }), { error: 'Nobody there can be stolen from' });
});

test('a 7 with nobody over 7 cards goes straight to the robber', () => {
  const state = played(holding(game(), 1, { wood: 7 }), 1, { type: 'roll' }, dice(6, 1));
  assert.deepEqual(state.pending, { kind: 'robber' });
});

test('roads, settlements and cities cost their resources and follow the placement rules', () => {
  const home = corner(9, 0);
  const base = holding(rolled({ buildings: { [home]: settlement(1) } }), 1, { wood: 3, brick: 3, sheep: 1, wheat: 3, ore: 3 });
  const road1 = edgeBetween(corner(9, 0), corner(9, 1));
  const road2 = edgeBetween(corner(9, 1), corner(9, 2));
  assert.deepEqual(move(base, 1, { type: 'buildRoad', edge: road2 }), { error: 'A road must join one of your roads, settlements or cities' });
  let state = played(base, 1, { type: 'buildRoad', edge: road1 });
  assert.equal(state.roads[road1], 1);
  assert.equal(state.hands[1].wood, 2);
  assert.equal(state.bank.wood, 19 - 3 + 1);
  assert.deepEqual(move(state, 1, { type: 'buildRoad', edge: road1 }), { error: 'That path has a road' });
  assert.deepEqual(move(state, 1, { type: 'buildSettlement', vertex: corner(9, 1) }), { error: 'Too close to another settlement or city' });
  assert.deepEqual(move(state, 1, { type: 'buildSettlement', vertex: corner(9, 2) }), { error: 'A settlement must be next to one of your roads' });
  state = played(state, 1, { type: 'buildRoad', edge: road2 });
  state = played(state, 1, { type: 'buildSettlement', vertex: corner(9, 2) });
  assert.deepEqual(state.buildings[corner(9, 2)], settlement(1));
  assert.deepEqual(move(state, 1, { type: 'buildSettlement', vertex: corner(9, 4) }), { error: 'A settlement must be next to one of your roads' });
  state = played(state, 1, { type: 'buildCity', vertex: home });
  assert.deepEqual(state.buildings[home], city(1));
  assert.deepEqual(state.hands[1], resources({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }));
  assert.deepEqual(move(state, 1, { type: 'buildCity', vertex: corner(9, 2) }), { error: 'You need 2 wheat and 3 ore' });
  assert.deepEqual(move(state, 1, { type: 'buildRoad', edge: edgeBetween(corner(9, 2), corner(9, 3)) }), { error: 'You need 1 wood and 1 brick' });
  assert.deepEqual(move(state, 1, { type: 'buildCity', vertex: corner(9, 4) }), { error: 'Build a city on one of your settlements' });
});

test('building needs the roll, and pieces run out at 15 roads, 5 settlements and 4 cities', () => {
  const unrolled = holding(game({ buildings: { [corner(9, 0)]: settlement(1) } }), 1, { wood: 1, brick: 1 });
  assert.deepEqual(move(unrolled, 1, { type: 'buildRoad', edge: edgeBetween(corner(9, 0), corner(9, 1)) }), { error: 'Roll the dice first' });
  assert.deepEqual(move(unrolled, 1, { type: 'endTurn' }), { error: 'Roll the dice first' });

  const fiveSettlements = Object.fromEntries([0, 2, 4].map(k => [corner(9, k), settlement(1)]).concat([[corner(0, 0), settlement(1)], [corner(2, 0), settlement(1)]]));
  const full = holding(rolled({ buildings: fiveSettlements, roads: roadsOf(1, ring(9, 0, 1)) }), 1, { wood: 9, brick: 9, sheep: 9, wheat: 9, ore: 9 });
  const spot = corner(11, 0);
  const reach = rolled({ ...full, roads: { ...full.roads, ...roadsOf(1, VERTEX_EDGES[spot].slice(0, 1)) } });
  assert.deepEqual(move(reach, 1, { type: 'buildSettlement', vertex: spot }), { error: 'You have no settlements left' });

  const fourCities = Object.fromEntries([[corner(9, 0), city(1)], [corner(9, 2), city(1)], [corner(9, 4), city(1)], [corner(0, 0), city(1)], [corner(2, 0), settlement(1)]]);
  assert.deepEqual(move({ ...full, buildings: fourCities }, 1, { type: 'buildCity', vertex: corner(2, 0) }), { error: 'You have no cities left' });

  const fifteen = { ...full, roads: roadsOf(1, EDGES.map((_, e) => e).slice(0, 15)) };
  assert.deepEqual(move(fifteen, 1, { type: 'buildRoad', edge: 40 }), { error: 'You have no roads left' });
});

test('a road cannot join through another player\'s settlement', () => {
  const state = holding(rolled({
    roads: roadsOf(1, [edgeBetween(corner(9, 0), corner(9, 1))]),
    buildings: { [corner(9, 1)]: settlement(2), [corner(9, 5)]: settlement(1) }
  }), 1, { wood: 1, brick: 1 });
  assert.deepEqual(move(state, 1, { type: 'buildRoad', edge: edgeBetween(corner(9, 1), corner(9, 2)) }),
    { error: 'A road must join one of your roads, settlements or cities' });
  ok(move(state, 1, { type: 'buildRoad', edge: edgeBetween(corner(9, 5), corner(9, 4)) }));
});

test('bank trades: 4:1, 3:1 at a generic port and 2:1 at a matching port', () => {
  const plain = holding(rolled(), 1, { wood: 4 });
  const traded = played(plain, 1, { type: 'bankTrade', give: 'wood', get: 'ore' });
  assert.deepEqual(traded.hands[1], resources({ ore: 1 }));
  assert.equal(traded.bank.wood, 19);
  assert.equal(traded.bank.ore, 18);
  assert.deepEqual(move(holding(rolled(), 1, { wood: 3 }), 1, { type: 'bankTrade', give: 'wood', get: 'ore' }), { error: 'You need 4 wood' });
  assert.deepEqual(move(plain, 1, { type: 'bankTrade', give: 'wood', get: 'wood' }), { error: 'Trade for a different resource' });
  assert.deepEqual(move({ ...plain, bank: { ...plain.bank, ore: 0 } }, 1, { type: 'bankTrade', give: 'wood', get: 'ore' }), { error: 'The bank has no ore left' });

  // In the test layout the first four ports are 3:1 and the fifth is wood 2:1
  const generic = rolled({ buildings: { [EDGES[rolled().layout.ports[0].edge][0]]: settlement(1) } });
  assert.deepEqual(played(holding(generic, 1, { brick: 3 }), 1, { type: 'bankTrade', give: 'brick', get: 'ore' }).hands[1], resources({ ore: 1 }));
  const woodPort = rolled({ buildings: { [EDGES[rolled().layout.ports[4].edge][1]]: settlement(1) } });
  assert.deepEqual(played(holding(woodPort, 1, { wood: 2 }), 1, { type: 'bankTrade', give: 'wood', get: 'ore' }).hands[1], resources({ ore: 1 }));
  assert.deepEqual(move(holding(woodPort, 1, { brick: 3 }), 1, { type: 'bankTrade', give: 'brick', get: 'ore' }), { error: 'You need 4 brick' });
});

test('domestic trades: offered by the turn holder to one or all, answered as actions', () => {
  let state = holding(holding(holding(rolled(), 1, { wood: 2 }), 2, { ore: 1 }), 3, { ore: 2 });
  const offer = { type: 'offerTrade', to: 2, give: { wood: 1 }, get: { ore: 1 } };
  assert.deepEqual(act(state, 2, { ...offer, to: 1 }), { error: 'Only the player whose turn it is can offer a trade' });
  assert.deepEqual(act({ ...state, rolled: false }, 1, offer), { error: 'Roll the dice first' });
  assert.deepEqual(act(state, 1, { ...offer, get: {} }), { error: 'Each side must give at least one card' });
  assert.deepEqual(act(state, 1, { ...offer, give: { wood: 3 } }), { error: 'You do not have those cards' });
  assert.deepEqual(act(state, 1, { ...offer, get: { wood: 1 } }), { error: 'A resource cannot be on both sides' });
  assert.deepEqual(act(state, 1, { ...offer, to: 1 }), { error: 'Choose another player still in the game' });

  state = acted(state, 1, offer);
  assert.deepEqual(act(state, 1, offer), { error: 'Withdraw your open offer first' });
  assert.deepEqual(act(state, 3, { type: 'answerTrade', accept: true }), { error: 'There is no offer for you to answer' });
  const declined = acted(state, 2, { type: 'answerTrade', accept: false });
  assert.equal(declined.trade, null);
  const accepted = acted(state, 2, { type: 'answerTrade', accept: true });
  assert.equal(accepted.trade, null);
  assert.deepEqual(accepted.hands[1], resources({ wood: 1, ore: 1 }));
  assert.deepEqual(accepted.hands[2], resources({ wood: 1 }));

  // To everyone: a decline leaves it open for the rest, and the first to accept trades
  let open = acted(holding(state, 1, { wood: 2 }), 1, { type: 'cancelTrade' });
  assert.equal(open.trade, null);
  open = acted(open, 1, { type: 'offerTrade', to: null, give: { wood: 2 }, get: { ore: 2 } });
  assert.deepEqual(act(open, 2, { type: 'answerTrade', accept: true }), { error: 'You do not have those cards' });
  open = acted(open, 2, { type: 'answerTrade', accept: false });
  assert.notEqual(open.trade, null);
  const done = acted(open, 3, { type: 'answerTrade', accept: true });
  assert.deepEqual(done.hands[3], resources({ wood: 2 }));
  assert.deepEqual(done.hands[1], resources({ ore: 2 }));

  // Ending the turn drops an open offer
  const ended = played(open, 1, { type: 'endTurn' });
  assert.equal(ended.trade, null);
  assert.equal(ended.currentPlayer, 2);
});

test('development cards: bought, not played the turn they are bought, one a turn', () => {
  let state = holding(rolled({ devDeck: ['knight', 'knight', 'monopoly'] }), 1, { sheep: 2, wheat: 2, ore: 2 });
  state = played(state, 1, { type: 'buyDevCard' });
  assert.deepEqual(state.boughtThisTurn, ['knight']);
  assert.deepEqual(state.devDeck, ['knight', 'monopoly']);
  assert.deepEqual(move(state, 1, { type: 'playKnight' }), { error: 'A card bought this turn can be played from your next turn' });
  assert.match(state.gameStatus, /bought a development card$/);
  const view = toPublicState(state, false, 2);
  assert.equal(view.devCounts[1], 1);
  assert.deepEqual(view.myNewDevCards, []);
  assert.deepEqual(toPublicState(state, false, 1).myNewDevCards, ['knight']);

  state = played(state, 1, { type: 'endTurn' });
  assert.deepEqual(state.devCards[1], ['knight']);
  state = { ...state, turnHolder: 1, currentPlayer: 1, devCards: { ...state.devCards, 1: ['knight', 'knight'] } };
  // A Knight may be played before rolling, and the turn then goes on to the roll
  state = played(state, 1, { type: 'playKnight' });
  assert.deepEqual(state.pending, { kind: 'robber' });
  assert.equal(state.knights[1], 1);
  state = played(state, 1, { type: 'moveRobber', hex: 9, victim: null });
  assert.equal(state.rolled, false);
  assert.deepEqual(move(state, 1, { type: 'playKnight' }), { error: 'You have played a development card this turn' });
  ok(move(state, 1, { type: 'roll' }));
});

test('Road Building, Year of Plenty and Monopoly', () => {
  const home = corner(9, 0);
  const base = rolled({ buildings: { [home]: settlement(1) }, devCards: { 1: ['roadBuilding', 'yearOfPlenty', 'monopoly'], 2: [], 3: [] } });

  let roads = played(base, 1, { type: 'playRoadBuilding' });
  assert.deepEqual(roads.pending, { kind: 'roadBuilding', roads: 2 });
  assert.deepEqual(move(roads, 1, { type: 'endTurn' }), { error: 'Place your free roads first' });
  roads = played(roads, 1, { type: 'placeRoad', edge: edgeBetween(corner(9, 0), corner(9, 1)) });
  roads = played(roads, 1, { type: 'placeRoad', edge: edgeBetween(corner(9, 1), corner(9, 2)) });
  assert.equal(roads.pending, null);
  assert.equal(Object.keys(roads.roads).length, 2);
  assert.deepEqual(roads.bank, base.bank);

  const plenty = played(base, 1, { type: 'playYearOfPlenty', resources: ['ore', 'ore'] });
  assert.deepEqual(plenty.hands[1], resources({ ore: 2 }));
  assert.equal(plenty.bank.ore, 17);
  assert.deepEqual(move({ ...base, bank: { ...base.bank, ore: 1 } }, 1, { type: 'playYearOfPlenty', resources: ['ore', 'ore'] }),
    { error: 'The bank does not have those cards' });

  const rich = holding(holding(base, 2, { wheat: 3, ore: 1 }), 3, { wheat: 2 });
  const monopoly = played(rich, 1, { type: 'playMonopoly', resource: 'wheat' });
  assert.equal(monopoly.hands[1].wheat, 5);
  assert.deepEqual(monopoly.hands[2], resources({ ore: 1 }));
  assert.deepEqual(monopoly.hands[3], resources({}));
  assert.deepEqual(move(game(), 1, { type: 'playMonopoly', resource: 'wheat' }), { error: 'You have no Monopoly card' });
});

test('Road Building with one road piece left places just one', () => {
  const fourteen = EDGES.map((_, edge) => edge).slice(0, 14);
  const state = rolled({ roads: roadsOf(1, fourteen), devCards: { 1: ['roadBuilding'], 2: [], 3: [] } });
  const playedCard = played(state, 1, { type: 'playRoadBuilding' });
  assert.deepEqual(playedCard.pending, { kind: 'roadBuilding', roads: 1 });
});

test('Longest Road: 5 or more, a tie keeps it, and a broken road can move it or set it aside', () => {
  const alice = ring(9, 0, 5);
  let state = holding(rolled({ roads: roadsOf(1, alice.slice(0, 4)) }), 1, { wood: 1, brick: 1 });
  assert.equal(state.longestRoad, null);
  state = played(state, 1, { type: 'buildRoad', edge: alice[4] });
  assert.equal(longestRoadOf(state, 1), 5);
  assert.equal(state.longestRoad, 1);
  assert.match(state.gameStatus, /Alice takes Longest Road/);

  // Bob ties at 5 and does not take it, then goes to 6 and does
  const bob = ring(0, 0, 6);
  let tied = holding({ ...state, turnHolder: 2, currentPlayer: 2, roads: { ...state.roads, ...roadsOf(2, bob.slice(0, 4)) } }, 2, { wood: 2, brick: 2 });
  tied = played(tied, 2, { type: 'buildRoad', edge: bob[4] });
  assert.equal(tied.longestRoad, 1);
  tied = played(tied, 2, { type: 'buildRoad', edge: bob[5] });
  assert.equal(tied.longestRoad, 2);

  // Bob's settlement breaks Alice's 5 into 2 and 3, and nobody else has 5: the card is set aside
  const spur = VERTEX_EDGES[corner(9, 2)].find(edge => !alice.includes(edge)) ?? assert.fail('no spur');
  const broken = holding({ ...state, turnHolder: 2, currentPlayer: 2, roads: { ...state.roads, [spur]: 2 } },
    2, { wood: 1, brick: 1, sheep: 1, wheat: 1 });
  const cut = played(broken, 2, { type: 'buildSettlement', vertex: corner(9, 2) });
  assert.equal(longestRoadOf(cut, 1), 3);
  assert.equal(cut.longestRoad, null);
  assert.match(cut.gameStatus, /Nobody holds Longest Road now/);
});

test('Largest Army: the first to 3 Knights, taken only by playing more', () => {
  const knights = (seat: Seat, count: number) => ({ ...game().knights, [seat]: count });
  let state = game({ knights: knights(1, 2), devCards: { 1: ['knight'], 2: ['knight'], 3: [] } });
  state = played(state, 1, { type: 'playKnight' });
  assert.equal(state.largestArmy, 1);
  state = played(state, 1, { type: 'moveRobber', hex: 9, victim: null });
  const bobsTurn = { ...state, turnHolder: 2, currentPlayer: 2, devPlayed: false, knights: { ...state.knights, 2: 2 } };
  const tied = played(bobsTurn, 2, { type: 'playKnight' });
  assert.equal(tied.knights[2], 3);
  assert.equal(tied.largestArmy, 1);
  const ahead = played({ ...bobsTurn, knights: { ...bobsTurn.knights, 2: 3 } }, 2, { type: 'playKnight' });
  assert.equal(ahead.largestArmy, 2);
});

test('10 points wins, but only on your own turn; Victory Point cards count and are shown at the end', () => {
  // Four cities and a settlement is 9; Longest Road takes Alice to 11
  const buildings = Object.fromEntries([0, 2, 4].map(k => [corner(9, k), city(1)]).concat([[corner(0, 0), city(1)], [corner(2, 0), settlement(1)]]));
  const nine = holding(rolled({ buildings, roads: roadsOf(1, ring(9, 0, 4)) }), 1, { wood: 1, brick: 1 });
  assert.equal(nine.isGameOver, false);
  const won = played(nine, 1, { type: 'buildRoad', edge: ring(9, 4, 1)[0] });
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.equal(won.currentPlayer, null);
  assert.match(won.gameStatus, /Alice wins with 11 points/);

  // A Victory Point card bought this turn counts at once
  const vp = holding(rolled({ buildings, devDeck: ['victoryPoint'] }), 1, { sheep: 1, wheat: 1, ore: 1 });
  const bought = played(vp, 1, { type: 'buyDevCard' });
  assert.equal(bought.isGameOver, true);
  assert.equal(toPublicState(bought, false, 2).points[1], 10);
  assert.equal(toPublicState({ ...bought, isGameOver: false }, false, 2).points[1], 9);

  // Bob already has 10 points during Alice's turn, and wins only when his own turn begins
  const bobTen = rolled({
    buildings: Object.fromEntries([0, 2, 4].map(k => [corner(9, k), city(2)]).concat([[corner(0, 0), city(2)], [corner(2, 0), city(2)]]))
  });
  assert.equal(bobTen.isGameOver, false);
  const turn = played(bobTen, 1, { type: 'endTurn' });
  assert.equal(turn.isGameOver, true);
  assert.deepEqual(turn.winners, [2]);
});

test('invalid moves', () => {
  const state = rolled();
  for (const bad of [null, 'roll', 7, {}, { type: 'fly' }, { type: 'buildRoad', edge: -1 }, { type: 'buildRoad', edge: 72 },
    { type: 'buildRoad', edge: 1.5 }, { type: 'buildSettlement', vertex: 54 }, { type: 'buildCity' },
    { type: 'moveRobber', hex: 19, victim: null }, { type: 'moveRobber', hex: 3, victim: 'Bob' },
    { type: 'playYearOfPlenty', resources: ['ore'] }, { type: 'playYearOfPlenty', resources: ['ore', 'gold'] },
    { type: 'playMonopoly', resource: 'gold' }, { type: 'bankTrade', give: 'wood' }]) {
    assert.deepEqual(move(state, 1, bad), { error: 'Invalid move' }, JSON.stringify(bad));
  }
  assert.deepEqual(move(state, 1, { type: 'placeSettlement', vertex: 3 }), { error: 'You cannot do that now' });
  assert.deepEqual(move(state, 4, { type: 'endTurn' }), { error: 'You are not in this game' });
  for (const bad of [null, { type: 'steal' }, { type: 'discard', resources: { wood: -1 } }, { type: 'discard', resources: { wood: 0.5 } },
    { type: 'offerTrade', to: 2, give: 'wood', get: {} }, { type: 'answerTrade', accept: 'yes' }]) {
    assert.ok('error' in act(state, 1, bad), JSON.stringify(bad));
  }
  assert.deepEqual(act(state, 9, { type: 'cancelTrade' }), { error: 'You are not in this game' });
  assert.deepEqual(act(state, 1, { type: 'cancelTrade' }), { error: 'You have no open offer' });
  assert.deepEqual(act({ ...state, isGameOver: true }, 1, { type: 'cancelTrade' }), { error: 'The game is over' });
});

test('a disconnected player owing a discard has it made for them at random', () => {
  const buildings = { [corner(4, 0)]: settlement(2), [corner(4, 3)]: settlement(3) };
  let state = holding(holding(game({ buildings }), 1, { wood: 5, brick: 4 }), 3, { ore: 8 });
  // Cara is already gone when the 7 is rolled, and Alice drops while she still owes hers
  state = played({ ...state, disconnected: [3] }, 1, { type: 'roll' }, dice(3, 4));
  assert.deepEqual(state.pending, { kind: 'discard', counts: { 1: 4 } });
  assert.equal(total(state.hands[3]), 4);
  state = disconnectPlayer(catan, state, 1, dice());
  assert.deepEqual(state.pending, { kind: 'robber' });
  assert.equal(total(state.hands[1]), 5);
});

test('dismissed player mid-turn', () => {
  // Bob's turn, with a discard and a trade waiting on Cara and Dan in a four-player game
  const four = game({
    activePlayers: [1, 2, 3, 4],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' },
    hands: { ...game().hands, 4: resources({}) },
    devCards: { 1: [], 2: ['knight'], 3: [], 4: [] },
    knights: { 1: 0, 2: 3, 3: 0, 4: 0 },
    largestArmy: 2,
    turnHolder: 2,
    currentPlayer: 2,
    rolled: true,
    buildings: { [corner(9, 0)]: settlement(2), [corner(4, 0)]: settlement(3) },
    boughtThisTurn: ['victoryPoint']
  });
  const withHands = holding(holding(four, 2, { wood: 3, ore: 5 }), 3, { sheep: 9 });
  const discarding = { ...withHands, rolled: true, pending: { kind: 'discard' as const, counts: { 3: 4 } } };

  // Cara leaves owing a discard: the robber moves on
  const caraGone = removePlayer(catan, { ...discarding, disconnected: [3] }, 3);
  assert.deepEqual(caraGone.pending, { kind: 'robber' });
  assert.equal(caraGone.bank.sheep, 19);
  assert.deepEqual(caraGone.buildings[corner(4, 0)], settlement(3));
  assert.equal(caraGone.currentPlayer, 2);

  // Bob leaves on his turn: his cards go back, the next player's turn begins, and his Largest Army is set aside
  const offered = ok(act({ ...withHands, pending: null }, 2, { type: 'offerTrade', to: null, give: { wood: 1 }, get: { sheep: 1 } }));
  const bobGone = removePlayer(catan, { ...offered, disconnected: [2] }, 2);
  assert.equal(bobGone.turnHolder, 3);
  assert.equal(bobGone.currentPlayer, 3);
  assert.equal(bobGone.rolled, false);
  assert.equal(bobGone.trade, null);
  assert.equal(bobGone.bank.wood, 19);
  assert.equal(bobGone.bank.ore, 19);
  assert.equal(bobGone.largestArmy, null);
  assert.deepEqual(bobGone.devCards[3], []);
  assert.equal(bobGone.isGameOver, false);
  ok(move(bobGone, 3, { type: 'roll' }, dice(2, 2)));

  // Down to two players the game ends and the leader wins
  const three = game({ buildings: { [corner(9, 0)]: city(2), [corner(4, 0)]: settlement(3) }, disconnected: [1] });
  const ended = removePlayer(catan, three, 1);
  assert.equal(ended.isGameOver, true);
  assert.deepEqual(ended.winners, [2]);
  assert.match(ended.gameStatus, /Bob wins with 2 points/);
});

test('a player dismissed during setup loses their placements and setup goes on', () => {
  let state = { ...lobby('Alice', 'Bob', 'Cara', 'Dan'), started: true };
  assert.deepEqual(state.setup?.order, [1, 2, 3, 4, 4, 3, 2, 1]);
  state = played(state, 1, { type: 'placeSettlement', vertex: corner(9, 0) });
  state = played(state, 1, { type: 'placeRoad', edge: edgeBetween(corner(9, 0), corner(9, 1)) });
  state = played(state, 2, { type: 'placeSettlement', vertex: corner(0, 0) });
  state = removePlayer(catan, { ...state, disconnected: [2] }, 2);
  assert.deepEqual(state.setup, { order: [1, 3, 4, 4, 3, 1], step: 1, settlement: null });
  assert.equal(state.currentPlayer, 3);
  assert.deepEqual(state.buildings[corner(0, 0)], settlement(2));
});

test('a trade offer to a player who disconnects is dropped', () => {
  const offered = acted(holding(rolled(), 1, { wood: 1 }), 1, { type: 'offerTrade', to: 2, give: { wood: 1 }, get: { ore: 1 } });
  const state = catan.onPlayerDisconnected?.({ ...offered, disconnected: [2] }, 2, dice()) ?? assert.fail('no hook');
  assert.equal(state.trade, null);
});

test('table view hides hands over every step of a short game', () => {
  let state = playSetup({ ...lobby('Alice', 'Bob', 'Cara'), started: true });
  const steps: GameState[] = [state];
  const random = dice(3, 4, 2, 3, 6, 6, 4, 3, 5, 5, 1, 6);
  for (let turn = 0; turn < 6; turn++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to move');
    state = played(state, seat, { type: 'roll' }, random);
    steps.push(state);
    if (state.pending?.kind === 'discard') {
      for (const [who, count] of Object.entries(state.pending.counts)) {
        const hand = state.hands[Number(who)];
        const cards = resources({});
        let left = count;
        for (const resource of ['wood', 'brick', 'sheep', 'wheat', 'ore'] as const) {
          const take = Math.min(left, hand[resource]);
          cards[resource] = take;
          left -= take;
        }
        state = acted(state, Number(who), { type: 'discard', resources: cards });
      }
    }
    if (state.pending?.kind === 'robber') {
      const hex = state.robber === 9 ? 10 : 9;
      const victims = [1, 2, 3].filter(other => other !== seat && HEX_VERTICES[hex].some(v => state.buildings[v]?.seat === other) && total(state.hands[other]) > 0);
      state = played(state, seat, { type: 'moveRobber', hex, victim: victims[0] ?? null }, dice(1));
      steps.push(state);
    }
    state = played(state, seat, { type: 'endTurn' });
    steps.push(state);
  }
  for (const step of steps) {
    const table = toPublicState(step, false, null);
    for (const key of ['hands', 'devDeck', 'devCards', 'boughtThisTurn']) assert.equal(key in table, false, key);
    assert.equal(table.hand, null);
    assert.deepEqual(table.myDevCards, []);
    assert.deepEqual(table.myNewDevCards, []);
    assert.equal(table.steal?.resource ?? null, null);
    assert.equal(table.devDeckCount, step.devDeck.length);
    for (const seat of [1, 2, 3]) {
      assert.equal(table.handCounts[seat], total(step.hands[seat]));
      assert.deepEqual(toPublicState(step, false, seat).hand, step.hands[seat]);
    }
  }
});

test('the game ends at the chosen points', () => {
  // Four cities and a settlement is 9 points; a Development Card that is not a Victory Point card adds none
  const buildings = Object.fromEntries([0, 2, 4].map(k => [corner(9, k), city(1)]).concat([[corner(0, 0), city(1)], [corner(2, 0), settlement(1)]]));
  const buy = (target: number) => played(holding(
    rolled({ buildings, devDeck: ['knight'], houseRules: withRules({ targetScore: target }) }), 1, { sheep: 1, wheat: 1, ore: 1 }
  ), 1, { type: 'buyDevCard' });
  const won = buy(8);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.match(won.gameStatus, /Alice wins with 9 points/);
  assert.equal(buy(10).isGameOver, false);
  assert.equal(buy(12).isGameOver, false);
  assert.equal(winningPoints({}), 10);
});

const friendly = withRules({ friendlyRobber: true });

test('the friendly robber cannot steal from a player with 2 points', () => {
  const buildings = { [corner(4, 0)]: settlement(2), [corner(4, 3)]: settlement(2) };
  const state = holding(game({ buildings, pending: { kind: 'robber' }, rolled: true, houseRules: friendly }), 2, { sheep: 3 });
  assert.deepEqual(move(state, 1, { type: 'moveRobber', hex: 4, victim: 2 }), { error: 'Nobody there can be stolen from' });
  const moved = played(state, 1, { type: 'moveRobber', hex: 4, victim: null });
  assert.equal(moved.robber, 4);
  assert.equal(moved.hands[2].sheep, 3);
  assert.equal(moved.steal, null);
  // Without the rule the same move steals
  const standard = { ...state, houseRules: withRules({ friendlyRobber: false }) };
  assert.deepEqual(move(standard, 1, { type: 'moveRobber', hex: 4, victim: null }), { error: 'Choose a player to steal from' });
});

test('it can steal from a player with 3', () => {
  const buildings = { [corner(4, 0)]: city(2), [corner(4, 3)]: settlement(2) };
  const state = holding(game({ buildings, pending: { kind: 'robber' }, rolled: true, houseRules: friendly }), 2, { sheep: 3 });
  const stolen = played(state, 1, { type: 'moveRobber', hex: 4, victim: 2 });
  assert.equal(stolen.hands[2].sheep, 2);
  assert.equal(stolen.hands[1].sheep, 1);
});

test('hidden Victory Point cards do not count', () => {
  const buildings = { [corner(4, 0)]: settlement(2), [corner(4, 3)]: settlement(2) };
  const hidden = holding(game({
    buildings, pending: { kind: 'robber' }, rolled: true, houseRules: friendly,
    devCards: { 1: [], 2: ['victoryPoint', 'victoryPoint'], 3: [] }
  }), 2, { sheep: 3 });
  assert.deepEqual(move(hidden, 1, { type: 'moveRobber', hex: 4, victim: 2 }), { error: 'Nobody there can be stolen from' });
});

test('two players can play, and one cannot', () => {
  assert.notDeepEqual(act(game({ activePlayers: [1, 2] }), 1, { type: 'cancelTrade' }), { error: 'Waiting for more players' });
  assert.deepEqual(act(game({ activePlayers: [1] }), 1, { type: 'cancelTrade' }), { error: 'Waiting for more players' });
});

test('finalStandings ranks by victory points', () => {
  const state: GameState = {
    ...createGameState('t'), activePlayers: [1, 2, 3], isGameOver: true, winners: [1], longestRoad: 1,
    devCards: { 1: ['victoryPoint', 'victoryPoint'], 2: ['victoryPoint'], 3: ['victoryPoint'] }
  };
  assert.deepEqual(finalStandings(state), [
    { seat: 1, place: 1, score: '4 victory points' },
    { seat: 2, place: 2, score: '1 victory point' }, { seat: 3, place: 2, score: '1 victory point' }
  ]);
});

test('waitingOn names the seats owing a discard and those who may answer an offer', () => {
  const discarding = game({ pending: { kind: 'discard', counts: { 1: 4, 3: 2 } } });
  assert.deepEqual(waitingOn(discarding), [1, 3]);
  const open = { from: 1, to: null, give: resources({ wood: 1 }), get: resources({ ore: 1 }), declined: [3] };
  assert.deepEqual(waitingOn(game({ trade: open })), [2]);
  assert.deepEqual(waitingOn(game({ trade: { ...open, to: 3, declined: [] } })), [3]);
  assert.deepEqual(waitingOn(game({ specialBuild: { builders: [2, 3] } })), [2]);
  assert.deepEqual(waitingOn(game()), []);
});
