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
  { id: 'redwater', name: 'Redwater', continent: 'westmarch', x: 190, y: 345 },
  { id: 'harrowgate', name: 'Harrowgate', continent: 'westmarch', x: 290, y: 215 },
  { id: 'elkmoor', name: 'Elkmoor', continent: 'westmarch', x: 85, y: 190 },
  { id: 'dustgate', name: 'Dustgate', continent: 'westmarch', x: 300, y: 300 },
  { id: 'copperfield', name: 'Copperfield', continent: 'westmarch', x: 70, y: 300 },
  { id: 'gullskerry', name: 'Gullskerry', continent: 'westmarch', x: 265, y: 95 },
  { id: 'pinewatch', name: 'Pinewatch', continent: 'westmarch', x: 165, y: 55 },
  { id: 'stonebridge', name: 'Stonebridge', continent: 'westmarch', x: 185, y: 175 },
  { id: 'frostcape', name: 'Frostcape', continent: 'westmarch', x: 60, y: 80 },
  { id: 'saltmarsh', name: 'Saltmarsh', continent: 'sunreach', x: 760, y: 500 },
  { id: 'glassBay', name: 'Glass Bay', continent: 'sunreach', x: 905, y: 485 },
  { id: 'thornwood', name: 'Thornwood', continent: 'sunreach', x: 830, y: 515 },
  { id: 'southmere', name: 'Southmere', continent: 'sunreach', x: 850, y: 578 },
  { id: 'windhold', name: 'Windhold', continent: 'highvale', x: 400, y: 70 },
  { id: 'ravenfell', name: 'Ravenfell', continent: 'highvale', x: 490, y: 105 },
  { id: 'oakheart', name: 'Oakheart', continent: 'highvale', x: 415, y: 185 },
  { id: 'brightshore', name: 'Brightshore', continent: 'highvale', x: 470, y: 265 },
  { id: 'greyridge', name: 'Greyridge', continent: 'highvale', x: 580, y: 60 },
  { id: 'tidewell', name: 'Tidewell', continent: 'highvale', x: 600, y: 150 },
  { id: 'lowmeadow', name: 'Lowmeadow', continent: 'highvale', x: 580, y: 245 },
  { id: 'mossdeep', name: 'Mossdeep', continent: 'amberveld', x: 370, y: 440 },
  { id: 'cinderpeak', name: 'Cinderpeak', continent: 'amberveld', x: 560, y: 345 },
  { id: 'sunfall', name: 'Sunfall', continent: 'amberveld', x: 490, y: 425 },
  { id: 'pearlCoast', name: 'Pearl Coast', continent: 'amberveld', x: 500, y: 530 },
  { id: 'duneholm', name: 'Duneholm', continent: 'amberveld', x: 400, y: 330 },
  { id: 'goldcliff', name: 'Goldcliff', continent: 'amberveld', x: 610, y: 445 },
  { id: 'ironpass', name: 'Ironpass', continent: 'eastwild', x: 690, y: 50 },
  { id: 'stormgate', name: 'Stormgate', continent: 'eastwild', x: 705, y: 135 },
  { id: 'saffronCoast', name: 'Saffron Coast', continent: 'eastwild', x: 700, y: 220 },
  { id: 'rainhollow', name: 'Rainhollow', continent: 'eastwild', x: 690, y: 305 },
  { id: 'wolfrun', name: 'Wolfrun', continent: 'eastwild', x: 790, y: 65 },
  { id: 'snowcrown', name: 'Snowcrown', continent: 'eastwild', x: 880, y: 60 },
  { id: 'dawnspire', name: 'Dawnspire', continent: 'eastwild', x: 960, y: 120 },
  { id: 'ashvale', name: 'Ashvale', continent: 'eastwild', x: 800, y: 165 },
  { id: 'jadewood', name: 'Jadewood', continent: 'eastwild', x: 905, y: 205 },
  { id: 'silkfen', name: 'Silkfen', continent: 'eastwild', x: 795, y: 280 },
  { id: 'lanternHill', name: 'Lantern Hill', continent: 'eastwild', x: 925, y: 310 },
  { id: 'palmreach', name: 'Palmreach', continent: 'eastwild', x: 830, y: 395 },
  { id: 'reefwatch', name: 'Reefwatch', continent: 'coralIsles', x: 300, y: 490 },
  { id: 'shellhaven', name: 'Shellhaven', continent: 'coralIsles', x: 170, y: 480 },
  { id: 'driftwood', name: 'Driftwood', continent: 'coralIsles', x: 237, y: 512 },
  { id: 'turtleback', name: 'Turtleback', continent: 'coralIsles', x: 245, y: 585 }
];

// Every border once, read off the drawing above: each territory and its closest neighbors, with sea lanes (drawn dashed)
// across water
export const BORDERS: { a: string; b: string; sea?: true }[] = [
  // Westmarch
  { a: 'pinewatch', b: 'stonebridge' },
  { a: 'pinewatch', b: 'gullskerry' },
  { a: 'frostcape', b: 'pinewatch' },
  { a: 'copperfield', b: 'redwater' },
  { a: 'frostcape', b: 'elkmoor' },
  { a: 'stonebridge', b: 'copperfield' },
  { a: 'harrowgate', b: 'dustgate' },
  { a: 'elkmoor', b: 'copperfield' },
  { a: 'pinewatch', b: 'elkmoor' },
  { a: 'harrowgate', b: 'redwater' },
  { a: 'gullskerry', b: 'harrowgate' },
  { a: 'elkmoor', b: 'stonebridge' },
  { a: 'redwater', b: 'dustgate' },
  { a: 'stonebridge', b: 'redwater' },
  { a: 'gullskerry', b: 'stonebridge' },
  // Sunreach: Thornwood lies inland, bordered by the other three, and Southmere is an island off its south coast
  { a: 'glassBay', b: 'southmere', sea: true },
  { a: 'saltmarsh', b: 'glassBay' },
  { a: 'saltmarsh', b: 'thornwood' },
  { a: 'glassBay', b: 'thornwood' },
  { a: 'thornwood', b: 'southmere', sea: true },
  { a: 'saltmarsh', b: 'southmere', sea: true },
  // Highvale
  { a: 'windhold', b: 'ravenfell' },
  { a: 'ravenfell', b: 'tidewell' },
  { a: 'ravenfell', b: 'lowmeadow' },
  { a: 'ravenfell', b: 'brightshore' },
  { a: 'windhold', b: 'oakheart' },
  { a: 'ravenfell', b: 'greyridge' },
  { a: 'windhold', b: 'greyridge' },
  { a: 'ravenfell', b: 'oakheart' },
  { a: 'oakheart', b: 'brightshore' },
  { a: 'greyridge', b: 'tidewell' },
  // Amberveld
  { a: 'duneholm', b: 'cinderpeak' },
  { a: 'goldcliff', b: 'pearlCoast' },
  { a: 'duneholm', b: 'sunfall' },
  { a: 'duneholm', b: 'mossdeep' },
  { a: 'sunfall', b: 'pearlCoast' },
  { a: 'sunfall', b: 'goldcliff' },
  { a: 'cinderpeak', b: 'goldcliff' },
  { a: 'mossdeep', b: 'sunfall' },
  { a: 'mossdeep', b: 'pearlCoast' },
  { a: 'cinderpeak', b: 'sunfall' },
  // Eastwild
  { a: 'silkfen', b: 'palmreach' },
  { a: 'saffronCoast', b: 'rainhollow' },
  { a: 'ashvale', b: 'jadewood' },
  { a: 'ashvale', b: 'silkfen' },
  { a: 'silkfen', b: 'lanternHill' },
  { a: 'jadewood', b: 'lanternHill' },
  { a: 'snowcrown', b: 'dawnspire' },
  { a: 'wolfrun', b: 'ashvale' },
  { a: 'saffronCoast', b: 'silkfen' },
  { a: 'dawnspire', b: 'jadewood' },
  { a: 'saffronCoast', b: 'ashvale' },
  { a: 'stormgate', b: 'wolfrun' },
  { a: 'snowcrown', b: 'jadewood' },
  { a: 'jadewood', b: 'silkfen' },
  { a: 'wolfrun', b: 'snowcrown' },
  { a: 'dawnspire', b: 'lanternHill' },
  { a: 'stormgate', b: 'ashvale' },
  { a: 'ironpass', b: 'stormgate' },
  { a: 'snowcrown', b: 'ashvale' },
  { a: 'stormgate', b: 'saffronCoast' },
  { a: 'rainhollow', b: 'palmreach' },
  { a: 'lanternHill', b: 'palmreach' },
  // The Coral Isles, all across water: Driftwood lies between the other three
  { a: 'reefwatch', b: 'shellhaven', sea: true },
  { a: 'reefwatch', b: 'turtleback', sea: true },
  { a: 'reefwatch', b: 'driftwood', sea: true },
  { a: 'driftwood', b: 'turtleback', sea: true },
  { a: 'shellhaven', b: 'driftwood', sea: true },
  { a: 'shellhaven', b: 'turtleback', sea: true },
  // Between the continents, all across the sea: Westmarch and Amberveld, Highvale and Amberveld, Highvale and Eastwild,
  // Eastwild and Sunreach, and Amberveld and the Coral Isles
  { a: 'harrowgate', b: 'duneholm', sea: true },
  { a: 'dustgate', b: 'mossdeep', sea: true },
  { a: 'redwater', b: 'mossdeep', sea: true },
  { a: 'brightshore', b: 'duneholm', sea: true },
  { a: 'lowmeadow', b: 'cinderpeak', sea: true },
  { a: 'greyridge', b: 'ironpass', sea: true },
  { a: 'greyridge', b: 'stormgate', sea: true },
  { a: 'tidewell', b: 'stormgate', sea: true },
  { a: 'tidewell', b: 'saffronCoast', sea: true },
  { a: 'lowmeadow', b: 'saffronCoast', sea: true },
  { a: 'lowmeadow', b: 'rainhollow', sea: true },
  { a: 'palmreach', b: 'saltmarsh', sea: true },
  { a: 'palmreach', b: 'glassBay', sea: true },
  { a: 'mossdeep', b: 'reefwatch', sea: true }
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
