// Points for routes, completed tickets and the longest continuous path, read from who claimed which route
import { ROUTES, ROUTE_POINTS, TICKETS } from './map.ts';
import type { FinalScore, Route, Seat } from './types.ts';

export const LONGEST_PATH_BONUS = 10;

type Claimed = Record<number, Seat>;

export function routesOf(claimed: Claimed, seat: Seat): Route[] {
  return ROUTES.filter(route => claimed[route.id] === seat);
}

// The score track during play: points for every route claimed
export function routePoints(claimed: Claimed, seat: Seat): number {
  return routesOf(claimed, seat).reduce((total, route) => total + ROUTE_POINTS[route.length], 0);
}

// True when the player's own routes join the two cities
export function connects(claimed: Claimed, seat: Seat, from: number, to: number): boolean {
  const routes = routesOf(claimed, seat);
  const reached = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const city = queue.pop() as number;
    for (const route of routes) {
      const other = route.a === city ? route.b : route.b === city ? route.a : null;
      if (other !== null && !reached.has(other)) {
        reached.add(other);
        queue.push(other);
      }
    }
  }
  return reached.has(to);
}

export function ticketDone(claimed: Claimed, seat: Seat, ticket: number): boolean {
  return connects(claimed, seat, TICKETS[ticket].a, TICKETS[ticket].b);
}

// The most trains in one continuous line of the player's routes: a city may be passed through again, a route used only once
export function longestPath(claimed: Claimed, seat: Seat): number {
  const routes = routesOf(claimed, seat);
  const used = new Set<number>();
  const walk = (city: number): number => {
    let best = 0;
    for (const route of routes) {
      if (used.has(route.id) || (route.a !== city && route.b !== city)) continue;
      used.add(route.id);
      best = Math.max(best, route.length + walk(route.a === city ? route.b : route.a));
      used.delete(route.id);
    }
    return best;
  };
  const cities = new Set(routes.flatMap(route => [route.a, route.b]));
  return Math.max(0, ...[...cities].map(walk));
}

// The final tally for the players still in the game. Every player with the longest path gets the bonus.
export function finalScores(claimed: Claimed, tickets: Record<Seat, number[]>, seats: Seat[]): Record<Seat, FinalScore> {
  const paths = Object.fromEntries(seats.map(seat => [seat, longestPath(claimed, seat)]));
  const longest = Math.max(0, ...Object.values(paths));
  return Object.fromEntries(seats.map(seat => {
    const results = tickets[seat].map(ticket => ({ ticket, completed: ticketDone(claimed, seat, ticket) }));
    const ticketPoints = results.reduce((total, { ticket, completed }) => total + (completed ? 1 : -1) * TICKETS[ticket].points, 0);
    const routes = routePoints(claimed, seat);
    const longestBonus = longest > 0 && paths[seat] === longest;
    return [seat, {
      routes,
      tickets: results,
      ticketPoints,
      longestPath: paths[seat],
      longestBonus,
      total: routes + ticketPoints + (longestBonus ? LONGEST_PATH_BONUS : 0)
    }];
  }));
}

// Most points, then most tickets completed, then the longest path; a tie on all three is shared
export function rankWinners(scores: Record<Seat, FinalScore>): Seat[] {
  const completed = (score: FinalScore) => score.tickets.filter(result => result.completed).length;
  let leaders = Object.keys(scores).map(Number);
  for (const measure of [(s: FinalScore) => s.total, completed, (s: FinalScore) => s.longestPath]) {
    const top = Math.max(...leaders.map(seat => measure(scores[seat])));
    leaders = leaders.filter(seat => measure(scores[seat]) === top);
  }
  return leaders;
}
