// The streets of Larkhaven, an invented harbor city: 22 streets in eight color groups, four stations and two utilities.
// Rents are unimproved, then 1 to 4 houses, then a hotel. Every mortgage value is half the price.
import type { ColorGroup, OwnableSpace, Space } from './types.ts';

export const BOARD_SIZE = 40;
export const GO = 0;
export const JAIL = 10;
export const START_CASH = 1500;
export const GO_SALARY = 200;
export const JAIL_FINE = 50;
export const GO_BONUS_SALARY = 400; // for landing exactly on Start with the house rule
export const HOUSE_SUPPLY = 32;
export const HOTEL_SUPPLY = 12;
export const HOTEL = 5; // a hotel stands for the fifth building level
export const RAILROAD_RENTS = [25, 50, 100, 200]; // by stations owned
export const UTILITY_MULTIPLIERS = [4, 10]; // times the dice, by utilities owned

export const GROUPS: ColorGroup[] = ['brown', 'lightBlue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkBlue'];

function street(name: string, group: ColorGroup, price: number, houseCost: number, rents: number[]): Space {
  return { kind: 'street', name, group, price, mortgage: price / 2, houseCost, rents };
}

function railroad(name: string): Space {
  return { kind: 'railroad', name, price: 200, mortgage: 100 };
}

function utility(name: string): Space {
  return { kind: 'utility', name, price: 150, mortgage: 75 };
}

export const BOARD: Space[] = [
  { kind: 'go', name: 'Start' },
  street('Tanner Row', 'brown', 60, 50, [2, 10, 30, 90, 160, 250]),
  { kind: 'card', name: 'Town Fund', deck: 'chest' },
  street('Cinder Lane', 'brown', 60, 50, [4, 20, 60, 180, 320, 450]),
  { kind: 'tax', name: 'Income Tax', amount: 200 },
  railroad('Harbor Station'),
  street('Willow Street', 'lightBlue', 100, 50, [6, 30, 90, 270, 400, 550]),
  { kind: 'card', name: 'Fortune', deck: 'chance' },
  street('Fennel Street', 'lightBlue', 100, 50, [6, 30, 90, 270, 400, 550]),
  street('Copper Street', 'lightBlue', 120, 50, [8, 40, 100, 300, 450, 600]),
  { kind: 'jail', name: 'Jail' },
  street('Lantern Way', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]),
  utility('Power House'),
  street('Orchard Road', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]),
  street('Quarry Road', 'pink', 160, 100, [12, 60, 180, 500, 700, 900]),
  railroad('Market Station'),
  street('Belfry Place', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]),
  { kind: 'card', name: 'Town Fund', deck: 'chest' },
  street('Chapel Place', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]),
  street('Mercer Place', 'orange', 200, 100, [16, 80, 220, 600, 800, 1000]),
  { kind: 'parking', name: 'Town Square' },
  street('Juniper Avenue', 'red', 220, 150, [18, 90, 250, 700, 875, 1050]),
  { kind: 'card', name: 'Fortune', deck: 'chance' },
  street('Sterling Avenue', 'red', 220, 150, [18, 90, 250, 700, 875, 1050]),
  street('Regent Avenue', 'red', 240, 150, [20, 100, 300, 750, 925, 1100]),
  railroad('Union Station'),
  street('Amber Terrace', 'yellow', 260, 150, [22, 110, 330, 800, 975, 1150]),
  street('Linden Terrace', 'yellow', 260, 150, [22, 110, 330, 800, 975, 1150]),
  utility('Reservoir'),
  street('Hawthorn Gardens', 'yellow', 280, 150, [24, 120, 360, 850, 1025, 1200]),
  { kind: 'goToJail', name: 'Go to Jail' },
  street('Kingsley Drive', 'green', 300, 200, [26, 130, 390, 900, 1100, 1275]),
  street('Ashcombe Drive', 'green', 300, 200, [26, 130, 390, 900, 1100, 1275]),
  { kind: 'card', name: 'Town Fund', deck: 'chest' },
  street('Galloway Drive', 'green', 320, 200, [28, 150, 450, 1000, 1200, 1400]),
  railroad('Ridge Station'),
  { kind: 'card', name: 'Fortune', deck: 'chance' },
  street('Summit Rise', 'darkBlue', 350, 200, [35, 175, 500, 1100, 1300, 1500]),
  { kind: 'tax', name: 'Luxury Tax', amount: 100 },
  street('Skyline Crescent', 'darkBlue', 400, 200, [50, 200, 600, 1400, 1700, 2000])
];

export function isSpace(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < BOARD_SIZE;
}

// The space as a property, or null for a space nobody can own
export function ownable(index: number): OwnableSpace | null {
  const space = BOARD[index];
  return space && 'price' in space ? space : null;
}

export function streetAt(index: number): Extract<Space, { kind: 'street' }> | null {
  const space = BOARD[index];
  return space?.kind === 'street' ? space : null;
}

export function groupSpaces(group: ColorGroup): number[] {
  return BOARD.flatMap((space, index) => space.kind === 'street' && space.group === group ? [index] : []);
}

export function spacesOfKind(kind: Space['kind']): number[] {
  return BOARD.flatMap((space, index) => space.kind === kind ? [index] : []);
}

export function unmortgageCost(index: number): number {
  return Math.ceil(((ownable(index)?.mortgage ?? 0) * 11) / 10);
}

// The 10% a player pays to keep a mortgaged property mortgaged when it comes to them in a trade or a bankruptcy
export function mortgageInterest(index: number): number {
  return Math.ceil((ownable(index)?.mortgage ?? 0) / 10);
}
