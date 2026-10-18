// The original USA map: 36 cities and 100 tracks (78 city pairs, 22 of them double routes), and the 30 destination tickets.
// Routes and tickets were checked against the published board and two independent lists (the zugumzug-rails seed data and
// the route table of the GameGen-Verifier spec), which agree track for track; together the tracks hold 309 train spaces.
// City positions are this site's own drawing: a plain projection of each city's longitude and latitude.
import type { City, Route, RouteColor, Ticket } from './types.ts';

type CitySpec = [name: string, x: number, y: number, label?: City['label']];

const CITY_SPECS: CitySpec[] = [
  ['Atlanta', 737, 424, 'below'],
  ['Boston', 971, 232, 'right'],
  ['Calgary', 214, 42, 'above'],
  ['Charleston', 816, 444, 'right'],
  ['Chicago', 681, 243, 'above'],
  ['Dallas', 519, 444, 'left'],
  ['Denver', 374, 292, 'below'],
  ['Duluth', 601, 136, 'above'],
  ['El Paso', 348, 466, 'below'],
  ['Helena', 251, 140, 'above'],
  ['Houston', 543, 510, 'below'],
  ['Kansas City', 557, 305, 'right'],
  ['Las Vegas', 197, 369, 'left'],
  ['Little Rock', 598, 402, 'right'],
  ['Los Angeles', 142, 416, 'left'],
  ['Miami', 811, 598, 'right'],
  ['Montreal', 927, 164, 'above'],
  ['Nashville', 695, 369, 'above'],
  ['New Orleans', 637, 505, 'below'],
  ['New York', 920, 270, 'right'],
  ['Oklahoma City', 506, 384, 'left'],
  ['Omaha', 535, 257, 'left'],
  ['Phoenix', 249, 430, 'below'],
  ['Pittsburgh', 814, 276, 'left'],
  ['Portland', 63, 164, 'left'],
  ['Raleigh', 839, 378, 'right'],
  ['Saint Louis', 635, 316, 'right'],
  ['Salt Lake City', 253, 268, 'right'],
  ['San Francisco', 68, 334, 'left'],
  ['Santa Fe', 359, 380, 'right'],
  ['Sault St. Marie', 739, 142, 'above'],
  ['Seattle', 70, 118, 'left'],
  ['Toronto', 825, 204, 'above'],
  ['Vancouver', 56, 81, 'left'],
  ['Washington', 867, 309, 'right'],
  ['Winnipeg', 513, 67, 'above']
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
  ['Vancouver', 'Seattle', 1, ['gray', 'gray']],
  ['Vancouver', 'Calgary', 3, ['gray']],
  ['Seattle', 'Calgary', 4, ['gray']],
  ['Seattle', 'Portland', 1, ['gray', 'gray']],
  ['Seattle', 'Helena', 6, ['yellow']],
  ['Portland', 'San Francisco', 5, ['green', 'pink']],
  ['Portland', 'Salt Lake City', 6, ['blue']],
  ['San Francisco', 'Salt Lake City', 5, ['orange', 'white']],
  ['San Francisco', 'Los Angeles', 3, ['yellow', 'pink']],
  ['Los Angeles', 'Las Vegas', 2, ['gray']],
  ['Los Angeles', 'Phoenix', 3, ['gray']],
  ['Los Angeles', 'El Paso', 6, ['black'], [240, 500]],
  ['Las Vegas', 'Salt Lake City', 3, ['orange']],
  ['Calgary', 'Helena', 4, ['gray']],
  ['Calgary', 'Winnipeg', 6, ['white']],
  ['Helena', 'Winnipeg', 4, ['blue']],
  ['Helena', 'Duluth', 6, ['orange']],
  ['Helena', 'Omaha', 5, ['red']],
  ['Helena', 'Denver', 4, ['green']],
  ['Helena', 'Salt Lake City', 3, ['pink']],
  ['Salt Lake City', 'Denver', 3, ['red', 'yellow']],
  ['Phoenix', 'Denver', 5, ['white']],
  ['Phoenix', 'Santa Fe', 3, ['gray']],
  ['Phoenix', 'El Paso', 3, ['gray']],
  ['El Paso', 'Santa Fe', 2, ['gray']],
  ['El Paso', 'Oklahoma City', 5, ['yellow']],
  ['El Paso', 'Dallas', 4, ['red']],
  ['El Paso', 'Houston', 6, ['green']],
  ['Santa Fe', 'Denver', 2, ['gray']],
  ['Santa Fe', 'Oklahoma City', 3, ['blue']],
  ['Denver', 'Omaha', 4, ['pink']],
  ['Denver', 'Kansas City', 4, ['black', 'orange']],
  ['Denver', 'Oklahoma City', 4, ['red']],
  ['Winnipeg', 'Duluth', 4, ['black']],
  ['Winnipeg', 'Sault St. Marie', 6, ['gray']],
  ['Duluth', 'Sault St. Marie', 3, ['gray']],
  ['Duluth', 'Toronto', 6, ['pink']],
  ['Duluth', 'Chicago', 3, ['red']],
  ['Duluth', 'Omaha', 2, ['gray', 'gray']],
  ['Omaha', 'Chicago', 4, ['blue']],
  ['Omaha', 'Kansas City', 1, ['gray', 'gray']],
  ['Kansas City', 'Saint Louis', 2, ['blue', 'pink']],
  ['Kansas City', 'Oklahoma City', 2, ['gray', 'gray']],
  ['Oklahoma City', 'Dallas', 2, ['gray', 'gray']],
  ['Oklahoma City', 'Little Rock', 2, ['gray']],
  ['Dallas', 'Little Rock', 2, ['gray']],
  ['Dallas', 'Houston', 1, ['gray', 'gray']],
  ['Houston', 'New Orleans', 2, ['gray']],
  ['Little Rock', 'Saint Louis', 2, ['gray']],
  ['Little Rock', 'Nashville', 3, ['white']],
  ['Little Rock', 'New Orleans', 3, ['green']],
  ['New Orleans', 'Atlanta', 4, ['yellow', 'orange']],
  ['New Orleans', 'Miami', 6, ['red']],
  ['Saint Louis', 'Chicago', 2, ['green', 'white']],
  ['Saint Louis', 'Nashville', 2, ['gray']],
  ['Saint Louis', 'Pittsburgh', 5, ['green']],
  ['Chicago', 'Pittsburgh', 3, ['orange', 'black']],
  ['Chicago', 'Toronto', 4, ['white']],
  ['Sault St. Marie', 'Toronto', 2, ['gray']],
  ['Sault St. Marie', 'Montreal', 5, ['black']],
  ['Toronto', 'Montreal', 3, ['gray']],
  ['Toronto', 'Pittsburgh', 2, ['gray']],
  ['Montreal', 'Boston', 2, ['gray', 'gray']],
  ['Montreal', 'New York', 3, ['blue']],
  ['Boston', 'New York', 2, ['yellow', 'red']],
  ['New York', 'Pittsburgh', 2, ['white', 'green']],
  ['New York', 'Washington', 2, ['orange', 'black']],
  ['Pittsburgh', 'Washington', 2, ['gray']],
  ['Pittsburgh', 'Raleigh', 2, ['gray']],
  ['Pittsburgh', 'Nashville', 4, ['yellow']],
  ['Washington', 'Raleigh', 2, ['gray', 'gray']],
  ['Raleigh', 'Nashville', 3, ['black']],
  ['Raleigh', 'Atlanta', 2, ['gray', 'gray']],
  ['Raleigh', 'Charleston', 2, ['gray']],
  ['Nashville', 'Atlanta', 1, ['gray']],
  ['Atlanta', 'Charleston', 2, ['gray']],
  ['Atlanta', 'Miami', 5, ['blue']],
  ['Charleston', 'Miami', 4, ['pink']]
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
  ['Boston', 'Miami', 12],
  ['Calgary', 'Phoenix', 13],
  ['Calgary', 'Salt Lake City', 7],
  ['Chicago', 'New Orleans', 7],
  ['Chicago', 'Santa Fe', 9],
  ['Dallas', 'New York', 11],
  ['Denver', 'El Paso', 4],
  ['Denver', 'Pittsburgh', 11],
  ['Duluth', 'El Paso', 10],
  ['Duluth', 'Houston', 8],
  ['Helena', 'Los Angeles', 8],
  ['Kansas City', 'Houston', 5],
  ['Los Angeles', 'Chicago', 16],
  ['Los Angeles', 'Miami', 20],
  ['Los Angeles', 'New York', 21],
  ['Montreal', 'Atlanta', 9],
  ['Montreal', 'New Orleans', 13],
  ['New York', 'Atlanta', 6],
  ['Portland', 'Nashville', 17],
  ['Portland', 'Phoenix', 11],
  ['San Francisco', 'Atlanta', 17],
  ['Sault St. Marie', 'Nashville', 8],
  ['Sault St. Marie', 'Oklahoma City', 9],
  ['Seattle', 'Los Angeles', 9],
  ['Seattle', 'New York', 22],
  ['Toronto', 'Miami', 10],
  ['Vancouver', 'Montreal', 20],
  ['Vancouver', 'Santa Fe', 13],
  ['Winnipeg', 'Houston', 12],
  ['Winnipeg', 'Little Rock', 11]
];

export const TICKETS: Ticket[] = TICKET_SPECS.map(([a, b, points], id) => ({ id, a: cityId(a), b: cityId(b), points }));

// Points for claiming a route, by its length
export const ROUTE_POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 };

export function routeName(route: Route): string {
  return `${CITIES[route.a].name} to ${CITIES[route.b].name}`;
}

export function ticketName(ticket: Ticket): string {
  return `${CITIES[ticket.a].name} to ${CITIES[ticket.b].name}`;
}
