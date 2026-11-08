// The classic Risk world: 6 continents, 42 territories and the 83 borders between them, and the territory cards
import type { Card, CardSymbol, Continent, ContinentId, Territory } from './types.ts';

// The drawn map's size, in map units
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

export const CONTINENTS: Continent[] = [
  { id: 'northAmerica', name: 'North America', bonus: 5 },
  { id: 'southAmerica', name: 'South America', bonus: 2 },
  { id: 'europe', name: 'Europe', bonus: 5 },
  { id: 'africa', name: 'Africa', bonus: 3 },
  { id: 'asia', name: 'Asia', bonus: 7 },
  { id: 'australia', name: 'Australia', bonus: 2 }
];

export const TERRITORIES: Territory[] = [
  { id: 'alaska', name: 'Alaska', continent: 'northAmerica', x: 62, y: 92 },
  { id: 'northwestTerritory', name: 'Northwest Territory', continent: 'northAmerica', x: 168, y: 80 },
  { id: 'greenland', name: 'Greenland', continent: 'northAmerica', x: 340, y: 48 },
  { id: 'alberta', name: 'Alberta', continent: 'northAmerica', x: 140, y: 152 },
  { id: 'ontario', name: 'Ontario', continent: 'northAmerica', x: 222, y: 158 },
  { id: 'quebec', name: 'Quebec', continent: 'northAmerica', x: 304, y: 150 },
  { id: 'westernUnitedStates', name: 'Western United States', continent: 'northAmerica', x: 150, y: 232 },
  { id: 'easternUnitedStates', name: 'Eastern United States', continent: 'northAmerica', x: 246, y: 246 },
  { id: 'centralAmerica', name: 'Central America', continent: 'northAmerica', x: 186, y: 318 },
  { id: 'venezuela', name: 'Venezuela', continent: 'southAmerica', x: 250, y: 384 },
  { id: 'peru', name: 'Peru', continent: 'southAmerica', x: 236, y: 468 },
  { id: 'brazil', name: 'Brazil', continent: 'southAmerica', x: 322, y: 440 },
  { id: 'argentina', name: 'Argentina', continent: 'southAmerica', x: 268, y: 552 },
  { id: 'iceland', name: 'Iceland', continent: 'europe', x: 426, y: 92 },
  { id: 'scandinavia', name: 'Scandinavia', continent: 'europe', x: 510, y: 84 },
  { id: 'greatBritain', name: 'Great Britain', continent: 'europe', x: 408, y: 178 },
  { id: 'northernEurope', name: 'Northern Europe', continent: 'europe', x: 498, y: 176 },
  { id: 'ukraine', name: 'Ukraine', continent: 'europe', x: 594, y: 140 },
  { id: 'westernEurope', name: 'Western Europe', continent: 'europe', x: 420, y: 262 },
  { id: 'southernEurope', name: 'Southern Europe', continent: 'europe', x: 516, y: 252 },
  { id: 'northAfrica', name: 'North Africa', continent: 'africa', x: 452, y: 362 },
  { id: 'egypt', name: 'Egypt', continent: 'africa', x: 548, y: 340 },
  { id: 'eastAfrica', name: 'East Africa', continent: 'africa', x: 604, y: 424 },
  { id: 'congo', name: 'Congo', continent: 'africa', x: 526, y: 452 },
  { id: 'southAfrica', name: 'South Africa', continent: 'africa', x: 548, y: 548 },
  { id: 'madagascar', name: 'Madagascar', continent: 'africa', x: 646, y: 530 },
  { id: 'ural', name: 'Ural', continent: 'asia', x: 690, y: 122 },
  { id: 'siberia', name: 'Siberia', continent: 'asia', x: 766, y: 82 },
  { id: 'yakutsk', name: 'Yakutsk', continent: 'asia', x: 856, y: 56 },
  { id: 'kamchatka', name: 'Kamchatka', continent: 'asia', x: 944, y: 82 },
  { id: 'irkutsk', name: 'Irkutsk', continent: 'asia', x: 840, y: 136 },
  { id: 'mongolia', name: 'Mongolia', continent: 'asia', x: 852, y: 204 },
  { id: 'japan', name: 'Japan', continent: 'asia', x: 948, y: 214 },
  { id: 'afghanistan', name: 'Afghanistan', continent: 'asia', x: 680, y: 216 },
  { id: 'china', name: 'China', continent: 'asia', x: 790, y: 266 },
  { id: 'middleEast', name: 'Middle East', continent: 'asia', x: 636, y: 300 },
  { id: 'india', name: 'India', continent: 'asia', x: 722, y: 330 },
  { id: 'siam', name: 'Siam', continent: 'asia', x: 808, y: 350 },
  { id: 'indonesia', name: 'Indonesia', continent: 'australia', x: 826, y: 444 },
  { id: 'newGuinea', name: 'New Guinea', continent: 'australia', x: 920, y: 430 },
  { id: 'westernAustralia', name: 'Western Australia', continent: 'australia', x: 848, y: 548 },
  { id: 'easternAustralia', name: 'Eastern Australia', continent: 'australia', x: 940, y: 540 }
];

// Every border once, as on the board. The ones marked sea cross water (drawn dashed); the rest are land borders.
export const BORDERS: { a: string; b: string; sea?: true }[] = [
  // North America
  { a: 'alaska', b: 'northwestTerritory' },
  { a: 'alaska', b: 'alberta' },
  { a: 'northwestTerritory', b: 'alberta' },
  { a: 'northwestTerritory', b: 'ontario' },
  { a: 'northwestTerritory', b: 'greenland', sea: true },
  { a: 'greenland', b: 'ontario', sea: true },
  { a: 'greenland', b: 'quebec', sea: true },
  { a: 'alberta', b: 'ontario' },
  { a: 'alberta', b: 'westernUnitedStates' },
  { a: 'ontario', b: 'quebec' },
  { a: 'ontario', b: 'westernUnitedStates' },
  { a: 'ontario', b: 'easternUnitedStates' },
  { a: 'quebec', b: 'easternUnitedStates' },
  { a: 'westernUnitedStates', b: 'easternUnitedStates' },
  { a: 'westernUnitedStates', b: 'centralAmerica' },
  { a: 'easternUnitedStates', b: 'centralAmerica' },
  // South America, and its links out
  { a: 'centralAmerica', b: 'venezuela' },
  { a: 'venezuela', b: 'peru' },
  { a: 'venezuela', b: 'brazil' },
  { a: 'peru', b: 'brazil' },
  { a: 'peru', b: 'argentina' },
  { a: 'brazil', b: 'argentina' },
  { a: 'brazil', b: 'northAfrica', sea: true },
  // Europe
  { a: 'greenland', b: 'iceland', sea: true },
  { a: 'iceland', b: 'greatBritain', sea: true },
  { a: 'iceland', b: 'scandinavia', sea: true },
  { a: 'greatBritain', b: 'scandinavia', sea: true },
  { a: 'greatBritain', b: 'northernEurope', sea: true },
  { a: 'greatBritain', b: 'westernEurope', sea: true },
  { a: 'scandinavia', b: 'northernEurope' },
  { a: 'scandinavia', b: 'ukraine' },
  { a: 'northernEurope', b: 'ukraine' },
  { a: 'northernEurope', b: 'westernEurope' },
  { a: 'northernEurope', b: 'southernEurope' },
  { a: 'westernEurope', b: 'southernEurope' },
  { a: 'southernEurope', b: 'ukraine' },
  { a: 'westernEurope', b: 'northAfrica', sea: true },
  { a: 'southernEurope', b: 'northAfrica', sea: true },
  { a: 'southernEurope', b: 'egypt', sea: true },
  { a: 'southernEurope', b: 'middleEast' },
  { a: 'ukraine', b: 'middleEast' },
  { a: 'ukraine', b: 'afghanistan' },
  { a: 'ukraine', b: 'ural' },
  // Africa
  { a: 'northAfrica', b: 'egypt' },
  { a: 'northAfrica', b: 'eastAfrica' },
  { a: 'northAfrica', b: 'congo' },
  { a: 'egypt', b: 'eastAfrica' },
  { a: 'egypt', b: 'middleEast' },
  { a: 'eastAfrica', b: 'middleEast' },
  { a: 'eastAfrica', b: 'congo' },
  { a: 'eastAfrica', b: 'southAfrica' },
  { a: 'eastAfrica', b: 'madagascar', sea: true },
  { a: 'congo', b: 'southAfrica' },
  { a: 'southAfrica', b: 'madagascar', sea: true },
  // Asia
  { a: 'ural', b: 'siberia' },
  { a: 'ural', b: 'china' },
  { a: 'ural', b: 'afghanistan' },
  { a: 'siberia', b: 'yakutsk' },
  { a: 'siberia', b: 'irkutsk' },
  { a: 'siberia', b: 'mongolia' },
  { a: 'siberia', b: 'china' },
  { a: 'yakutsk', b: 'kamchatka' },
  { a: 'yakutsk', b: 'irkutsk' },
  { a: 'kamchatka', b: 'irkutsk' },
  { a: 'kamchatka', b: 'mongolia' },
  { a: 'kamchatka', b: 'japan', sea: true },
  { a: 'kamchatka', b: 'alaska', sea: true },
  { a: 'irkutsk', b: 'mongolia' },
  { a: 'mongolia', b: 'japan', sea: true },
  { a: 'mongolia', b: 'china' },
  { a: 'afghanistan', b: 'china' },
  { a: 'afghanistan', b: 'india' },
  { a: 'afghanistan', b: 'middleEast' },
  { a: 'china', b: 'india' },
  { a: 'china', b: 'siam' },
  { a: 'middleEast', b: 'india' },
  { a: 'india', b: 'siam' },
  // Australia
  { a: 'siam', b: 'indonesia', sea: true },
  { a: 'indonesia', b: 'newGuinea', sea: true },
  { a: 'indonesia', b: 'westernAustralia', sea: true },
  { a: 'newGuinea', b: 'westernAustralia', sea: true },
  { a: 'newGuinea', b: 'easternAustralia', sea: true },
  { a: 'westernAustralia', b: 'easternAustralia' }
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
