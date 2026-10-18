// Helpers for the Ticket to Ride tests: seeded deals, a game already in play with known cards, and a simple player
import { addPlayer, applyMove as platformMove } from '../../shared/seating.ts';
import { emptyHand } from './cards.ts';
import { CITIES, ROUTES } from './map.ts';
import { canAct, canDrawCard, claimError, createGameState, paymentOptions } from './rules.ts';
import { tickettoride } from './index.ts';
import type { Card, GameState, Hand, Move, PlayerState, PublicGameState, Random, Result, Seat } from './types.ts';

// The same deal on every run
export function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ok(result: Result<GameState>): GameState {
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

// Through the platform's turn checks, as the server plays it
export const move = (state: GameState, seat: Seat, value: unknown, random: Random = seeded(9)) =>
  platformMove(tickettoride, state, seat, value, random);

export const played = (state: GameState, seat: Seat, value: unknown, random: Random = seeded(9)) => ok(move(state, seat, value, random));

// Players seated through the platform, with the deal of the given seed, still choosing their first tickets
export function seatedGame(count: number, seed = 1): GameState {
  const random = seeded(seed);
  let state = createGameState('g1');
  for (let i = 0; i < count; i++) {
    const result = addPlayer(tickettoride, state, ['Alice', 'Bob', 'Cara', 'Dan', 'Eve'][i], random);
    if ('error' in result) throw new Error(result.error);
    state = result.state;
  }
  return state;
}

export function hand(cards: Partial<Hand> = {}): Hand {
  return { ...emptyHand(), ...cards };
}

// A game in play with three players, Alice to move, empty hands and a deck of plain red cards unless overridden
export function game(overrides: Partial<GameState> = {}, players: Record<Seat, Partial<PlayerState>> = {}): GameState {
  const base = createGameState('g1');
  const seats = [1, 2, 3];
  return {
    ...base,
    started: true,
    activePlayers: seats,
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    currentPlayer: 1,
    phase: 'play',
    playerCount: 3,
    deck: Array<Card>(20).fill('red'),
    faceUp: ['blue', 'green', 'yellow', 'black', 'white'],
    ticketDeck: Array.from({ length: 21 }, (_, index) => index + 9),
    players: Object.fromEntries(seats.map(seat => [seat, {
      hand: emptyHand(), tickets: [seat * 3 - 3], offered: null, trains: 45, ...players[seat]
    }])),
    ...overrides
  };
}

// The tracks between two cities by name; index 1 is the second track of a double route
export const routeBetween = (a: string, b: string, index = 0) => {
  const found = ROUTES.filter(route => {
    const names = [route.a, route.b].map(id => CITIES[id].name);
    return names.includes(a) && names.includes(b);
  });
  if (!found[index]) throw new Error(`No route ${a} to ${b}`);
  return found[index];
};

// A simple player working from its own view: keep every offered ticket, claim the longest route it can pay for,
// else draw from the deck (or a face-up card when the deck is empty), else draw tickets, else pass
export function anyMove(view: PublicGameState, seat: Seat): Move {
  const me = view.players[seat];
  if (me.offered) return { type: 'keepTickets', tickets: me.offered };
  const handOf = me.hand ?? emptyHand();
  const player = { hand: handOf, trains: me.trains };
  const second = view.drawing === seat;
  if (!second) {
    const routes = ROUTES.filter(route => claimError(view, seat, player, route) === null).sort((x, y) => y.length - x.length);
    if (routes.length > 0) return { type: 'claim', route: routes[0].id, payment: paymentOptions(handOf, routes[0])[0] };
  }
  if (view.deckCount + view.discardCount > 0) return { type: 'drawCard', source: 'deck' };
  if (canDrawCard(view, second)) {
    const slot = view.faceUp.findIndex(card => card !== null && !(second && card === 'locomotive'));
    return { type: 'drawCard', source: slot };
  }
  if (view.ticketDeckCount > 0) return { type: 'drawTickets' };
  return canAct(view, seat, player) ? { type: 'drawTickets' } : { type: 'pass' };
}
