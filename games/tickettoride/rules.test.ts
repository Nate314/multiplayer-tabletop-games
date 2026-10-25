import { createGameState, finalStandings } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handSize, refillMarket } from './cards.ts';
import { ROUTES, TICKETS } from './map.ts';
import { applyMove, paymentOptions, toPublicState } from './rules.ts';
import { finalScores, longestPath, rankWinners, routePoints, ticketDone } from './scoring.ts';
import { anyMove, game, hand, move, played, routeBetween, seatedGame, seeded } from './testing.ts';
import { removePlayer } from '../../shared/seating.ts';
import { tickettoride } from './index.ts';
import type { Card, FinalScore, GameState, PublicGameState, Seat } from './types.ts';

const total = (state: GameState) =>
  state.deck.length + state.discards.length + state.faceUp.filter(card => card !== null).length +
  Object.values(state.players).reduce((sum, player) => sum + handSize(player.hand), 0);

const claimOf = (route: number, color: Card | null, locomotives = 0) => ({ type: 'claim', route, payment: { color, locomotives } });

// Claims the given routes for a seat without playing them, for scoring tests
const owning = (state: GameState, seat: Seat, ...routes: number[]): GameState =>
  ({ ...state, claimed: { ...state.claimed, ...Object.fromEntries(routes.map(id => [id, seat])) } });

test('setup deals 4 train cards and 3 tickets each, 5 face up and 45 trains', () => {
  const state = seatedGame(3);
  assert.equal(state.phase, 'setup');
  assert.equal(state.playerCount, 3);
  assert.equal(state.currentPlayer, 1);
  for (const seat of [1, 2, 3]) {
    assert.equal(handSize(state.players[seat].hand), 4);
    assert.equal(state.players[seat].offered?.length, 3);
    assert.equal(state.players[seat].trains, 45);
    assert.deepEqual(state.players[seat].tickets, []);
  }
  assert.equal(state.faceUp.length, 5);
  assert.ok(state.faceUp.filter(card => card === 'locomotive').length < 3);
  assert.equal(total(state), 110);
  assert.equal(state.ticketDeck.length, 21);
});

test('each player in turn keeps 2 or 3 of their first tickets, then the first seat starts', () => {
  let state = seatedGame(3);
  const offered = state.players[1].offered as number[];
  assert.deepEqual(move(state, 1, { type: 'keepTickets', tickets: [offered[0]] }), { error: 'Keep at least 2 tickets' });
  assert.deepEqual(move(state, 1, { type: 'drawCard', source: 'deck' }), { error: 'Choose which destination tickets to keep first' });
  assert.deepEqual(move(state, 2, { type: 'keepTickets', tickets: [] }), { error: 'Not your turn' });
  state = played(state, 1, { type: 'keepTickets', tickets: offered.slice(0, 2) });
  assert.deepEqual(state.players[1].tickets, offered.slice(0, 2));
  assert.equal(state.ticketDeck[state.ticketDeck.length - 1], offered[2]);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.started, true);
  state = played(state, 2, { type: 'keepTickets', tickets: state.players[2].offered });
  assert.equal(state.phase, 'setup');
  state = played(state, 3, { type: 'keepTickets', tickets: state.players[3].offered });
  assert.equal(state.phase, 'play');
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.lastMove?.type, 'keepTickets');
});

test('drawing two cards from the deck ends the turn after the second', () => {
  let state = game();
  state = played(state, 1, { type: 'drawCard', source: 'deck' });
  assert.equal(state.drawing, 1);
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(move(state, 1, { type: 'drawTickets' }), { error: 'Draw your second card' });
  state = played(state, 1, { type: 'drawCard', source: 0 });
  assert.equal(state.players[1].hand.red, 1);
  assert.equal(state.players[1].hand.blue, 1);
  assert.equal(state.faceUp[0], 'red'); // refilled from the deck
  assert.equal(state.drawing, null);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.lastMove?.type === 'drawCard' && state.lastMove.second, true);
});

test('a face-up locomotive is the whole draw, and cannot be the second card', () => {
  const faceUp: Card[] = ['locomotive', 'green', 'yellow', 'black', 'white'];
  const first = played(game({ faceUp }), 1, { type: 'drawCard', source: 0 });
  assert.equal(first.players[1].hand.locomotive, 1);
  assert.equal(first.currentPlayer, 2);

  const half = played(game({ faceUp }), 1, { type: 'drawCard', source: 1 });
  assert.deepEqual(move(half, 1, { type: 'drawCard', source: 0 }), { error: 'A face-up locomotive cannot be your second card' });
  const done = played(half, 1, { type: 'drawCard', source: 2 });
  assert.equal(done.currentPlayer, 2);
});

test('a locomotive drawn from the deck counts as one card', () => {
  const deck: Card[] = ['red', 'locomotive'];
  const state = played(game({ deck }), 1, { type: 'drawCard', source: 'deck' });
  assert.equal(state.players[1].hand.locomotive, 1);
  assert.equal(state.drawing, 1);
  assert.equal(state.lastMove?.type === 'drawCard' && state.lastMove.card, null); // a blind draw is never named
});

test('three face-up locomotives send all five to the discards and five more are turned up', () => {
  const deck: Card[] = [...Array<Card>(10).fill('orange'), 'locomotive'];
  const state = played(game({ deck, faceUp: ['red', 'locomotive', 'locomotive', 'green', 'blue'] }), 1, { type: 'drawCard', source: 0 });
  assert.deepEqual(state.faceUp, ['orange', 'orange', 'orange', 'orange', 'orange']);
  assert.deepEqual([...state.discards].sort(), ['blue', 'green', 'locomotive', 'locomotive', 'locomotive']);
  assert.equal(state.lastMove?.type === 'drawCard' && state.lastMove.marketReset, true);
  assert.equal(total(state), 1 + 11 + 4);
});

test('the market stays put when too few other cards are left to replace three locomotives', () => {
  const supply = { deck: [] as Card[], discards: [] as Card[], faceUp: ['locomotive', 'locomotive', 'locomotive', 'red', null] as (Card | null)[] };
  const { supply: after, reset } = refillMarket(supply, seeded(1));
  assert.equal(reset, false);
  assert.deepEqual(after.faceUp, supply.faceUp);
});

test('the discards are shuffled into a new deck when it runs out, and with neither there is nothing to draw', () => {
  const discards: Card[] = ['pink', 'pink'];
  const state = played(game({ deck: [], discards }), 1, { type: 'drawCard', source: 'deck' });
  assert.equal(state.players[1].hand.pink, 1);
  assert.equal(state.deck.length, 1);
  assert.equal(state.discards.length, 0);

  const empty = game({ deck: [], discards: [], faceUp: [null, null, null, null, null] });
  assert.deepEqual(move(empty, 1, { type: 'drawCard', source: 'deck' }), { error: 'There are no cards left to draw' });
  assert.deepEqual(move(empty, 1, { type: 'drawCard', source: 0 }), { error: 'There is no card there' });
  // One face-up card and nothing else: the turn ends after it
  const last = played(game({ deck: [], discards: [], faceUp: ['red', null, null, null, null] }), 1, { type: 'drawCard', source: 0 });
  assert.equal(last.currentPlayer, 2);
});

test('claiming a colored route spends that color, locomotives as wild, and scores by length', () => {
  const route = routeBetween('Denver', 'Omaha'); // 4 pink
  const start = game({}, { 1: { hand: hand({ pink: 3, locomotive: 2, red: 4 }) } });
  assert.deepEqual(move(start, 1, claimOf(route.id, 'red')), { error: 'That route needs pink cards' });
  assert.deepEqual(move(start, 1, claimOf(route.id, 'pink')), { error: 'You do not have 4 pink cards' });
  assert.deepEqual(move(start, 1, claimOf(route.id, 'pink', 3)), { error: 'You do not have that many locomotives' });
  assert.deepEqual(move(start, 1, claimOf(route.id, null, 1)), { error: 'Choose a color to pay with' });
  assert.deepEqual(paymentOptions(start.players[1].hand, route), [{ color: 'pink', locomotives: 1 }]);

  const state = played(start, 1, claimOf(route.id, 'pink', 1));
  assert.equal(state.claimed[route.id], 1);
  assert.deepEqual(state.players[1].hand, hand({ locomotive: 1, red: 4 }));
  assert.equal(state.players[1].trains, 41);
  assert.equal(routePoints(state.claimed, 1), 7);
  assert.equal(state.discards.length, 4);
  assert.equal(state.currentPlayer, 2);
});

test('a gray route takes any one color, or locomotives alone', () => {
  const route = routeBetween('Pittsburgh', 'Raleigh'); // 2 gray
  const start = game({}, { 1: { hand: hand({ green: 1, black: 2, locomotive: 2 }) } });
  assert.deepEqual(paymentOptions(start.players[1].hand, route), [
    { color: 'black', locomotives: 0 }, { color: 'green', locomotives: 1 }, { color: null, locomotives: 2 }
  ]);
  const black = played(start, 1, claimOf(route.id, 'black'));
  assert.equal(black.players[1].hand.black, 0);
  const wild = played(start, 1, claimOf(route.id, 'yellow', 2));
  assert.deepEqual(wild.lastMove, { seat: 1, type: 'claim', route: route.id, payment: { color: null, locomotives: 2 } });
});

test('a route needs enough trains, and an owned route cannot be claimed again', () => {
  const route = routeBetween('Seattle', 'Helena'); // 6 yellow
  const short = game({}, { 1: { hand: hand({ yellow: 6 }), trains: 5 } });
  assert.deepEqual(move(short, 1, claimOf(route.id, 'yellow')), { error: 'You have only 5 trains left' });
  const taken = game({ claimed: { [route.id]: 2 } }, { 1: { hand: hand({ yellow: 6 }) } });
  assert.deepEqual(move(taken, 1, claimOf(route.id, 'yellow')), { error: 'That route is already claimed' });
});

test('with 2 or 3 players only one track of a double route is used', () => {
  const [blue, pink] = [routeBetween('Kansas City', 'Saint Louis', 0), routeBetween('Kansas City', 'Saint Louis', 1)];
  assert.equal(blue.twin, pink.id);
  const cards = { 1: { hand: hand({ blue: 2, pink: 2 }) }, 2: { hand: hand({ blue: 2, pink: 2 }) } };
  const three = played(game({}, cards), 1, claimOf(blue.id, blue.color as Card));
  assert.deepEqual(move(three, 2, claimOf(pink.id, pink.color as Card)), { error: 'With 3 players only one track of a double route can be used' });

  const four = game({ playerCount: 4, activePlayers: [1, 2, 3, 4], playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' } }, cards);
  const withFour = { ...four, players: { ...four.players, 4: { ...four.players[3] } } };
  const first = played(withFour, 1, claimOf(blue.id, blue.color as Card));
  const both = played(first, 2, claimOf(pink.id, pink.color as Card));
  assert.equal(both.claimed[pink.id], 2);
  const sameOwner = { ...first, currentPlayer: 1 };
  assert.deepEqual(move(sameOwner, 1, claimOf(pink.id, pink.color as Card)), { error: 'You cannot claim both tracks of a double route' });
});

test('drawing tickets offers 3, keeps at least 1 and puts the rest under the deck', () => {
  let state = played(game(), 1, { type: 'drawTickets' });
  assert.deepEqual(state.players[1].offered, [9, 10, 11]);
  assert.equal(state.ticketDeck.length, 18);
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(move(state, 1, { type: 'drawCard', source: 'deck' }), { error: 'Choose which destination tickets to keep first' });
  assert.deepEqual(move(state, 1, { type: 'keepTickets', tickets: [] }), { error: 'Keep at least 1 ticket' });
  assert.deepEqual(move(state, 1, { type: 'keepTickets', tickets: [12] }), { error: 'You were not offered that ticket' });
  state = played(state, 1, { type: 'keepTickets', tickets: [10] });
  assert.deepEqual(state.players[1].tickets, [0, 10]);
  assert.deepEqual(state.ticketDeck.slice(-2), [9, 11]);
  assert.equal(state.currentPlayer, 2);

  const two = played(game({ ticketDeck: [20, 21] }), 1, { type: 'drawTickets' });
  assert.deepEqual(two.players[1].offered, [20, 21]);
  assert.deepEqual(move(game({ ticketDeck: [] }), 1, { type: 'drawTickets' }), { error: 'There are no destination tickets left' });
});

test('tickets are completed through a player\'s own routes only', () => {
  // Ticket 6 is Denver to El Paso
  assert.deepEqual([TICKETS[6].points], [4]);
  const route = (a: string, b: string) => routeBetween(a, b).id;
  let state = owning(game(), 1, route('Denver', 'Santa Fe'));
  assert.equal(ticketDone(state.claimed, 1, 6), false);
  state = owning(state, 2, route('Santa Fe', 'El Paso'));
  assert.equal(ticketDone(state.claimed, 1, 6), false);
  state = owning(state, 1, route('Santa Fe', 'Phoenix'), route('Phoenix', 'El Paso'));
  assert.equal(ticketDone(state.claimed, 1, 6), true);
});

test('the longest path may revisit a city but uses each route once', () => {
  const route = (a: string, b: string) => routeBetween(a, b).id;
  // A loop Denver, Santa Fe, Oklahoma City back to Denver, with a tail from Denver to Helena
  const claimed = owning(game(), 1,
    route('Denver', 'Santa Fe'), route('Santa Fe', 'Oklahoma City'), route('Oklahoma City', 'Denver'), route('Denver', 'Helena'),
    route('El Paso', 'Phoenix')).claimed;
  assert.equal(longestPath(claimed, 1), 2 + 3 + 4 + 4);
  assert.equal(longestPath(claimed, 2), 0);
  // A branch: only the two longest arms join into one path
  const fork = owning(game(), 2, route('Denver', 'Helena'), route('Denver', 'Phoenix'), route('Denver', 'Omaha')).claimed;
  assert.equal(longestPath(fork, 2), 5 + 4);
});

test('final scores add completed tickets, subtract missed ones and give tied longest paths the bonus', () => {
  const route = (a: string, b: string) => routeBetween(a, b).id;
  let state = owning(game(), 1, route('Denver', 'Santa Fe'), route('Santa Fe', 'El Paso'));
  state = owning(state, 2, route('Phoenix', 'Santa Fe'), route('Las Vegas', 'Los Angeles'));
  const scores = finalScores(state.claimed, { 1: [6, 0], 2: [6] }, [1, 2]);
  assert.deepEqual(scores[1], {
    routes: 4, tickets: [{ ticket: 6, completed: true }, { ticket: 0, completed: false }], ticketPoints: 4 - 12,
    longestPath: 4, longestBonus: true, total: 4 - 8 + 10
  });
  assert.equal(scores[2].longestPath, 3);
  assert.equal(scores[2].longestBonus, false);
  const tie = owning(owning(game(), 1, route('Denver', 'Santa Fe')), 2, route('El Paso', 'Santa Fe'));
  const tied = finalScores(tie.claimed, { 1: [], 2: [], 3: [] }, [1, 2, 3]);
  assert.deepEqual([1, 2, 3].map(seat => tied[seat].longestBonus), [true, true, false]);
});

test('ties go to the most tickets completed, then the longest path, and are otherwise shared', () => {
  const score = (total: number, done: number, longest: number) => ({
    routes: total, ticketPoints: 0, longestBonus: false, total, longestPath: longest,
    tickets: Array.from({ length: done }, (_, ticket) => ({ ticket, completed: true }))
  });
  assert.deepEqual(rankWinners({ 1: score(50, 1, 9), 2: score(50, 2, 3), 3: score(40, 5, 20) }), [2]);
  assert.deepEqual(rankWinners({ 1: score(50, 2, 9), 2: score(50, 2, 3) }), [1]);
  assert.deepEqual(rankWinners({ 1: score(50, 2, 9), 2: score(50, 2, 9) }), [1, 2]);
});

test('ending a turn with 2 trains or fewer gives everyone one last turn, then the game is scored', () => {
  const route = routeBetween('Nashville', 'Atlanta'); // 1 gray
  let state = game({}, { 2: { hand: hand({ red: 1 }), trains: 3 } });
  state = played(played(state, 1, { type: 'drawCard', source: 'deck' }), 1, { type: 'drawCard', source: 'deck' });
  state = played(state, 2, claimOf(route.id, 'red'));
  assert.deepEqual(state.lastTurns, [3, 1, 2]);
  assert.match(state.gameStatus, /Bob has 2 trains left: everyone, Bob included, gets one last turn/);
  for (const seat of [3, 1]) state = played(played(state, seat, { type: 'drawCard', source: 'deck' }), seat, { type: 'drawCard', source: 'deck' });
  assert.equal(state.isGameOver, false);
  assert.equal(state.currentPlayer, 2);
  state = played(state, 2, { type: 'drawTickets' });
  assert.equal(state.isGameOver, false);
  state = played(state, 2, { type: 'keepTickets', tickets: state.players[2].offered?.slice(0, 1) });
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);
  assert.ok(state.final);
  assert.deepEqual(Object.keys(state.final).map(Number), [1, 2, 3]);
  assert.equal(state.final[2].routes, 1);
  assert.equal(state.winners.length >= 1, true);
  // At the end everyone's tickets are shown, even to the table
  const table = toPublicState(state, false, null);
  assert.deepEqual(table.players[2].tickets, state.players[2].tickets);
  assert.deepEqual(move(state, 1, { type: 'drawCard', source: 'deck' }), { error: 'The game is over' });
});

test('a player who cannot do anything passes, and a whole round of passes ends the game', () => {
  const stuck = game({ deck: [], discards: [], faceUp: [null, null, null, null, null], ticketDeck: [] });
  assert.deepEqual(move(game(), 1, { type: 'pass' }), { error: 'You can still draw or claim something' });
  let state = played(stuck, 1, { type: 'pass' });
  assert.equal(state.currentPlayer, 2);
  state = played(played(state, 2, { type: 'pass' }), 3, { type: 'pass' });
  assert.equal(state.isGameOver, true);
});

test('invalid moves are refused and change nothing', () => {
  const state = game({}, { 1: { hand: hand({ red: 3 }) } });
  const before = structuredClone(state);
  const inputs: unknown[] = [
    null, 'drawCard', 42, {}, { type: 'fly' },
    { type: 'drawCard' }, { type: 'drawCard', source: 5 }, { type: 'drawCard', source: -1 }, { type: 'drawCard', source: 1.5 },
    { type: 'claim', route: 100, payment: { color: 'red', locomotives: 0 } },
    { type: 'claim', route: -1, payment: { color: 'red', locomotives: 0 } },
    { type: 'claim', route: 0, payment: { color: 'purple', locomotives: 0 } },
    { type: 'claim', route: 0, payment: { color: 'red', locomotives: -1 } },
    { type: 'claim', route: 0, payment: { color: 'red', locomotives: 0.5 } },
    { type: 'claim', route: 0 },
    { type: 'keepTickets', tickets: 'all' }, { type: 'keepTickets', tickets: [1, 1] }, { type: 'keepTickets', tickets: [1, 2, 3, 4] }
  ];
  for (const input of inputs) {
    const result = move(state, 1, input);
    assert.ok('error' in result, JSON.stringify(input));
  }
  assert.deepEqual(applyMove(state, 9, { type: 'drawTickets' }, seeded(1)), { error: 'You are not in this game' });
  assert.deepEqual(move(state, 1, { type: 'keepTickets', tickets: [9] }), { error: 'You have no tickets to choose from' });
  assert.deepEqual(move(state, 2, { type: 'drawTickets' }), { error: 'Not your turn' });
  assert.deepEqual(state, before);
});

test('a player dismissed halfway through drawing cards: the next player starts afresh and their cards are discarded', () => {
  let state = played(game({}, { 1: { hand: hand({ blue: 2 }) } }), 1, { type: 'drawCard', source: 'deck' });
  assert.equal(state.drawing, 1);
  const routeId = routeBetween('Denver', 'Santa Fe').id;
  state = owning(state, 1, routeId);
  state = removePlayer(tickettoride, state, 1, seeded(3));
  assert.deepEqual(state.activePlayers, [2, 3]);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.drawing, null);
  assert.equal(state.claimed[routeId], 1); // their routes stay claimed
  assert.equal(handSize(state.players[1].hand), 0);
  assert.deepEqual(state.players[1].tickets, []);
  assert.equal(state.discards.length, 3);
  state = played(state, 2, { type: 'drawCard', source: 'deck' });
  assert.equal(state.drawing, 2);
});

test('a player dismissed while choosing tickets returns them under the deck', () => {
  let state = played(game(), 1, { type: 'drawTickets' });
  state = removePlayer(tickettoride, state, 1, seeded(3));
  assert.equal(state.players[1].offered, null);
  assert.deepEqual(state.ticketDeck.slice(-3), [9, 10, 11]);
  assert.equal(state.ticketDeck.length, 21);
  assert.equal(state.currentPlayer, 2);
  assert.equal(played(state, 2, { type: 'drawTickets' }).players[2].offered?.length, 3);
});

test('a player dismissed during the first ticket choice hands the choice to the next seat', () => {
  let state = seatedGame(3);
  state = played(state, 1, { type: 'keepTickets', tickets: state.players[1].offered });
  state = { ...state, started: true };
  state = removePlayer(tickettoride, state, 2, seeded(3));
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.phase, 'setup');
  state = played(state, 3, { type: 'keepTickets', tickets: state.players[3].offered?.slice(0, 2) });
  assert.equal(state.phase, 'play');
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.ticketDeck.length, 21 + 3 + 1);
});

test('a dismissal during the last round ends the game when it was the final turn, without the dismissed player', () => {
  const state = game({ lastTurns: [2], currentPlayer: 2 });
  const ended = removePlayer(tickettoride, state, 2, seeded(3));
  assert.equal(ended.isGameOver, true);
  assert.deepEqual(Object.keys(ended.final ?? {}).map(Number), [1, 3]);
  const waiting = removePlayer(tickettoride, game({ lastTurns: [3, 1], currentPlayer: 2 }), 3, seeded(3));
  assert.deepEqual(waiting.lastTurns, [1]);
  assert.equal(waiting.isGameOver, false);
});

// Every hidden field of one player's public view: what a viewer may not see of anyone else
function assertHidden(view: Omit<PublicGameState, 'moveCount'>, viewer: Seat | null) {
  assert.equal('deck' in view, false);
  assert.equal('discards' in view, false);
  assert.equal('ticketDeck' in view, false);
  for (const [key, player] of Object.entries(view.players)) {
    if (Number(key) === viewer) continue;
    assert.equal(player.hand, null);
    assert.equal(player.offered, null);
    if (!view.isGameOver) assert.equal(player.tickets, null);
  }
}

test('the table view hides every hand, ticket and deck over every step of a short game', () => {
  let state = seatedGame(3, 4);
  const blindDraws: (Card | null)[] = [];
  for (let steps = 0; !state.isGameOver && steps < 3000; steps++) {
    const seat = state.currentPlayer as Seat;
    const before = state;
    const choice = anyMove(toPublicState(state, false, seat) as PublicGameState, seat);
    state = played(state, seat, choice, seeded(steps));
    if (choice.type === 'drawCard' && choice.source === 'deck') {
      blindDraws.push(state.lastMove?.type === 'drawCard' ? state.lastMove.card : 'red');
    }
    const table = toPublicState(state, false, null);
    assertHidden(table, null);
    for (const viewer of [1, 2, 3]) {
      const view = toPublicState(state, false, viewer);
      assertHidden(view, viewer);
      assert.deepEqual(view.players[viewer].hand, state.players[viewer].hand);
      assert.deepEqual(view.players[viewer].tickets, state.players[viewer].tickets);
    }
    assert.equal(total(state), 110, JSON.stringify(before.lastMove));
  }
  assert.equal(state.isGameOver, true);
  assert.ok(blindDraws.every(card => card === null), 'a blind draw was named');
  assert.ok(ROUTES.filter(route => state.claimed[route.id] !== undefined).length > 10);
  assert.ok(Object.values(state.players).some(player => player.trains <= 2));
});

test('finalStandings ranks by points, then tickets completed, then the longest path', () => {
  const score = (total: number, completed: number, longestPath: number): FinalScore => ({
    routes: 0, tickets: Array.from({ length: completed }, (_, ticket) => ({ ticket, completed: true })), ticketPoints: 0, longestPath,
    longestBonus: false, total
  });
  const state: GameState = {
    ...createGameState('t'), activePlayers: [1, 2, 3, 4, 5], isGameOver: true, winners: [1],
    final: { 1: score(80, 3, 9), 2: score(50, 2, 4), 3: score(50, 1, 8), 4: score(50, 1, 8), 5: score(50, 1, 5) }
  };
  assert.deepEqual(finalStandings(state), [
    { seat: 1, place: 1, score: '80 points' }, { seat: 2, place: 2, score: '50 points' },
    { seat: 3, place: 3, score: '50 points' }, { seat: 4, place: 3, score: '50 points' }, { seat: 5, place: 4, score: '50 points' }
  ]);
});
