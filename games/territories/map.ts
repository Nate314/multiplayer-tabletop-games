// Calderra, this game's own world: 6 continents, 42 territories and the 83 borders between them, and the territory cards
import type { Card, CardSymbol, Continent, ContinentId, Territory } from './types.ts';

// The drawn map's size, in map units
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

export const CONTINENTS: Continent[] = [
  { id: 'westmarch', name: 'Westmarch', bonus: 5 },
  { id: 'sunreach', name: 'Sunreach', bonus: 2 },
  { id: 'highvale', name: 'Highvale', bonus: 5 },
  { id: 'amberveld', name: 'Amberveld', bonus: 3 },
  { id: 'eastwild', name: 'Eastwild', bonus: 7 },
  { id: 'coralIsles', name: 'Coral Isles', bonus: 2 }
];

// In card order: card n shows territory n, and its symbol follows from n
export const TERRITORIES: Territory[] = [
  { id: 'frostcape', name: 'Frostcape', continent: 'westmarch', x: 55, y: 90 },
  { id: 'pinewatch', name: 'Pinewatch', continent: 'westmarch', x: 160, y: 55 },
  { id: 'dustgate', name: 'Dustgate', continent: 'westmarch', x: 280, y: 290 },
  { id: 'elkmoor', name: 'Elkmoor', continent: 'westmarch', x: 105, y: 180 },
  { id: 'copperfield', name: 'Copperfield', continent: 'westmarch', x: 75, y: 280 },
  { id: 'stonebridge', name: 'Stonebridge', continent: 'westmarch', x: 210, y: 165 },
  { id: 'gullskerry', name: 'Gullskerry', continent: 'westmarch', x: 270, y: 80 },
  { id: 'harrowgate', name: 'Harrowgate', continent: 'westmarch', x: 300, y: 200 },
  { id: 'redwater', name: 'Redwater', continent: 'westmarch', x: 185, y: 280 },
  { id: 'glassbay', name: 'Glass Bay', continent: 'sunreach', x: 270, y: 440 },
  { id: 'saltmarsh', name: 'Saltmarsh', continent: 'sunreach', x: 170, y: 375 },
  { id: 'southmere', name: 'Southmere', continent: 'sunreach', x: 220, y: 550 },
  { id: 'thornwood', name: 'Thornwood', continent: 'sunreach', x: 110, y: 480 },
  { id: 'oakheart', name: 'Oakheart', continent: 'highvale', x: 450, y: 195 },
  { id: 'tidewell', name: 'Tidewell', continent: 'highvale', x: 560, y: 300 },
  { id: 'greyridge', name: 'Greyridge', continent: 'highvale', x: 610, y: 120 },
  { id: 'windhold', name: 'Windhold', continent: 'highvale', x: 400, y: 100 },
  { id: 'ravenfell', name: 'Ravenfell', continent: 'highvale', x: 500, y: 85 },
  { id: 'lowmeadow', name: 'Lowmeadow', continent: 'highvale', x: 560, y: 205 },
  { id: 'brightshore', name: 'Brightshore', continent: 'highvale', x: 420, y: 300 },
  { id: 'mossdeep', name: 'Mossdeep', continent: 'amberveld', x: 460, y: 530 },
  { id: 'cinderpeak', name: 'Cinderpeak', continent: 'amberveld', x: 530, y: 420 },
  { id: 'pearlCoast', name: 'Pearl Coast', continent: 'amberveld', x: 680, y: 550 },
  { id: 'sunfall', name: 'Sunfall', continent: 'amberveld', x: 650, y: 440 },
  { id: 'duneholm', name: 'Duneholm', continent: 'amberveld', x: 430, y: 430 },
  { id: 'goldcliff', name: 'Goldcliff', continent: 'amberveld', x: 570, y: 520 },
  { id: 'stormgate', name: 'Stormgate', continent: 'eastwild', x: 705, y: 170 },
  { id: 'jadewood', name: 'Jadewood', continent: 'eastwild', x: 900, y: 190 },
  { id: 'palmreach', name: 'Palmreach', continent: 'eastwild', x: 860, y: 385 },
  { id: 'dawnspire', name: 'Dawnspire', continent: 'eastwild', x: 955, y: 110 },
  { id: 'saffronCoast', name: 'Saffron Coast', continent: 'eastwild', x: 705, y: 275 },
  { id: 'wolfrun', name: 'Wolfrun', continent: 'eastwild', x: 790, y: 50 },
  { id: 'silkfen', name: 'Silkfen', continent: 'eastwild', x: 810, y: 265 },
  { id: 'snowcrown', name: 'Snowcrown', continent: 'eastwild', x: 875, y: 60 },
  { id: 'rainhollow', name: 'Rainhollow', continent: 'eastwild', x: 745, y: 370 },
  { id: 'ironpass', name: 'Ironpass', continent: 'eastwild', x: 700, y: 65 },
  { id: 'lanternIsle', name: 'Lantern Isle', continent: 'eastwild', x: 915, y: 300 },
  { id: 'ashvale', name: 'Ashvale', continent: 'eastwild', x: 805, y: 150 },
  { id: 'driftwood', name: 'Driftwood', continent: 'coralIsles', x: 815, y: 530 },
  { id: 'shellhaven', name: 'Shellhaven', continent: 'coralIsles', x: 905, y: 455 },
  { id: 'reefwatch', name: 'Reefwatch', continent: 'coralIsles', x: 790, y: 470 },
  { id: 'turtleback', name: 'Turtleback', continent: 'coralIsles', x: 925, y: 520 }
];

// Every border once, read off the drawing above: neighbors on the map, and sea lanes (drawn dashed) across water
export const BORDERS: { a: string; b: string; sea?: true }[] = [
  // Westmarch, with the island of Gullskerry
  { a: 'frostcape', b: 'pinewatch' },
  { a: 'frostcape', b: 'elkmoor' },
  { a: 'pinewatch', b: 'elkmoor' },
  { a: 'pinewatch', b: 'stonebridge' },
  { a: 'pinewatch', b: 'gullskerry', sea: true },
  { a: 'gullskerry', b: 'stonebridge', sea: true },
  { a: 'gullskerry', b: 'harrowgate', sea: true },
  { a: 'elkmoor', b: 'stonebridge' },
  { a: 'elkmoor', b: 'copperfield' },
  { a: 'elkmoor', b: 'redwater' },
  { a: 'stonebridge', b: 'redwater' },
  { a: 'stonebridge', b: 'harrowgate' },
  { a: 'harrowgate', b: 'dustgate' },
  { a: 'redwater', b: 'dustgate' },
  { a: 'copperfield', b: 'redwater' },
  { a: 'harrowgate', b: 'redwater' },
  // Sunreach
  { a: 'saltmarsh', b: 'glassbay' },
  { a: 'saltmarsh', b: 'thornwood' },
  { a: 'glassbay', b: 'thornwood' },
  { a: 'glassbay', b: 'southmere' },
  { a: 'thornwood', b: 'southmere' },
  // Highvale
  { a: 'windhold', b: 'ravenfell' },
  { a: 'windhold', b: 'oakheart' },
  { a: 'ravenfell', b: 'oakheart' },
  { a: 'ravenfell', b: 'greyridge' },
  { a: 'ravenfell', b: 'lowmeadow' },
  { a: 'greyridge', b: 'lowmeadow' },
  { a: 'oakheart', b: 'lowmeadow' },
  { a: 'oakheart', b: 'brightshore' },
  { a: 'oakheart', b: 'tidewell' },
  { a: 'lowmeadow', b: 'tidewell' },
  { a: 'brightshore', b: 'tidewell' },
  // Amberveld
  { a: 'duneholm', b: 'cinderpeak' },
  { a: 'duneholm', b: 'mossdeep' },
  { a: 'cinderpeak', b: 'sunfall' },
  { a: 'cinderpeak', b: 'mossdeep' },
  { a: 'cinderpeak', b: 'goldcliff' },
  { a: 'sunfall', b: 'goldcliff' },
  { a: 'sunfall', b: 'pearlCoast' },
  { a: 'mossdeep', b: 'goldcliff' },
  { a: 'goldcliff', b: 'pearlCoast' },
  // Eastwild, with Lantern Isle off its coast
  { a: 'ironpass', b: 'wolfrun' },
  { a: 'ironpass', b: 'stormgate' },
  { a: 'wolfrun', b: 'stormgate' },
  { a: 'wolfrun', b: 'ashvale' },
  { a: 'wolfrun', b: 'snowcrown' },
  { a: 'snowcrown', b: 'ashvale' },
  { a: 'snowcrown', b: 'dawnspire' },
  { a: 'snowcrown', b: 'jadewood' },
  { a: 'dawnspire', b: 'jadewood' },
  { a: 'stormgate', b: 'ashvale' },
  { a: 'stormgate', b: 'saffronCoast' },
  { a: 'ashvale', b: 'jadewood' },
  { a: 'ashvale', b: 'silkfen' },
  { a: 'jadewood', b: 'silkfen' },
  { a: 'jadewood', b: 'lanternIsle', sea: true },
  { a: 'saffronCoast', b: 'silkfen' },
  { a: 'silkfen', b: 'lanternIsle', sea: true },
  { a: 'saffronCoast', b: 'rainhollow' },
  { a: 'silkfen', b: 'rainhollow' },
  { a: 'silkfen', b: 'palmreach' },
  { a: 'lanternIsle', b: 'palmreach', sea: true },
  { a: 'rainhollow', b: 'palmreach' },
  { a: 'dawnspire', b: 'lanternIsle', sea: true },
  // The Coral Isles: Reefwatch and Shellhaven on one island, Driftwood and Turtleback on another
  { a: 'reefwatch', b: 'shellhaven' },
  { a: 'reefwatch', b: 'driftwood', sea: true },
  { a: 'shellhaven', b: 'turtleback', sea: true },
  { a: 'driftwood', b: 'turtleback' },
  { a: 'reefwatch', b: 'turtleback', sea: true },
  // Between the continents. Dawnspire and Frostcape meet across the edge of the map
  { a: 'dawnspire', b: 'frostcape', sea: true },
  { a: 'gullskerry', b: 'windhold', sea: true },
  { a: 'redwater', b: 'saltmarsh' },
  { a: 'glassbay', b: 'brightshore', sea: true },
  { a: 'brightshore', b: 'duneholm', sea: true },
  { a: 'tidewell', b: 'duneholm', sea: true },
  { a: 'tidewell', b: 'cinderpeak', sea: true },
  { a: 'greyridge', b: 'ironpass', sea: true },
  { a: 'greyridge', b: 'stormgate', sea: true },
  { a: 'tidewell', b: 'saffronCoast', sea: true },
  { a: 'cinderpeak', b: 'saffronCoast', sea: true },
  { a: 'sunfall', b: 'saffronCoast', sea: true },
  { a: 'sunfall', b: 'rainhollow', sea: true },
  { a: 'rainhollow', b: 'reefwatch', sea: true }
];

const BY_ID = new Map(TERRITORIES.map(territory => [territory.id, territory]));

export const NEIGHBORS: Record<string, string[]> = Object.fromEntries(TERRITORIES.map(({ id }) => [id, [] as string[]]));
for (const { a, b } of BORDERS) {
  NEIGHBORS[a].push(b);
  NEIGHBORS[b].push(a);
}

export function isTerritory(value: unknown): value is string {
  return typeof value === 'string' && BY_ID.has(value);
}

export function territoryName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

export function adjacent(a: string, b: string): boolean {
  return NEIGHBORS[a]?.includes(b) ?? false;
}

export function territoriesOf(continent: ContinentId): string[] {
  return TERRITORIES.filter(territory => territory.continent === continent).map(({ id }) => id);
}

// Cards: one per territory, the symbols in turn so each appears 14 times, and two wilds
const SYMBOLS: CardSymbol[] = ['infantry', 'cavalry', 'artillery'];
export const WILD_CARDS: Card[] = [TERRITORIES.length, TERRITORIES.length + 1];
export const ALL_CARDS: Card[] = [...TERRITORIES.map((_, index) => index), ...WILD_CARDS];

export function isCard(value: unknown): value is Card {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < ALL_CARDS.length;
}

export function cardSymbol(card: Card): CardSymbol {
  return card < TERRITORIES.length ? SYMBOLS[card % SYMBOLS.length] : 'wild';
}

// The territory a card shows, or null for a wild
export function cardTerritory(card: Card): string | null {
  return TERRITORIES[card]?.id ?? null;
}

export function cardName(card: Card): string {
  const territory = cardTerritory(card);
  return territory ? `${territoryName(territory)} (${cardSymbol(card)})` : 'Wild';
}
