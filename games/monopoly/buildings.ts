// Houses, hotels and mortgages. Building and selling go evenly across a color group, and the bank has
// only 32 houses and 12 hotels. Buildings sell back for half their cost; a mortgage lifts for its value plus 10%.
import { BOARD, HOTEL, HOTEL_SUPPLY, HOUSE_SUPPLY, groupSpaces, ownable, streetAt, unmortgageCost } from './board.ts';
import { giveCash } from './money.ts';
import { ownsGroup } from './movement.ts';
import { money, nameOf, note } from './state.ts';
import type { GameState, Result, Seat } from './types.ts';

const HOUSES_PER_HOTEL = 4;

export function housesLeft(state: Pick<GameState, 'buildings'>): number {
  const used = Object.values(state.buildings).filter(level => level < HOTEL).reduce((sum, level) => sum + level, 0);
  return HOUSE_SUPPLY - used;
}

export function hotelsLeft(state: Pick<GameState, 'buildings'>): number {
  return HOTEL_SUPPLY - Object.values(state.buildings).filter(level => level === HOTEL).length;
}

const levelOf = (state: GameState, space: number) => state.buildings[space] ?? 0;

// Every space of the color group that `space` is in, or just `space` for a railroad or utility
function groupOf(space: number): number[] {
  const street = streetAt(space);
  return street ? groupSpaces(street.group) : [space];
}

export function groupHasBuildings(state: GameState, space: number): boolean {
  return groupOf(space).some(index => levelOf(state, index) > 0);
}

function withLevel(state: GameState, space: number, level: number): GameState {
  const { [space]: _old, ...rest } = state.buildings;
  return { ...state, buildings: level > 0 ? { ...rest, [space]: level } : rest };
}

// Why `seat` may not build on `space` now, or null if they may
export function buildError(state: GameState, seat: Seat, space: number): string | null {
  const street = streetAt(space);
  if (!street) return 'Only streets take houses';
  if (state.owners[space] !== seat) return 'You do not own that street';
  if (!ownsGroup(state, seat, space)) return 'You need every street of the color group to build';
  const group = groupSpaces(street.group);
  if (group.some(index => state.mortgaged.includes(index))) return 'Lift every mortgage in the group before building';
  const level = levelOf(state, space);
  if (level === HOTEL) return 'That street already has a hotel';
  if (level > Math.min(...group.map(index => levelOf(state, index)))) return 'Build evenly: the other streets of the group need a house first';
  if (level === HOUSES_PER_HOTEL ? hotelsLeft(state) === 0 : housesLeft(state) === 0) {
    return level === HOUSES_PER_HOTEL ? 'The bank has no hotels left' : 'The bank has no houses left';
  }
  if ((state.cash[seat] ?? 0) < street.houseCost) return `You need ${money(street.houseCost)} to build there`;
  return null;
}

// A hotel replaces four houses, which go back to the bank
export function build(state: GameState, seat: Seat, space: number): Result<GameState> {
  const error = buildError(state, seat, space);
  if (error) return { error };
  const street = streetAt(space)!;
  const level = levelOf(state, space) + 1;
  const built = giveCash(withLevel(state, space, level), seat, -street.houseCost);
  const what = level === HOTEL ? 'a hotel' : `house ${level}`;
  return { state: note(built, `${nameOf(state, seat)} built ${what} on ${street.name} for ${money(street.houseCost)}`) };
}

export function sellError(state: GameState, seat: Seat, space: number): string | null {
  const street = streetAt(space);
  if (!street || state.owners[space] !== seat) return 'You have no buildings there';
  const level = levelOf(state, space);
  if (level === 0) return 'You have no buildings there';
  if (level < Math.max(...groupSpaces(street.group).map(index => levelOf(state, index)))) {
    return 'Sell evenly: sell from the streets of the group with the most buildings first';
  }
  return null;
}

// A hotel sells back as four houses when the bank has them, for half the house cost. When it does not, the hotel
// sells outright for half of what it took to build (five times the house cost).
export function sellBuilding(state: GameState, seat: Seat, space: number): Result<GameState> {
  const error = sellError(state, seat, space);
  if (error) return { error };
  const street = streetAt(space)!;
  const level = levelOf(state, space);
  const outright = level === HOTEL && housesLeft(state) < HOUSES_PER_HOTEL;
  const nextLevel = outright ? 0 : level - 1;
  const refund = (street.houseCost / 2) * (outright ? HOTEL : 1);
  const sold = giveCash(withLevel(state, space, nextLevel), seat, refund);
  const what = level === HOTEL ? 'a hotel' : 'a house';
  return { state: note(sold, `${nameOf(state, seat)} sold ${what} on ${street.name} for ${money(refund)}`) };
}

// Every building is sold back to the bank at half its cost; returns the new state and what was raised
export function sellAllBuildings(state: GameState, seat: Seat): { state: GameState; raised: number } {
  let raised = 0;
  let buildings = state.buildings;
  for (const [key, level] of Object.entries(state.buildings)) {
    const space = Number(key);
    if (state.owners[space] !== seat) continue;
    raised += ((streetAt(space)?.houseCost ?? 0) / 2) * level;
    const { [space]: _gone, ...rest } = buildings;
    buildings = rest;
  }
  return { state: giveCash({ ...state, buildings }, seat, raised), raised };
}

export function mortgageError(state: GameState, seat: Seat, space: number): string | null {
  if (!ownable(space) || state.owners[space] !== seat) return 'You do not own that property';
  if (state.mortgaged.includes(space)) return 'That property is already mortgaged';
  if (groupHasBuildings(state, space)) return 'Sell every building in the color group first';
  return null;
}

export function mortgage(state: GameState, seat: Seat, space: number): Result<GameState> {
  const error = mortgageError(state, seat, space);
  if (error) return { error };
  const property = ownable(space)!;
  const next = giveCash({ ...state, mortgaged: [...state.mortgaged, space] }, seat, property.mortgage);
  return { state: note(next, `${nameOf(state, seat)} mortgaged ${property.name} for ${money(property.mortgage)}`) };
}

export function unmortgageError(state: GameState, seat: Seat, space: number): string | null {
  if (!ownable(space) || state.owners[space] !== seat) return 'You do not own that property';
  if (!state.mortgaged.includes(space)) return 'That property is not mortgaged';
  if ((state.cash[seat] ?? 0) < unmortgageCost(space)) return `You need ${money(unmortgageCost(space))} to lift the mortgage`;
  return null;
}

export function unmortgage(state: GameState, seat: Seat, space: number): Result<GameState> {
  const error = unmortgageError(state, seat, space);
  if (error) return { error };
  const cost = unmortgageCost(space);
  const next = giveCash({ ...state, mortgaged: state.mortgaged.filter(index => index !== space) }, seat, -cost);
  return { state: note(next, `${nameOf(state, seat)} lifted the mortgage on ${BOARD[space].name} for ${money(cost)}`) };
}
