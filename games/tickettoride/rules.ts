// Ticket to Ride rules shared by the browser (what can be claimed and drawn) and the server (validation).
// Rules follow https://en.wikipedia.org/wiki/Ticket_to_Ride_(board_game) and, where it is silent, the Days of Wonder USA rules.
import { pointsText, rankStandings } from '../../shared/standings.ts';
import type { Standing } from '../../shared/types.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { plural } from '../../shared/text.ts';
import {
  MARKET_SIZE, TRAIN_COLORS, addToHand, drawTop, emptyHand, fullDeck, handCards, handSize, refillMarket
} from './cards.ts';
import { ROUTES, TICKETS, routeName } from './map.ts';
import { compareFinal, finalScores, rankWinners } from './scoring.ts';
import type {
  Card, CardSource, GameState, Hand, LastMove, Move, Payment, PlayerState, PublicGameState, Random, Result, Route, Seat, TrainColor
} from './types.ts';

export const TRAINS = 45;
export const START_CARDS = 4;
export const TICKETS_DEALT = 3;
export const KEEP_AT_START = 2;
export const KEEP_LATER = 1;
export const LAST_ROUND_TRAINS = 2; // ending a turn with this many or fewer starts the last round
export const DOUBLES_FROM = 4;      // players needed for both tracks of a double route to be used

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    phase: 'setup',
    playerCount: 0,
    deck: [],
    discards: [],
    faceUp: [],
    ticketDeck: [],
    claimed: {},
    players: {},
    drawing: null,
    lastTurns: null,
    passes: 0,
    final: null,
    lastMove: null
  };
}

// Before the first move the cards are dealt afresh for the current players: 4 train cards and 3 tickets each, 5 face up
export function resetLobby(state: GameState, random: Random): GameState {
  let supply = { deck: shuffle(fullDeck(), random), discards: [] as Card[], faceUp: [] as (Card | null)[] };
  const ticketDeck = shuffle(TICKETS.map(ticket => ticket.id), random);
  const players: Record<Seat, PlayerState> = {};
  for (const seat of state.activePlayers) {
    let hand = emptyHand();
    for (let i = 0; i < START_CARDS; i++) {
      const drawn = drawTop(supply, random);
      supply = drawn.supply;
      if (drawn.card) hand = addToHand(hand, drawn.card);
    }
    players[seat] = { hand, tickets: [], offered: ticketDeck.splice(0, TICKETS_DEALT), trains: TRAINS };
  }
  supply = refillMarket({ ...supply, faceUp: Array<Card | null>(MARKET_SIZE).fill(null) }, random).supply;
  return {
    ...state,
    ...supply,
    phase: 'setup',
    playerCount: state.activePlayers.length,
    ticketDeck,
    claimed: {},
    players,
    drawing: null,
    lastTurns: null,
    passes: 0,
    final: null,
    lastMove: null
  };
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { deck, discards, ticketDeck, players, ...view } = state;
  return {
    ...view,
    deckCount: deck.length,
    discardCount: discards.length,
    ticketDeckCount: ticketDeck.length,
    players: Object.fromEntries(Object.entries(players).map(([key, player]) => {
      const seat = Number(key);
      const own = viewer === seat;
      return [seat, {
        trains: player.trains,
        cardCount: handSize(player.hand),
        ticketCount: player.tickets.length,
        offeredCount: player.offered?.length ?? 0,
        hand: own ? player.hand : null,
        tickets: own || state.isGameOver ? player.tickets : null,
        offered: own ? player.offered : null
      }];
    })),
    undoAvailable
  };
}

// What the browser and the server both ask about a route

type Board = Pick<GameState, 'claimed' | 'playerCount'>;

// Why the route cannot be taken by this player whatever cards they hold, or null
export function routeBlocked(board: Board, seat: Seat, route: Route): string | null {
  if (board.claimed[route.id] !== undefined) return 'That route is already claimed';
  if (route.twin === null) return null;
  const twinOwner = board.claimed[route.twin];
  if (twinOwner === undefined) return null;
  if (board.playerCount < DOUBLES_FROM) return `With ${board.playerCount} players only one track of a double route can be used`;
  return twinOwner === seat ? 'You cannot claim both tracks of a double route' : null;
}

export function paymentError(hand: Hand, route: Route, payment: Payment): string | null {
  const { locomotives } = payment;
  const colored = route.length - locomotives;
  if (locomotives > route.length) return `That route needs only ${route.length} cards`;
  if (hand.locomotive < locomotives) return 'You do not have that many locomotives';
  if (colored === 0) return null;
  if (payment.color === null) return 'Choose a color to pay with';
  if (route.color !== 'gray' && payment.color !== route.color) return `That route needs ${route.color} cards`;
  if (hand[payment.color] < colored) return `You do not have ${colored} ${payment.color} card${colored === 1 ? '' : 's'}`;
  return null;
}

// Every way to pay with as few locomotives as possible: one per color the route takes, and locomotives alone
export function paymentOptions(hand: Hand, route: Route): Payment[] {
  const colors = route.color === 'gray' ? TRAIN_COLORS : [route.color];
  const options: Payment[] = [];
  for (const color of colors) {
    const colored = Math.min(hand[color], route.length);
    if (colored > 0 && route.length - colored <= hand.locomotive) options.push({ color, locomotives: route.length - colored });
  }
  if (hand.locomotive >= route.length) options.push({ color: null, locomotives: route.length });
  return options;
}

// Why this player cannot claim the route now, or null
export function claimError(board: Board, seat: Seat, player: { hand: Hand; trains: number }, route: Route): string | null {
  const blocked = routeBlocked(board, seat, route);
  if (blocked) return blocked;
  if (player.trains < route.length) return `You have only ${player.trains} ${player.trains === 1 ? 'train' : 'trains'} left`;
  return paymentOptions(player.hand, route).length === 0 ? 'You do not have the cards for that route' : null;
}

// How many of the offered tickets must be kept: 2 of the first deal, 1 of a later draw, and never more than were offered
export function ticketsToKeep(phase: GameState['phase'], offered: number): number {
  return Math.min(phase === 'setup' ? KEEP_AT_START : KEEP_LATER, offered);
}

// The table as both sides can see it: counts of the hidden decks and the face-up row
type Table = Board & { deckCount: number; discardCount: number; ticketDeckCount: number; faceUp: (Card | null)[] };

export function tableOf(state: GameState): Table {
  return {
    claimed: state.claimed,
    playerCount: state.playerCount,
    deckCount: state.deck.length,
    discardCount: state.discards.length,
    ticketDeckCount: state.ticketDeck.length,
    faceUp: state.faceUp
  };
}

// Whether any card could be taken, as a first card or as a second (when a face-up locomotive is not allowed)
export function canDrawCard(table: Table, second: boolean): boolean {
  if (table.deckCount + table.discardCount > 0) return true;
  return table.faceUp.some(card => card !== null && !(second && card === 'locomotive'));
}

// True when the player has some action other than passing
export function canAct(table: Table, seat: Seat, player: { hand: Hand; trains: number }): boolean {
  return canDrawCard(table, false) || table.ticketDeckCount > 0 || ROUTES.some(route => claimError(table, seat, player, route) === null);
}

// Reading untrusted moves

function isIndex(value: unknown, size: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < size;
}

function isTrainColor(value: unknown): value is TrainColor {
  return TRAIN_COLORS.some(color => color === value);
}

function parsePayment(value: unknown): Payment | null {
  const input = asRecord(value);
  if (!input || !isIndex(input.locomotives, 7)) return null;
  if (input.color !== null && !isTrainColor(input.color)) return null;
  return { color: input.color, locomotives: input.locomotives };
}

function parseMove(value: unknown): Move | null {
  const input = asRecord(value);
  switch (input?.type) {
    case 'drawCard': {
      const source = input.source;
      if (source === 'deck' || isIndex(source, MARKET_SIZE)) return { type: 'drawCard', source: source as CardSource };
      return null;
    }
    case 'claim': {
      const payment = parsePayment(input.payment);
      return isIndex(input.route, ROUTES.length) && payment ? { type: 'claim', route: input.route, payment } : null;
    }
    case 'drawTickets':
      return { type: 'drawTickets' };
    case 'keepTickets': {
      const tickets = input.tickets;
      if (!Array.isArray(tickets) || tickets.length > TICKETS_DEALT || !tickets.every(id => isIndex(id, TICKETS.length))) return null;
      return new Set(tickets).size === tickets.length ? { type: 'keepTickets', tickets } : null;
    }
    case 'pass':
      return { type: 'pass' };
    default:
      return null;
  }
}

// The status line's words for a move, also used by the history
export function describePayment(payment: Payment, length: number): string {
  const colored = length - payment.locomotives;
  const parts = [
    ...(colored > 0 && payment.color ? [`${colored} ${payment.color}`] : []),
    ...(payment.locomotives > 0 ? [plural(payment.locomotives, 'locomotive')] : [])
  ];
  return parts.join(' and ');
}

export function describe(playerNames: Record<Seat, string>, move: LastMove): string {
  const name = playerNames[move.seat];
  switch (move.type) {
    case 'drawCard': {
      const what = move.card === null ? 'drew a card from the deck' : `took a face-up ${move.card === 'locomotive' ? 'locomotive' : `${move.card} card`}`;
      const reset = move.marketReset ? '; three locomotives were face up, so all five were replaced' : '';
      return `${name} ${what}${reset}`;
    }
    case 'claim': {
      const route = ROUTES[move.route];
      return `${name} claimed ${routeName(route)} (${route.length}, ${route.color}) with ${describePayment(move.payment, route.length)}`;
    }
    case 'drawTickets': return `${name} drew ${plural(move.count, 'destination ticket')}`;
    case 'keepTickets': return move.returned === 0
      ? `${name} kept ${plural(move.kept, 'destination ticket')}`
      : `${name} kept ${plural(move.kept, 'destination ticket')} and returned ${move.returned}`;
    case 'pass': return `${name} could do nothing and passed`;
  }
}

// The end of a turn

function updatePlayer(state: GameState, seat: Seat, change: Partial<PlayerState>): GameState {
  return { ...state, players: { ...state.players, [seat]: { ...state.players[seat], ...change } } };
}

function names(state: GameState, seats: Seat[]): string {
  return seats.map(seat => state.playerNames[seat]).join(' and ');
}

// Tickets are revealed and scored for the players still in the game; any unchosen offer goes back under the deck
function endGame(state: GameState): GameState {
  const tickets = Object.fromEntries(state.activePlayers.map(seat => [seat, state.players[seat].tickets]));
  const final = finalScores(state.claimed, tickets, state.activePlayers);
  const winners = rankWinners(final);
  const points = final[winners[0]].total;
  const players = Object.fromEntries(Object.entries(state.players).map(([seat, player]) => [seat, { ...player, offered: null }]));
  return {
    ...state,
    players,
    isGameOver: true,
    currentPlayer: null,
    drawing: null,
    lastTurns: null,
    final,
    winners,
    gameStatus: winners.length === 1
      ? `${names(state, winners)} wins with ${points} points!`
      : `${names(state, winners)} share the win with ${points} points!`
  };
}

// Seats in turn order after `seat`, ending with `seat`
function roundFrom(state: GameState, seat: Seat): Seat[] {
  const after = state.activePlayers.filter(other => other > seat);
  const before = state.activePlayers.filter(other => other <= seat);
  return [...after, ...before];
}

function endTurn(state: GameState, seat: Seat, lastMove: LastMove, passed = false): GameState {
  const text = describe(state.playerNames, lastMove);
  const passes = passed ? state.passes + 1 : 0;
  let next: GameState = { ...state, lastMove, drawing: null, passes, gameStatus: text };
  if (passed && passes >= state.activePlayers.length) return endGame(next);
  if (next.lastTurns) {
    const lastTurns = next.lastTurns.filter(other => other !== seat);
    if (lastTurns.length === 0) return endGame(next);
    next = { ...next, lastTurns };
  } else if (next.players[seat].trains <= LAST_ROUND_TRAINS) {
    const trains = next.players[seat].trains;
    next = {
      ...next,
      lastTurns: roundFrom(next, seat),
      gameStatus: `${text}. ${state.playerNames[seat]} has ${plural(trains, 'train')} left: everyone, ${state.playerNames[seat]} included, gets one last turn.`
    };
  }
  return { ...next, currentPlayer: nextActivePlayer(next, seat) };
}

// The setup turns go up the seats; once everyone has kept their tickets, the lowest seat starts play
function nextSetupTurn(state: GameState): GameState {
  const waiting = state.activePlayers.find(seat => state.players[seat]?.offered !== null);
  if (waiting !== undefined) return { ...state, currentPlayer: waiting };
  return { ...state, phase: 'play', currentPlayer: state.activePlayers[0] ?? null };
}

// The moves

function drawCard(state: GameState, seat: Seat, source: CardSource, random: Random): Result<GameState> {
  const second = state.drawing === seat;
  let supply = { deck: state.deck, discards: state.discards, faceUp: state.faceUp };
  let card: Card;
  if (source === 'deck') {
    const drawn = drawTop(supply, random);
    if (!drawn.card) return { error: 'There are no cards left to draw' };
    supply = drawn.supply;
    card = drawn.card;
  } else {
    const faceUp = state.faceUp[source] ?? null;
    if (faceUp === null) return { error: 'There is no card there' };
    if (second && faceUp === 'locomotive') return { error: 'A face-up locomotive cannot be your second card' };
    card = faceUp;
    supply = { ...supply, faceUp: supply.faceUp.map((up, slot) => (slot === source ? null : up)) };
  }
  const refilled = refillMarket(supply, random);
  const drawn: GameState = updatePlayer({ ...state, ...refilled.supply }, seat, { hand: addToHand(state.players[seat].hand, card) });
  const lastMove: LastMove = { seat, type: 'drawCard', card: source === 'deck' ? null : card, second, marketReset: refilled.reset };
  const takesOnlyOne = source !== 'deck' && card === 'locomotive';
  if (second || takesOnlyOne || !canDrawCard(tableOf(drawn), true)) return { state: endTurn(drawn, seat, lastMove) };
  return { state: { ...drawn, drawing: seat, lastMove, gameStatus: `${describe(state.playerNames, lastMove)}. They draw a second card.` } };
}

function claim(state: GameState, seat: Seat, routeId: number, payment: Payment, random: Random): Result<GameState> {
  const route = ROUTES[routeId];
  const player = state.players[seat];
  const error = claimError(state, seat, player, route) ?? paymentError(player.hand, route, payment);
  if (error) return { error };
  const paid: Payment = payment.locomotives === route.length ? { color: null, locomotives: route.length } : payment;
  let hand = addToHand(player.hand, 'locomotive', -paid.locomotives);
  const spent: Card[] = Array<Card>(paid.locomotives).fill('locomotive');
  if (paid.color) {
    hand = addToHand(hand, paid.color, -(route.length - paid.locomotives));
    spent.push(...Array<Card>(route.length - paid.locomotives).fill(paid.color));
  }
  const claimed = updatePlayer({
    ...state,
    claimed: { ...state.claimed, [route.id]: seat },
    discards: [...state.discards, ...spent]
  }, seat, { hand, trains: player.trains - route.length });
  // Spent cards may refill an empty market once the deck had run out
  const refilled = refillMarket(claimed, random);
  return { state: endTurn({ ...claimed, ...refilled.supply }, seat, { seat, type: 'claim', route: route.id, payment: paid }) };
}

function drawTickets(state: GameState, seat: Seat): Result<GameState> {
  if (state.ticketDeck.length === 0) return { error: 'There are no destination tickets left' };
  const offered = state.ticketDeck.slice(0, TICKETS_DEALT);
  const lastMove: LastMove = { seat, type: 'drawTickets', count: offered.length };
  const keep = ticketsToKeep(state.phase, offered.length);
  return {
    state: updatePlayer({
      ...state,
      ticketDeck: state.ticketDeck.slice(offered.length),
      lastMove,
      gameStatus: `${describe(state.playerNames, lastMove)}. They keep at least ${keep}.`
    }, seat, { offered })
  };
}

function keepTickets(state: GameState, seat: Seat, tickets: number[]): Result<GameState> {
  const offered = state.players[seat].offered;
  if (!offered) return { error: 'You have no tickets to choose from' };
  const minimum = ticketsToKeep(state.phase, offered.length);
  if (!tickets.every(id => offered.includes(id))) return { error: 'You were not offered that ticket' };
  if (tickets.length < minimum) return { error: `Keep at least ${minimum} ticket${minimum === 1 ? '' : 's'}` };
  const returned = offered.filter(id => !tickets.includes(id));
  const kept = updatePlayer({ ...state, ticketDeck: [...state.ticketDeck, ...returned] }, seat, {
    tickets: [...state.players[seat].tickets, ...tickets],
    offered: null
  });
  const lastMove: LastMove = { seat, type: 'keepTickets', kept: tickets.length, returned: returned.length, initial: state.phase === 'setup' };
  if (state.phase === 'setup') return { state: nextSetupTurn({ ...kept, lastMove, gameStatus: describe(state.playerNames, lastMove) }) };
  return { state: endTurn(kept, seat, lastMove) };
}

export function applyMove(state: GameState, seat: Seat, input: unknown, random: Random): Result<GameState> {
  const move = parseMove(input);
  if (!move) return { error: 'Invalid move' };
  const player = state.players[seat];
  if (!player) return { error: 'You are not in this game' };
  if (state.phase === 'setup' && move.type !== 'keepTickets') return { error: 'Choose which destination tickets to keep first' };
  if (player.offered && move.type !== 'keepTickets') return { error: 'Choose which destination tickets to keep first' };
  if (state.drawing === seat && move.type !== 'drawCard') return { error: 'Draw your second card' };

  switch (move.type) {
    case 'drawCard': return drawCard(state, seat, move.source, random);
    case 'claim': return claim(state, seat, move.route, move.payment, random);
    case 'drawTickets': return drawTickets(state, seat);
    case 'keepTickets': return keepTickets(state, seat, move.tickets);
    case 'pass':
      if (canAct(tableOf(state), seat, player)) return { error: 'You can still draw or claim something' };
      return { state: endTurn(state, seat, { seat, type: 'pass' }, true) };
  }
}

// A dismissed player's routes stay claimed but they are out of the scoring. Their train cards go to the discards,
// their kept tickets leave the game and any tickets they were choosing from go back under the deck.
// If it was their turn, its unfinished part is dropped; a last round that they were the final turn of ends now.
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const player = state.players[seat];
  let next = state;
  if (player) {
    next = updatePlayer({
      ...next,
      discards: [...next.discards, ...handCards(player.hand)],
      ticketDeck: [...next.ticketDeck, ...(player.offered ?? [])]
    }, seat, { hand: emptyHand(), tickets: [], offered: null });
  }
  if (next.drawing === seat) next = { ...next, drawing: null };
  if (next.phase === 'setup') return nextSetupTurn(next);
  if (next.lastTurns) {
    const lastTurns = next.lastTurns.filter(other => other !== seat);
    if (lastTurns.length === 0) return endGame(next);
    next = { ...next, lastTurns };
  }
  return next;
}

// The game's own order: points, then tickets completed, then the longest path. No score yet means no order.
export function finalStandings(state: GameState): Standing[] {
  const final = (seat: Seat) => state.final?.[seat];
  const compare = (a: Seat, b: Seat) => {
    const [first, second] = [final(a), final(b)];
    return first && second ? compareFinal(first, second) : 0;
  };
  return rankStandings(state, compare, seat => pointsText(final(seat)?.total ?? 0));
}
