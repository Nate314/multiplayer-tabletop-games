// The map of Esterra, a fictional continent: 36 cities and 100 tracks (78 city pairs, 22 of them double routes), and the
// 30 destination tickets. The cities were placed first and each joined to its near neighbours; the network keeps the
// published game's totals (track lengths and colors, train spaces, ticket points) so the game balances the same way.
// Each ticket is worth the fewest train spaces between its two cities (see shortestTrack).
import type { City, Route, RouteColor, Ticket } from './types.ts';

// The drawn map's edges, in map units
export const MAP_LEFT = -50;  // room for the names of the westernmost cities
export const MAP_WIDTH = 1060;
export const MAP_HEIGHT = 630;

type CitySpec = [name: string, x: number, y: number, label?: City['label']];

const CITY_SPECS: CitySpec[] = [
  ['Alderwick', 179, 394, 'left'],
  ['Ashgrove', 843, 287, 'right'],
  ['Bramholt', 327, 436, 'right'],
  ['Brightwell', 977, 239, 'above'],
  ['Carrowmere', 617, 290, 'left'],
  ['Cobalt', 449, 195, 'below'],
  ['Driftwood', 761, 177, 'left'],
  ['Dunhallow', 855, 166, 'right'],
  ['Elmsby', 601, 155, 'above'],
  ['Emberly', 430, 495, 'below'],
  ['Fenmouth', 788, 482, 'right'],
  ['Frostford', 869, 86, 'right'],
  ['Glenrook', 60, 293, 'left'],
  ['Greywater', 887, 251, 'above'],
  ['Harrowby', 386, 320, 'right'],
  ['Highcliff', 788, 269, 'left'],
  ['Ironmoor', 938, 327, 'right'],
  ['Juniper', 682, 207, 'right'],
  ['Kestrel', 302, 86, 'above'],
  ['Lanthorn', 490, 437, 'right'],
  ['Lindmoor', 433, 93, 'right'],
  ['Marrowgate', 649, 357, 'left'],
  ['Millstone', 639, 494, 'below'],
  ['Northfold', 878, 372, 'right'],
  ['Oakhurst', 775, 331, 'left'],
  ['Pellam', 142, 138, 'left'],
  ['Quillon', 788, 90, 'left'],
  ['Redmarsh', 455, 396, 'left'],
  ['Saltcombe', 955, 127, 'right'],
  ['Stonemere', 691, 475, 'above'],
  ['Thornwick', 540, 488, 'below'],
  ['Umber', 247, 208, 'left'],
  ['Valemont', 746, 550, 'below'],
  ['Westerly', 685, 403, 'right'],
  ['Yarrow', 212, 496, 'below'],
  ['Zephyr', 856, 452, 'right']
];

export const CITIES: City[] = CITY_SPECS.map(([name, x, y, label], id) => ({ id, name, x, y, label }));

const cityId = (name: string): number => {
  const city = CITIES.find(candidate => candidate.name === name);
  if (!city) throw new Error(`Unknown city ${name}`);
  return city.id;
};

// Each city pair once, with one color per track: two colors make a double route
type PairSpec = [a: string, b: string, length: number, colors: RouteColor[], via?: [number, number]];

const PAIRS: PairSpec[] = [
  ['Alderwick', 'Bramholt', 6, ['green']],
  ['Alderwick', 'Glenrook', 4, ['gray']],
  ['Alderwick', 'Harrowby', 5, ['red']],
  ['Alderwick', 'Umber', 6, ['orange']],
  ['Alderwick', 'Yarrow', 4, ['black', 'orange']],
  ['Ashgrove', 'Greywater', 1, ['gray']],
  ['Ashgrove', 'Ironmoor', 4, ['pink']],
  ['Ashgrove', 'Northfold', 2, ['gray']],
  ['Ashgrove', 'Oakhurst', 2, ['gray']],
  ['Bramholt', 'Emberly', 4, ['blue']],
  ['Bramholt', 'Harrowby', 4, ['pink']],
  ['Bramholt', 'Redmarsh', 5, ['blue']],
  ['Bramholt', 'Yarrow', 3, ['orange', 'black']],
  ['Brightwell', 'Greywater', 2, ['gray']],
  ['Brightwell', 'Ironmoor', 2, ['blue', 'pink']],
  ['Brightwell', 'Saltcombe', 4, ['blue']],
  ['Carrowmere', 'Elmsby', 3, ['gray']],
  ['Carrowmere', 'Juniper', 2, ['orange', 'black']],
  ['Carrowmere', 'Marrowgate', 2, ['gray']],
  ['Carrowmere', 'Redmarsh', 5, ['yellow']],
  ['Cobalt', 'Elmsby', 4, ['red']],
  ['Cobalt', 'Harrowby', 5, ['green']],
  ['Cobalt', 'Kestrel', 5, ['white']],
  ['Cobalt', 'Lindmoor', 2, ['white', 'green']],
  ['Cobalt', 'Umber', 6, ['red']],
  ['Driftwood', 'Dunhallow', 2, ['gray', 'gray']],
  ['Driftwood', 'Highcliff', 2, ['gray']],
  ['Driftwood', 'Juniper', 3, ['pink']],
  ['Driftwood', 'Quillon', 3, ['white']],
  ['Dunhallow', 'Frostford', 2, ['gray']],
  ['Dunhallow', 'Greywater', 2, ['gray']],
  ['Dunhallow', 'Highcliff', 3, ['gray']],
  ['Dunhallow', 'Quillon', 2, ['gray', 'gray']],
  ['Dunhallow', 'Saltcombe', 4, ['red']],
  ['Elmsby', 'Juniper', 2, ['gray', 'gray']],
  ['Elmsby', 'Lindmoor', 5, ['black']],
  ['Emberly', 'Lanthorn', 3, ['gray']],
  ['Emberly', 'Redmarsh', 2, ['gray']],
  ['Emberly', 'Thornwick', 4, ['black']],
  ['Emberly', 'Yarrow', 6, ['yellow']],
  ['Fenmouth', 'Oakhurst', 4, ['yellow']],
  ['Fenmouth', 'Stonemere', 2, ['gray']],
  ['Fenmouth', 'Valemont', 2, ['green', 'white']],
  ['Fenmouth', 'Westerly', 3, ['blue']],
  ['Fenmouth', 'Zephyr', 2, ['yellow', 'red']],
  ['Frostford', 'Quillon', 2, ['gray', 'gray']],
  ['Frostford', 'Saltcombe', 3, ['gray']],
  ['Glenrook', 'Pellam', 5, ['orange', 'white']],
  ['Glenrook', 'Umber', 6, ['gray']],
  ['Greywater', 'Highcliff', 3, ['gray']],
  ['Greywater', 'Ironmoor', 2, ['gray']],
  ['Greywater', 'Saltcombe', 3, ['red']],
  ['Harrowby', 'Redmarsh', 2, ['gray']],
  ['Harrowby', 'Umber', 4, ['gray']],
  ['Highcliff', 'Juniper', 4, ['green']],
  ['Highcliff', 'Oakhurst', 1, ['gray', 'gray']],
  ['Ironmoor', 'Northfold', 2, ['gray', 'gray']],
  ['Juniper', 'Marrowgate', 6, ['black']],
  ['Juniper', 'Quillon', 6, ['blue']],
  ['Kestrel', 'Lindmoor', 3, ['yellow', 'pink']],
  ['Kestrel', 'Pellam', 5, ['green', 'pink']],
  ['Kestrel', 'Umber', 4, ['yellow', 'orange']],
  ['Lanthorn', 'Marrowgate', 6, ['white']],
  ['Lanthorn', 'Redmarsh', 1, ['gray', 'gray']],
  ['Lanthorn', 'Thornwick', 2, ['gray']],
  ['Marrowgate', 'Oakhurst', 3, ['green']],
  ['Marrowgate', 'Westerly', 1, ['gray', 'gray']],
  ['Millstone', 'Stonemere', 1, ['gray', 'gray']],
  ['Millstone', 'Valemont', 3, ['gray']],
  ['Millstone', 'Westerly', 3, ['black']],
  ['Northfold', 'Oakhurst', 4, ['white']],
  ['Northfold', 'Zephyr', 2, ['gray', 'gray']],
  ['Oakhurst', 'Westerly', 3, ['orange']],
  ['Oakhurst', 'Zephyr', 3, ['blue']],
  ['Pellam', 'Umber', 3, ['red', 'yellow']],
  ['Stonemere', 'Valemont', 2, ['gray']],
  ['Stonemere', 'Westerly', 2, ['gray']],
  ['Thornwick', 'Westerly', 6, ['pink']]
];

function buildRoutes(): Route[] {
  const routes: Route[] = [];
  for (const [a, b, length, colors, via] of PAIRS) {
    const first = routes.length;
    colors.forEach((color, index) => {
      const twin = colors.length === 2 ? first + 1 - index : null;
      routes.push({ id: routes.length, a: cityId(a), b: cityId(b), length, color, twin, ...(via ? { via } : {}) });
    });
  }
  return routes;
}

export const ROUTES: Route[] = buildRoutes();

const TICKET_SPECS: [a: string, b: string, points: number][] = [
  ['Valemont', 'Saltcombe', 12],
  ['Quillon', 'Lindmoor', 13],
  ['Carrowmere', 'Valemont', 7],
  ['Greywater', 'Fenmouth', 7],
  ['Ironmoor', 'Juniper', 9],
  ['Emberly', 'Lindmoor', 11],
  ['Frostford', 'Greywater', 4],
  ['Driftwood', 'Lanthorn', 11],
  ['Westerly', 'Harrowby', 10],
  ['Westerly', 'Redmarsh', 8],
  ['Juniper', 'Zephyr', 8],
  ['Dunhallow', 'Northfold', 5],
  ['Oakhurst', 'Umber', 16],
  ['Ashgrove', 'Yarrow', 20],
  ['Alderwick', 'Northfold', 21],
  ['Stonemere', 'Lanthorn', 9],
  ['Pellam', 'Elmsby', 13],
  ['Oakhurst', 'Millstone', 6],
  ['Kestrel', 'Millstone', 17],
  ['Highcliff', 'Redmarsh', 11],
  ['Ironmoor', 'Harrowby', 17],
  ['Bramholt', 'Umber', 8],
  ['Emberly', 'Marrowgate', 9],
  ['Marrowgate', 'Quillon', 9],
  ['Fenmouth', 'Glenrook', 22],
  ['Zephyr', 'Elmsby', 10],
  ['Bramholt', 'Brightwell', 20],
  ['Thornwick', 'Dunhallow', 13],
  ['Stonemere', 'Cobalt', 12],
  ['Saltcombe', 'Carrowmere', 11]
];

export const TICKETS: Ticket[] = TICKET_SPECS.map(([a, b, points], id) => ({ id, a: cityId(a), b: cityId(b), points }));

// Points for claiming a route, by its length
export const ROUTE_POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 };

export function routeName(route: Route): string {
  return `${CITIES[route.a].name} to ${CITIES[route.b].name}`;
}

// The fewest train spaces on any line of routes from one city to another, which is what a ticket between them is worth
export function shortestTrack(a: number, b: number): number {
  const best = CITIES.map(city => (city.id === a ? 0 : Infinity));
  const done = new Set<number>();
  while (!done.has(b)) {
    const city = best.reduce((next, value, id) => (!done.has(id) && (next < 0 || value < best[next]) ? id : next), -1);
    done.add(city);
    for (const route of ROUTES) {
      const other = route.a === city ? route.b : route.b === city ? route.a : null;
      if (other !== null) best[other] = Math.min(best[other], best[city] + route.length);
    }
  }
  return best[b];
}
