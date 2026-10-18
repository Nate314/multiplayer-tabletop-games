// Placing armies (the starting armies, and reinforcements each turn) and the one fortify move that ends a turn
import { NEIGHBORS, territoryName } from './map.ts';
import { mustTrade } from './cards.ts';
import { nameOf, note, plural } from './state.ts';
import type { GameState, Placements, Result, Seat } from './types.ts';

function placementError(state: GameState, seat: Seat, placements: Placements): string | null {
  const entries = Object.entries(placements);
  if (entries.length === 0) return 'Choose where to place your armies';
  for (const [territory, count] of entries) {
    if (state.owners[territory] !== seat) return `You do not hold ${territoryName(territory)}`;
    if (!Number.isInteger(count) || count < 1) return 'Place a whole number of armies, at least 1, on each territory';
  }
  return null;
}

function addArmies(state: GameState, placements: Placements): GameState {
  const armies = { ...state.armies };
  for (const [territory, count] of Object.entries(placements)) armies[territory] += count;
  return { ...state, armies };
}

function describePlacements(state: GameState, seat: Seat, placements: Placements): string {
  const parts = Object.entries(placements).map(([territory, count]) => `${count} on ${territoryName(territory)}`);
  return `${nameOf(state, seat)} placed ${parts.join(', ')}`;
}

function total(placements: Placements): number {
  return Object.values(placements).reduce((sum, count) => sum + count, 0);
}

// Every starting army a player has left, in one move
export function placeStarting(state: GameState, seat: Seat, placements: Placements): Result<GameState> {
  const left = state.setupLeft[seat] ?? 0;
  const error = placementError(state, seat, placements) ??
    (total(placements) !== left ? `Place all ${plural(left, 'army', 'armies')} you have left` : null);
  if (error) return { error };
  const placed = addArmies({ ...state, setupLeft: { ...state.setupLeft, [seat]: 0 } }, placements);
  return { state: note(placed, describePlacements(state, seat, placements)) };
}

// Some or all of this turn's reinforcements; once none are left the attack phase begins
export function placeReinforcements(state: GameState, seat: Seat, placements: Placements): Result<GameState> {
  if (mustTrade(state, seat)) return { error: 'You hold 5 or more cards: trade a set first' };
  const error = placementError(state, seat, placements) ??
    (total(placements) > state.reinforcements ? `You have only ${plural(state.reinforcements, 'army', 'armies')} to place` : null);
  if (error) return { error };
  const reinforcements = state.reinforcements - total(placements);
  const placed = addArmies({ ...state, reinforcements }, placements);
  const next = reinforcements === 0 ? { ...placed, phase: 'attack' as const, midTurnTrade: false } : placed;
  return { state: note(next, describePlacements(state, seat, placements)) };
}

// The territories reachable from `from` through territories the same player holds, not counting `from` itself
export function connectedTerritories(state: Pick<GameState, 'owners'>, from: string): string[] {
  const owner = state.owners[from];
  if (owner === null || owner === undefined) return [];
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of NEIGHBORS[current] ?? []) {
      if (seen.has(neighbor) || state.owners[neighbor] !== owner) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  seen.delete(from);
  return [...seen];
}

// Moves armies once from one territory to another connected through the player's own territories; the turn then ends
export function fortify(state: GameState, seat: Seat, from: string, to: string, armies: number): Result<GameState> {
  if (state.phase !== 'attack' && state.phase !== 'fortify') return { error: 'Fortify after placing your armies' };
  if (state.owners[from] !== seat || state.owners[to] !== seat) return { error: 'Fortify between two territories you hold' };
  if (!connectedTerritories(state, from).includes(to)) {
    return { error: `${territoryName(to)} is not connected to ${territoryName(from)} through your territories` };
  }
  const most = state.armies[from] - 1;
  if (!Number.isInteger(armies) || armies < 1 || armies > most) {
    return { error: most < 1 ? 'One army must stay behind' : `Move 1 to ${most} armies` };
  }
  const moved = { ...state, armies: { ...state.armies, [from]: state.armies[from] - armies, [to]: state.armies[to] + armies } };
  return { state: note(moved, `${nameOf(state, seat)} moved ${plural(armies, 'army', 'armies')} from ${territoryName(from)} to ${territoryName(to)}`) };
}
