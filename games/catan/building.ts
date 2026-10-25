// Where pieces may go and building them: roads, settlements and cities, with their costs and piece limits,
// the two setup rounds, and free roads from a Road Building card
import { boardOf } from './board.ts';
import { COSTS, add, covers, describeResources, noResources, subtract } from './resources.ts';
import { nameOf, note, startTurn } from './state.ts';
import type { GameState, Resources, Result, Seat } from './types.ts';

export const PIECES = { road: 15, settlement: 5, city: 4 };

// What placement checks read; the browser has all of it too
type Placement = Pick<GameState, 'layout' | 'roads' | 'buildings'>;

export function piecesLeft(state: Placement, seat: Seat): { road: number; settlement: number; city: number } {
  const mine = Object.values(state.buildings).filter(building => building.seat === seat);
  return {
    road: PIECES.road - Object.values(state.roads).filter(owner => owner === seat).length,
    settlement: PIECES.settlement - mine.filter(building => !building.city).length,
    city: PIECES.city - mine.filter(building => building.city).length
  };
}

// An empty intersection with no building on any neighbouring intersection (the distance rule)
export function settlementSpotError(state: Placement, vertex: number): string | null {
  if (state.buildings[vertex]) return 'That intersection is taken';
  if (boardOf(state.layout).vertexNeighbors[vertex].some(other => state.buildings[other])) return 'Too close to another settlement or city';
  return null;
}

export function settlementError(state: Placement, seat: Seat, vertex: number): string | null {
  const spot = settlementSpotError(state, vertex);
  if (spot) return spot;
  if (!boardOf(state.layout).vertexEdges[vertex].some(edge => state.roads[edge] === seat)) return 'A settlement must be next to one of your roads';
  if (piecesLeft(state, seat).settlement <= 0) return 'You have no settlements left';
  return null;
}

export function cityError(state: Placement, seat: Seat, vertex: number): string | null {
  const building = state.buildings[vertex];
  if (!building || building.seat !== seat || building.city) return 'Build a city on one of your settlements';
  if (piecesLeft(state, seat).city <= 0) return 'You have no cities left';
  return null;
}

// A road joins one of your buildings, or one of your roads through an intersection no other player has built on
export function roadError(state: Placement, seat: Seat, edge: number): string | null {
  if (state.roads[edge] !== undefined) return 'That path has a road';
  if (piecesLeft(state, seat).road <= 0) return 'You have no roads left';
  const board = boardOf(state.layout);
  const joins = board.edges[edge].some(vertex => {
    const building = state.buildings[vertex];
    if (building) return building.seat === seat;
    return board.vertexEdges[vertex].some(other => other !== edge && state.roads[other] === seat);
  });
  return joins ? null : 'A road must join one of your roads, settlements or cities';
}

// Every path where `seat` could build a road now
export function roadSpots(state: Placement, seat: Seat): number[] {
  return boardOf(state.layout).edges.map((_, edge) => edge).filter(edge => roadError(state, seat, edge) === null);
}

function pay(state: GameState, seat: Seat, cost: Resources): Result<GameState> {
  const hand = state.hands[seat] ?? noResources();
  if (!covers(hand, cost)) return { error: `You need ${describeResources(cost)}` };
  return { state: { ...state, hands: { ...state.hands, [seat]: subtract(hand, cost) }, bank: add(state.bank, cost) } };
}

export function buildRoad(state: GameState, seat: Seat, edge: number): Result<GameState> {
  const error = roadError(state, seat, edge);
  if (error) return { error };
  const paid = pay(state, seat, COSTS.road);
  if ('error' in paid) return paid;
  return { state: note({ ...paid.state, roads: { ...state.roads, [edge]: seat } }, `${nameOf(state, seat)} built a road`) };
}

export function buildSettlement(state: GameState, seat: Seat, vertex: number): Result<GameState> {
  const error = settlementError(state, seat, vertex);
  if (error) return { error };
  const paid = pay(state, seat, COSTS.settlement);
  if ('error' in paid) return paid;
  const buildings = { ...state.buildings, [vertex]: { seat, city: false } };
  return { state: note({ ...paid.state, buildings }, `${nameOf(state, seat)} built a settlement`) };
}

export function buildCity(state: GameState, seat: Seat, vertex: number): Result<GameState> {
  const error = cityError(state, seat, vertex);
  if (error) return { error };
  const paid = pay(state, seat, COSTS.city);
  if ('error' in paid) return paid;
  const buildings = { ...state.buildings, [vertex]: { seat, city: true } };
  return { state: note({ ...paid.state, buildings }, `${nameOf(state, seat)} built a city`) };
}

// A free road from Road Building; the card's work ends after two, or sooner when no road can be placed
export function placeFreeRoad(state: GameState, seat: Seat, edge: number): Result<GameState> {
  const error = roadError(state, seat, edge);
  if (error) return { error };
  const roads = { ...state.roads, [edge]: seat };
  const left = state.pending?.kind === 'roadBuilding' ? state.pending.roads - 1 : 0;
  const done = left <= 0 || roadSpots({ layout: state.layout, roads, buildings: state.buildings }, seat).length === 0;
  const pending = done ? null : { kind: 'roadBuilding' as const, roads: left };
  return { state: note({ ...state, roads, pending }, `${nameOf(state, seat)} placed a free road`) };
}

// Setup: a settlement anywhere the distance rule allows, then a road touching it
export function placeSetupSettlement(state: GameState, seat: Seat, vertex: number): Result<GameState> {
  const { setup } = state;
  if (!setup) return { error: 'Setup is over' };
  if (setup.settlement !== null) return { error: 'Place a road next to your new settlement' };
  const error = settlementSpotError(state, vertex);
  if (error) return { error };
  const buildings = { ...state.buildings, [vertex]: { seat, city: false } };
  return { state: note({ ...state, buildings, setup: { ...setup, settlement: vertex } }, `${nameOf(state, seat)} placed a settlement`) };
}

export function placeSetupRoad(state: GameState, seat: Seat, edge: number): Result<GameState> {
  const { setup } = state;
  if (!setup) return { error: 'Setup is over' };
  const settlement = setup.settlement;
  if (settlement === null) return { error: 'Place a settlement first' };
  if (state.roads[edge] !== undefined) return { error: 'That path has a road' };
  if (!boardOf(state.layout).edges[edge].includes(settlement)) return { error: 'The road must touch the settlement you just placed' };
  const placed = note({ ...state, roads: { ...state.roads, [edge]: seat } }, `${nameOf(state, seat)} placed a road`);
  // The second round's settlement takes one of each resource around it
  const second = setup.order.slice(0, setup.step).includes(seat);
  const produced = second ? collectAround(placed, seat, settlement) : placed;
  return { state: advanceSetup({ ...produced, setup: { ...setup, settlement: null, step: setup.step + 1 } }) };
}

function collectAround(state: GameState, seat: Seat, vertex: number): GameState {
  const gained = noResources();
  for (const hex of boardOf(state.layout).vertexHexes[vertex]) {
    const resource = state.layout.hexes[hex].resource;
    if (resource && state.bank[resource] - gained[resource] > 0) gained[resource]++;
  }
  const hands = { ...state.hands, [seat]: add(state.hands[seat] ?? noResources(), gained) };
  return note({ ...state, hands, bank: subtract(state.bank, gained) }, `${nameOf(state, seat)} took ${describeResources(gained)}`);
}

// Once every placement is made, the first player's first turn begins
export function advanceSetup(state: GameState): GameState {
  const { setup } = state;
  if (!setup || setup.step < setup.order.length) return state;
  const first = setup.order[0];
  return note(startTurn({ ...state, setup: null }, first), `Setup is over: ${nameOf(state, first)} rolls first`);
}
