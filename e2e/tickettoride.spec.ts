import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Seat, type Table } from './fixtures.ts';
import { CITIES, ROUTES, TICKETS } from '../games/tickettoride/map.ts';
import type { Card, GameState, Hand, PlayerState } from '../games/tickettoride/types.ts';

// One test per rule and control in games/tickettoride/README.md. Most tests seat the players through the join dialog,
// then patch in a game already in play with known cards, so every draw and claim has a known outcome.

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve'];

function handOf(cards: Partial<Hand> = {}): Hand {
  return { pink: 0, white: 0, blue: 0, yellow: 0, orange: 0, black: 0, red: 0, green: 0, locomotive: 0, ...cards };
}

// The id of the track between two cities; index 1 is the second track of a double route
function routeId(a: string, b: string, index = 0): number {
  const found = ROUTES.filter(route => [a, b].every(name => [route.a, route.b].some(id => CITIES[id].name === name)));
  if (!found[index]) throw new Error(`No route ${a} to ${b}`);
  return found[index].id;
}

const ticketName = (id: number) => `${CITIES[TICKETS[id].a].name} to ${CITIES[TICKETS[id].b].name}`;

type Players = Record<number, Partial<Omit<PlayerState, 'hand'>> & { hand?: Partial<Hand> }>;

// The full players record for `count` seats, each with empty hands and no tickets unless given
function playersOf(count: number, players: Players = {}): Record<number, PlayerState> {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const seat = index + 1;
    const { hand, ...rest } = players[seat] ?? {};
    return [seat, { tickets: [], offered: null, trains: 45, ...rest, hand: handOf(hand) }];
  }));
}

// Seats `count` players, then patches in a game in play: Alice to move, a deck of plain red cards and five other colors up
async function start(seat: Seat, count = 2, overrides: Partial<GameState> = {}, players: Players = {}) {
  const table = await seat('tickettoride', NAMES.slice(0, count));
  await table.patch(playState(count, overrides, players));
  await expect(table.pages[0].locator('.turn-message')).toHaveText(overrides.lastTurns ? 'Last round: Your turn' : 'Your turn');
  return { table, pages: table.pages, alice: table.pages[0], bob: table.pages[1], cara: table.pages[2] };
}

// The start of a game in play where someone other than Alice may be to move
async function startOn(seat: Seat, count: number, overrides: Partial<GameState>, players: Players = {}) {
  const table = await seat('tickettoride', NAMES.slice(0, count));
  await table.patch(playState(count, overrides, players));
  const mover = table.pages[(overrides.currentPlayer ?? 1) - 1];
  await expect(turn(mover)).toHaveText(overrides.lastTurns ? 'Last round: Your turn' : 'Your turn');
  return { table, alice: table.pages[0], bob: table.pages[1], cara: table.pages[2] };
}

function playState(count: number, overrides: Partial<GameState> = {}, players: Players = {}): Partial<GameState> {
  return {
    started: true,
    phase: 'play',
    playerCount: count,
    currentPlayer: 1,
    deck: Array<Card>(20).fill('red'),
    discards: [],
    faceUp: ['blue', 'green', 'yellow', 'black', 'white'],
    ticketDeck: Array.from({ length: 21 }, (_, index) => index + 9),
    claimed: {},
    drawing: null,
    lastTurns: null,
    passes: 0,
    final: null,
    lastMove: null,
    gameStatus: '',
    ...overrides,
    players: playersOf(count, players)
  };
}

const market = (page: Page) => page.getByRole('region', { name: 'Train cards to draw' });
const faceUp = (page: Page, slot: number) => market(page).locator('.face-up > *').nth(slot);
const deck = (page: Page) => market(page).getByRole('button', { name: /^Deck/ });
const deckCount = (page: Page) => deck(page).locator('.deck-count');
const ticketDeck = (page: Page) => market(page).getByRole('button', { name: /^Tickets/ });
const myHand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const held = (page: Page, card: Card) => myHand(page).locator(`.card-${card} .card-count`);
const row = (page: Page, name: string) => page.getByRole('region', { name: 'Players' }).locator('.player-row', { hasText: name });
const stat = (page: Page, name: string, title: string) => row(page, name).getByTitle(title);
const track = (page: Page, id: number) => page.locator(`[data-anim-key="route-${id}"]`);
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const panel = (page: Page) => page.locator('.turn-panel');
const checkboxes = (page: Page) => page.locator('.ticket-choice').getByRole('checkbox');
const keepButton = (page: Page) => page.getByRole('button', { name: /^Keep \d+ tickets?$/ });
const claimButtons = (page: Page) => panel(page).getByRole('button', { name: /^Claim with/ });
const finalScores = (page: Page) => page.getByRole('region', { name: 'Final scores' });
const finalCells = (page: Page, name: string) => finalScores(page).locator('tbody tr', { hasText: name }).locator('td');

// Clicks a middle space of the track, which is always on the track itself
async function pickRoute(page: Page, id: number): Promise<void> {
  await track(page, id).locator('rect').nth(Math.floor(ROUTES[id].length / 2)).click();
}

async function claim(page: Page, id: number, payment: string): Promise<void> {
  await pickRoute(page, id);
  await panel(page).getByRole('button', { name: `Claim with ${payment}`, exact: true }).click();
}

// Takes two cards from the deck, which ends the turn
async function drawTwo(page: Page): Promise<void> {
  await deck(page).click();
  await expect(panel(page)).toContainText('Take your second card');
  await deck(page).click();
}

// Puts Alice on the final turn of the last round and plays it, which ends and scores the game
async function finish(table: Table, alice: Page, overrides: Partial<GameState>, players: Players): Promise<void> {
  await table.patch(playState(table.pages.length, { lastTurns: [1], ...overrides }, players));
  await expect(turn(alice)).toHaveText('Last round: Your turn');
  await drawTwo(alice);
  await expect(turn(alice)).toHaveText('Game over');
}

// Each player, in seat order, keeps every first ticket they were dealt
async function keepFirstTickets(pages: Page[]): Promise<void> {
  for (const page of pages) {
    await expect(keepButton(page)).toBeEnabled();
    await keepButton(page).click();
  }
}

const LA_VEGAS = routeId('Los Angeles', 'Las Vegas'); // 2 gray
const KC_STL = routeId('Kansas City', 'Saint Louis');  // 2 blue, its twin 2 pink
const KC_STL_PINK = routeId('Kansas City', 'Saint Louis', 1);
const SEATTLE_PORTLAND = routeId('Seattle', 'Portland'); // 1 gray, double
const CALGARY_HELENA = routeId('Calgary', 'Helena');     // 4 gray
const DENVER_SANTA_FE = routeId('Santa Fe', 'Denver');   // 2 gray
const EL_PASO_SANTA_FE = routeId('El Paso', 'Santa Fe'); // 2 gray
const DENVER_EL_PASO_TICKET = 6; // 4 points
const BOSTON_MIAMI_TICKET = 0;   // 12 points

test.describe('Ticket to Ride rules', () => {
  test('the USA map has 36 cities and 100 tracks over 78 pairs, 110 train cards, 30 tickets and 45 trains each', async ({ seat }) => {
    const table = await seat('tickettoride', ['Alice', 'Bob']);
    const [alice] = table.pages;
    await expect(alice.locator('.map .city')).toHaveCount(36);
    await expect(alice.locator('.map g.track')).toHaveCount(100);
    const titles = await alice.locator('.map g.track > title').allTextContents();
    const tracks = titles.map(title => /^(.+): (\d) (\w+)$/.exec(title) ?? []);
    const pairs = tracks.map(([, pair]) => pair);
    expect(new Set(pairs).size).toBe(78);
    expect([...new Set(pairs)].filter(pair => pairs.filter(other => other === pair).length === 2)).toHaveLength(22);
    expect([...new Set(tracks.map(([, , length]) => Number(length)))].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...new Set(tracks.map(([, , , color]) => color))].sort())
      .toEqual(['black', 'blue', 'gray', 'green', 'orange', 'pink', 'red', 'white', 'yellow']);

    // Every train card is in the deck, its discards, the face-up row or a hand
    const [, left, discarded] = /^(\d+) left(?:, (\d+) discarded)?$/.exec(await deckCount(alice).innerText()) ?? [];
    await expect(market(alice).locator('.card-button')).toHaveCount(5);
    for (const name of ['Alice', 'Bob']) {
      await expect(stat(alice, name, 'Train cards')).toHaveText('4 cards');
      await expect(stat(alice, name, 'Destination tickets')).toHaveText('3 tickets');
      await expect(stat(alice, name, 'Trains left')).toHaveText('45 trains');
    }
    expect(Number(left) + Number(discarded ?? 0) + 5 + 8).toBe(110);
    await expect(ticketDeck(alice).locator('.deck-count')).toHaveText('24 left'); // 30 less the 6 dealt

    // The card colors are hidden in the decks, so they are counted from the server
    const state = await table.state<GameState>();
    const cards = [...state.deck, ...state.discards, ...state.faceUp, ...Object.values(state.players).flatMap(player =>
      (Object.entries(player.hand) as [Card, number][]).flatMap(([card, count]) => Array<Card>(count).fill(card)))];
    const counts = Object.fromEntries(['pink', 'white', 'blue', 'yellow', 'orange', 'black', 'red', 'green', 'locomotive']
      .map(card => [card, cards.filter(other => other === card).length]));
    expect(counts).toEqual({ pink: 12, white: 12, blue: 12, yellow: 12, orange: 12, black: 12, red: 12, green: 12, locomotive: 14 });
  });

  test('setup deals 4 cards and 3 tickets, turns 5 up, each keeps 2 or 3 in seat order, then play goes up the seats', async ({ seat }) => {
    const table = await seat('tickettoride', ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = table.pages;
    await expect(market(alice).locator('.card-button')).toHaveCount(5);
    await expect(alice.locator('.hand .card-count')).not.toHaveCount(0);
    const inHand = (await alice.locator('.hand .card-count').allTextContents()).reduce((sum, count) => sum + Number(count), 0);
    expect(inHand).toBe(4);
    await expect(turn(alice)).toHaveText('Your turn to choose your first tickets. Joining closes after the first move.');
    await expect(turn(bob)).toHaveText('Alice is choosing their first tickets. Joining closes after the first move.');
    await expect(checkboxes(alice)).toHaveCount(3);

    // At least 2 must be kept; the one returned goes under the ticket deck
    const offered = (await table.state<GameState>()).players[1].offered as number[];
    await checkboxes(alice).nth(2).uncheck();
    await expect(keepButton(alice)).toHaveText('Keep 2 tickets');
    await checkboxes(alice).nth(1).uncheck();
    await expect(keepButton(alice)).toHaveText('Keep 1 ticket');
    await expect(keepButton(alice)).toBeDisabled();
    await checkboxes(alice).nth(1).check();
    await keepButton(alice).click();
    await expect(stat(bob, 'Alice', 'Destination tickets')).toHaveText('2 tickets');
    await expect(ticketDeck(bob).locator('.deck-count')).toHaveText('22 left');
    expect((await table.state<GameState>()).ticketDeck.at(-1)).toBe(offered[2]);

    await expect(turn(bob)).toHaveText('Your turn to choose your first tickets');
    await keepFirstTickets([bob, cara]);
    await expect(turn(alice)).toHaveText('Your turn');
    for (const [page, next] of [[alice, bob], [bob, cara], [cara, alice]]) {
      await drawTwo(page);
      await expect(turn(next)).toHaveText('Your turn');
    }
  });

  test('drawing train cards: two per turn from the face-up row or the deck, a taken face-up card replaced at once', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await faceUp(alice, 0).click(); // the blue card
    await expect(held(alice, 'blue')).toHaveText('1');
    await expect(faceUp(alice, 0)).toHaveText('Red'); // turned up from the deck of red cards
    await expect(deckCount(alice)).toHaveText('19 left');
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(ticketDeck(alice)).toBeDisabled();
    await deck(alice).click();
    await expect(held(alice, 'red')).toHaveText('1');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(stat(bob, 'Alice', 'Train cards')).toHaveText('2 cards');
  });

  test('a face-up locomotive is the whole draw and cannot be the second card; one from the deck counts as one card', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, 2, { faceUp: ['locomotive', 'green', 'yellow', 'black', 'white'] });
    await faceUp(alice, 0).click();
    await expect(held(alice, 'locomotive')).toHaveText('1');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(turn(alice)).toHaveText("Bob's turn");

    await table.patch(playState(2, { faceUp: ['locomotive', 'green', 'yellow', 'black', 'white'] }));
    await expect(turn(alice)).toHaveText('Your turn');
    await faceUp(alice, 1).click(); // green first
    await expect(faceUp(alice, 0)).toBeDisabled();
    await expect(faceUp(alice, 0)).toHaveAttribute('title', 'A face-up locomotive cannot be your second card');

    await table.patch(playState(2, { deck: ['red', 'red', 'locomotive'] }));
    await expect(myHand(alice).locator('.card-green')).toHaveCount(0);
    await deck(alice).click(); // the top of the deck is the locomotive
    await expect(held(alice, 'locomotive')).toHaveText('1');
    await expect(panel(alice)).toContainText('Take your second card');
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('claiming a route pays its length in its color, with locomotives for any color, and places that many trains', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, { claimed: { [SEATTLE_PORTLAND]: 1 } }, { 1: { hand: { blue: 1, locomotive: 1, red: 3 } } });
    // A blue route far from Alice's other route: red cards are not offered for it
    await pickRoute(alice, KC_STL);
    await expect(claimButtons(alice)).toHaveText(['Claim with 1 blue and 1 locomotive']);
    await claimButtons(alice).click();
    await expect(track(bob, KC_STL)).toHaveClass(/owned seat1/);
    await expect(stat(bob, 'Alice', 'Trains left')).toHaveText('43 trains');
    await expect(stat(bob, 'Alice', 'Train cards')).toHaveText('3 cards');
    await expect(held(alice, 'red')).toHaveText('3');
    await expect(myHand(alice).locator('.card-blue')).toHaveCount(0);
    await expect(status(bob)).toHaveText('Alice claimed Kansas City to Saint Louis (2, blue) with 1 blue and 1 locomotive');

    // A gray route takes any one color
    const gray = await start(seat, 2, {}, { 1: { hand: { yellow: 2 } } });
    await claim(gray.alice, LA_VEGAS, '2 yellow');
    await expect(track(gray.alice, LA_VEGAS)).toHaveClass(/owned seat1/);
  });

  test('a route needs enough trains left', async ({ seat }) => {
    const { alice } = await start(seat, 2, {}, { 1: { hand: { red: 4 }, trains: 3 } });
    await pickRoute(alice, CALGARY_HELENA);
    await expect(panel(alice)).toContainText('You have only 3 trains left');
    await expect(claimButtons(alice)).toHaveCount(0);
  });

  test('drawing destination tickets offers 3, at least 1 is kept and the rest go under the deck; fewer when fewer are left', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await ticketDeck(alice).click();
    await expect(checkboxes(alice)).toHaveCount(3);
    await expect(panel(alice)).toContainText('Destination tickets drawn. Keep at least 1');
    for (const box of await checkboxes(alice).all()) await box.uncheck();
    await expect(keepButton(alice)).toHaveText('Keep 0 tickets');
    await expect(keepButton(alice)).toBeDisabled();
    await checkboxes(alice).first().check();
    await keepButton(alice).click();
    await expect(myHand(alice).locator('.ticket-cities')).toHaveText([ticketName(9)]);
    await expect(ticketDeck(bob).locator('.deck-count')).toHaveText('20 left');
    expect((await table.state<GameState>()).ticketDeck.slice(-2)).toEqual([10, 11]);
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(turn(alice)).toHaveText("Bob's turn");

    await table.patch(playState(2, { ticketDeck: [5] }));
    await expect(turn(alice)).toHaveText('Your turn');
    await ticketDeck(alice).click();
    await expect(checkboxes(alice)).toHaveCount(1);
    await expect(keepButton(alice)).toHaveText('Keep 1 ticket');
  });

  test('three face-up locomotives send all five to the discards and five more are turned up', async ({ seat }) => {
    const deckCards: Card[] = [...Array<Card>(10).fill('orange'), 'locomotive'];
    const { alice, bob } = await start(seat, 2, { deck: deckCards, faceUp: ['red', 'locomotive', 'locomotive', 'green', 'blue'] });
    await faceUp(alice, 0).click(); // the locomotive on top of the deck replaces it
    await expect(market(bob).locator('.card-name')).toHaveText(['Orange', 'Orange', 'Orange', 'Orange', 'Orange', 'Deck']);
    await expect(deckCount(bob)).toHaveText('5 left, 5 discarded');
    await expect(status(bob)).toContainText('three locomotives were face up, so all five were replaced');
  });

  test('the discards are shuffled into a new deck when it runs out; with neither, only the face-up row is left', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, 2, { deck: [], discards: ['pink', 'pink'] });
    await expect(deckCount(alice)).toHaveText('0 left, 2 discarded');
    await deck(alice).click();
    await expect(held(alice, 'pink')).toHaveText('1');
    await expect(deckCount(alice)).toHaveText('1 left');
    await deck(alice).click();
    await expect(held(alice, 'pink')).toHaveText('2');

    // Neither a deck nor discards: Bob can take only face-up cards, and a taken one is not replaced
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(deck(bob)).toBeDisabled();
    await faceUp(bob, 0).click();
    await expect(faceUp(bob, 0)).toHaveText('Empty');

    await table.patch(playState(2, { deck: [], faceUp: [null, null, null, null, null] }));
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(market(alice).locator('.card-button')).toHaveCount(0);
    await expect(market(alice).locator('.card.empty')).toHaveCount(5);
    await expect(deck(alice)).toBeDisabled();
  });

  test('with 4 or 5 players two players may each claim one track of a double route, but nobody claims both', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, 4, { claimed: { [KC_STL]: 2 } }, { 1: { hand: { pink: 2, blue: 2 } } });
    await claim(alice, KC_STL_PINK, '2 pink');
    await expect(track(bob, KC_STL_PINK)).toHaveClass(/owned seat1/);
    await expect(track(bob, KC_STL)).toHaveClass(/owned seat2/);
    await expect(turn(alice)).toHaveText("Bob's turn");

    await table.patch(playState(4, { claimed: { [KC_STL]: 1 } }, { 1: { hand: { pink: 2, blue: 2 } } }));
    await expect(turn(alice)).toHaveText('Your turn');
    await pickRoute(alice, KC_STL_PINK);
    await expect(panel(alice)).toContainText('You cannot claim both tracks of a double route');
    await expect(claimButtons(alice)).toHaveCount(0);
  });

  test('with 2 or 3 players, once one track of a double route is claimed the other is closed', async ({ seat }) => {
    const { alice } = await start(seat, 2, { claimed: { [KC_STL]: 2 } }, { 1: { hand: { pink: 2 } } });
    await expect(track(alice, KC_STL_PINK)).toHaveClass(/closed/);
    await expect(track(alice, KC_STL_PINK).locator('title')).toHaveText('Kansas City to Saint Louis: 2 pink, closed (the other track is taken)');
    await expect(alice.getByRole('button', { name: /^Kansas City to Saint Louis/ })).toHaveCount(0);
  });

  test('a claimed route scores by its length: 1, 2, 4, 7, 10 or 15 points', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const routes: [number, string, string][] = [
      [routeId('Omaha', 'Kansas City'), '1 red', '1 pts'],
      [LA_VEGAS, '2 red', '2 pts'],
      [routeId('Phoenix', 'Santa Fe'), '3 red', '4 pts'],
      [CALGARY_HELENA, '4 red', '7 pts'],
      [routeId('Phoenix', 'Denver'), '5 white', '10 pts'],
      [routeId('Winnipeg', 'Sault St. Marie'), '6 red', '15 pts']
    ];
    for (const [id, payment, points] of routes) {
      await table.patch(playState(2, {}, { 1: { hand: { red: 6, white: 5 } } }));
      await expect(stat(alice, 'Alice', 'Points')).toHaveText('0 pts');
      await claim(alice, id, payment);
      await expect(stat(bob, 'Alice', 'Points')).toHaveText(points);
      await expect(stat(alice, 'Alice', 'Points')).toHaveText(points);
    }
  });

  test('ending a turn with 2 trains or fewer gives everyone one more turn, then tickets and the longest path are scored', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, {
      claimed: { [DENVER_SANTA_FE]: 1, [EL_PASO_SANTA_FE]: 1, [CALGARY_HELENA]: 2 }
    }, {
      1: { hand: { red: 2 }, trains: 4, tickets: [DENVER_EL_PASO_TICKET] },
      2: { tickets: [BOSTON_MIAMI_TICKET] }
    });
    await claim(alice, LA_VEGAS, '2 red');
    await expect(status(bob)).toContainText('Alice has 2 trains left: everyone, Alice included, gets one last turn.');
    await expect(turn(bob)).toHaveText('Last round: Your turn');
    await drawTwo(bob);
    await expect(turn(alice)).toHaveText('Last round: Your turn');
    await drawTwo(alice);
    await expect(turn(alice)).toHaveText('Game over');

    // Alice: routes 2 + 2 + 2, her ticket made (+4), a path of 4 tied with Bob's, so both get the bonus
    await expect(finalCells(bob, 'Alice')).toHaveText(['Alice', '6', '+4', '4 (+10)', '20']);
    // Bob: one route of 4 (7), his ticket missed (-12), the tied path bonus
    await expect(finalCells(bob, 'Bob')).toHaveText(['Bob', '7', '-12', '4 (+10)', '5']);
  });

  test('most points wins; a tie goes to the most tickets completed, then the longest path, and a full tie is shared', async ({ seat }) => {
    // Both on 18 points; Alice completed a ticket and Bob none
    const tickets = await start(seat);
    await finish(tickets.table, tickets.alice, {
      claimed: { [DENVER_SANTA_FE]: 1, [EL_PASO_SANTA_FE]: 1, [CALGARY_HELENA]: 2, [routeId('Vancouver', 'Seattle')]: 2 }
    }, { 1: { tickets: [DENVER_EL_PASO_TICKET] } });
    await expect(finalCells(tickets.bob, 'Alice').last()).toHaveText('18');
    await expect(finalCells(tickets.bob, 'Bob').last()).toHaveText('18');
    await expect(status(tickets.bob)).toHaveText('Alice wins with 18 points!');

    // Both on 20 points and no tickets; Bob's path of 5 beats Alice's four separate routes
    const path = await start(seat);
    await finish(path.table, path.alice, {
      claimed: {
        [CALGARY_HELENA]: 1, [routeId('Winnipeg', 'Duluth')]: 1, [routeId('Montreal', 'New York')]: 1, [routeId('Houston', 'New Orleans')]: 1,
        [routeId('Phoenix', 'Denver')]: 2
      }
    }, {});
    await expect(finalCells(path.alice, 'Alice').last()).toHaveText('20');
    await expect(finalCells(path.alice, 'Bob').last()).toHaveText('20');
    await expect(status(path.alice)).toHaveText('Bob wins with 20 points!');

    // The same points, tickets and path: the win is shared
    const shared = await start(seat);
    await finish(shared.table, shared.alice, { claimed: { [CALGARY_HELENA]: 1, [routeId('Winnipeg', 'Duluth')]: 2 } }, {});
    await expect(status(shared.bob)).toHaveText('Alice and Bob share the win with 17 points!');
    await expect(finalScores(shared.bob).locator('tr.winner')).toHaveCount(2);
  });

  test('only you see your train cards and tickets; others see counts, and all tickets show in the final scoring', async ({ seat }) => {
    const players: Players = {
      1: { hand: { blue: 2 }, tickets: [BOSTON_MIAMI_TICKET] },
      2: { hand: { black: 3 }, tickets: [14] }
    };
    const { table, alice, bob } = await start(seat, 2, {}, players);
    await expect(myHand(alice).locator('.ticket-cities')).toHaveText([ticketName(BOSTON_MIAMI_TICKET)]);
    await expect(alice.locator('.hand-panel')).toHaveCount(1);
    await expect(myHand(alice).locator('.card-black')).toHaveCount(0);
    await expect(alice.getByText(ticketName(14))).toHaveCount(0);
    await expect(stat(alice, 'Bob', 'Train cards')).toHaveText('3 cards');
    await expect(stat(alice, 'Bob', 'Destination tickets')).toHaveText('1 ticket');
    await expect(myHand(bob).locator('.card-blue')).toHaveCount(0);
    await expect(bob.getByText(ticketName(BOSTON_MIAMI_TICKET))).toHaveCount(0);

    // A card from the deck is never named
    await deck(alice).click();
    await expect(status(bob)).toHaveText('Alice drew a card from the deck. They draw a second card.');
    await deck(alice).click();

    // The tickets Bob is choosing from show only to him
    await ticketDeck(bob).click();
    await expect(checkboxes(bob)).toHaveCount(3);
    await expect(checkboxes(alice)).toHaveCount(0);
    await expect(stat(alice, 'Bob', 'Destination tickets')).toHaveText('4 tickets');
    for (const ticket of [9, 10, 11]) await expect(alice.getByText(ticketName(ticket))).toHaveCount(0);

    await finish(table, alice, {}, players);
    await expect(finalScores(alice).getByText(ticketName(14))).toBeVisible();
    await expect(finalScores(bob).getByText(ticketName(BOSTON_MIAMI_TICKET))).toBeVisible();
  });

  test('leaving: a dismissed player\'s routes stay and block, their cards are discarded, and a half-drawn turn is dropped', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 3, { claimed: { [SEATTLE_PORTLAND]: 2 } }, {
      2: { hand: { red: 3 }, tickets: [14] }
    });
    await drawTwo(alice);
    await deck(bob).click(); // Bob takes one card and leaves before his second
    await expect(panel(bob)).toContainText('Take your second card');
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(row(alice, 'Bob')).toContainText('(left)');
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(panel(cara)).toContainText('Take 2 train cards, click a route on the map to claim it, or draw destination tickets.');
    await expect(ticketDeck(cara)).toBeEnabled();
    await expect(deckCount(cara)).toHaveText('17 left, 4 discarded'); // his 3 red and the one he drew
    await expect(stat(cara, 'Bob', 'Train cards')).toHaveText('0 cards');
    await expect(stat(cara, 'Bob', 'Destination tickets')).toHaveText('0 tickets');
    await expect(track(cara, SEATTLE_PORTLAND).locator('title')).toHaveText('Seattle to Portland: 1 gray, claimed by Bob');
    await expect(track(cara, routeId('Seattle', 'Portland', 1))).toHaveClass(/closed/);
    expect((await table.state<GameState>()).players[2].tickets).toEqual([]);
  });

  test('leaving: tickets a dismissed player was choosing from go back under the deck', async ({ seat }) => {
    const { table, alice, bob, cara } = await startOn(seat, 3, { currentPlayer: 2, ticketDeck: [9, 10, 11] }, {
      2: { offered: [20, 21, 22] }
    });
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(ticketDeck(cara).locator('.deck-count')).toHaveText('6 left');
    expect((await table.state<GameState>()).ticketDeck).toEqual([9, 10, 11, 20, 21, 22]);
  });

  test('leaving: if the dismissed player had the last turn of the final round, the game ends without them', async ({ seat }) => {
    const { table, alice, cara } = await startOn(seat, 3, { currentPlayer: 2, lastTurns: [2] });
    await leave(table.pages[1]);
    await dismiss('Bob', alice, cara);
    await expect(turn(alice)).toHaveText('Game over');
    await expect(finalScores(alice).locator('tbody tr')).toHaveCount(2);
    await expect(finalCells(alice, 'Bob')).toHaveCount(0);
  });

  test('leaving: the last player left wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('any player can ask to undo, it needs every player\'s approval, and each card and ticket step is its own move', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, 3);
    await deck(alice).click();
    await expect(held(alice, 'red')).toHaveText('1');
    await bob.getByRole('button', { name: 'Undo' }).click(); // not Bob's turn, and he may still ask
    await alice.getByRole('button', { name: 'Approve' }).click();
    await cara.getByRole('button', { name: 'Decline' }).click();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(held(alice, 'red')).toHaveText('1');

    await undo(alice, bob, cara);
    await expect(myHand(alice)).toContainText('No train cards');
    await expect(panel(alice)).toContainText('Take 2 train cards');

    await ticketDeck(alice).click();
    await expect(checkboxes(alice)).toHaveCount(3);
    await undo(alice, bob, cara);
    await expect(checkboxes(alice)).toHaveCount(0);
    await expect(ticketDeck(alice).locator('.deck-count')).toHaveText('21 left');

    await ticketDeck(alice).click();
    await keepButton(alice).click();
    await expect(turn(bob)).toHaveText('Your turn');
    await undo(bob, alice, cara);
    await expect(checkboxes(alice)).toHaveCount(3);
    await expect(keepButton(alice)).toBeEnabled();
  });
});

test.describe('Ticket to Ride controls', () => {
  test('with Color-blind symbols on, train cards and open colored routes show a shape; locomotives and gray routes show none', async ({ seat }) => {
    const { alice } = await start(seat, 2, { faceUp: ['locomotive', 'green', 'yellow', 'black', 'white'] }, { 1: { hand: { red: 1, blue: 1, pink: 1, orange: 1, locomotive: 1 } } });
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    const shapes = { red: 'circle', blue: 'square', pink: 'heart', orange: 'hexagon', green: 'triangle', yellow: 'star', black: 'diamond', white: 'ring' };
    for (const card of ['red', 'blue', 'pink', 'orange']) await expect(myHand(alice).locator(`.card-${card} .color-symbol-${shapes[card as keyof typeof shapes]}`)).toHaveCount(1);
    await expect(myHand(alice).locator('.card-locomotive .color-symbol')).toHaveCount(0);
    await expect(faceUp(alice, 0).locator('.color-symbol')).toHaveCount(0);
    for (const [slot, card] of ['green', 'yellow', 'black', 'white'].entries()) await expect(faceUp(alice, slot + 1).locator(`.color-symbol-${shapes[card as keyof typeof shapes]}`)).toHaveCount(1);
    await expect(track(alice, KC_STL).locator('.color-symbol-square')).toHaveCount(1);
    await expect(track(alice, KC_STL_PINK).locator('.color-symbol-heart')).toHaveCount(1);
    await expect(track(alice, LA_VEGAS).locator('.color-symbol')).toHaveCount(0);
  });

  test('with Color-blind symbols on, a claimed route shows the shape of its owner, not of the route color, and the player list shows each seat shape', async ({ seat }) => {
    const { alice } = await start(seat, 3, { claimed: { [KC_STL]: 2, [LA_VEGAS]: 1, [SEATTLE_PORTLAND]: 3 } });
    await setPreference(alice, 'Color-blind symbols', true);
    await expect(track(alice, KC_STL).locator('.color-symbol-square')).toHaveCount(1);
    await expect(track(alice, KC_STL).locator('.color-symbol')).toHaveCount(1);
    await expect(track(alice, LA_VEGAS).locator('.color-symbol-circle')).toHaveCount(1);
    await expect(track(alice, SEATTLE_PORTLAND).locator('.color-symbol-triangle')).toHaveCount(1);
    const shapes = ['circle', 'square', 'triangle'];
    for (const [index, name] of ['Alice', 'Bob', 'Cara'].entries()) {
      await expect(alice.locator('.player-row', { hasText: name }).locator(`.color-symbol-${shapes[index]}`)).toHaveCount(1);
    }
  });

  test('clicking a face-up card or the deck takes a card, twice a turn, and cards you cannot take are dimmed', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, { faceUp: ['locomotive', 'green', 'yellow', 'black', 'white'] });
    for (const button of await market(bob).locator('.card-button').all()) await expect(button).toBeDisabled();
    await expect(deck(bob)).toBeDisabled();
    const opacity = await faceUp(bob, 1).evaluate(element => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBeLessThan(1);
    await expect(faceUp(alice, 1)).toBeEnabled();
    expect(await faceUp(alice, 1).evaluate(element => getComputedStyle(element).opacity)).toBe('1');

    await faceUp(alice, 1).click();
    await expect(faceUp(alice, 0)).toBeDisabled(); // the locomotive, as a second card
    await expect(faceUp(alice, 2)).toBeEnabled();
    await deck(alice).click();
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(market(alice).locator('.card-button:enabled')).toHaveCount(0);
  });

  test('a picked route offers one button per way to pay, Cancel puts it back, and a route you cannot claim says why', async ({ seat }) => {
    const { alice } = await start(seat, 2, { claimed: { [SEATTLE_PORTLAND]: 2 } }, { 1: { hand: { red: 1, blue: 2, locomotive: 2 } } });
    await pickRoute(alice, LA_VEGAS);
    await expect(track(alice, LA_VEGAS)).toHaveClass(/selected/);
    await expect(panel(alice)).toContainText('Los Angeles to Las Vegas: 2 gray (any one color)');
    await expect(panel(alice)).toContainText('Choose how to pay:');
    await expect(claimButtons(alice)).toHaveText(['Claim with 2 blue', 'Claim with 1 red and 1 locomotive', 'Claim with 2 locomotives']);
    await panel(alice).getByRole('button', { name: 'Cancel' }).click();
    await expect(track(alice, LA_VEGAS)).not.toHaveClass(/selected/);
    await expect(panel(alice)).toContainText('Take 2 train cards');

    await pickRoute(alice, routeId('Winnipeg', 'Sault St. Marie'));
    await expect(panel(alice)).toContainText('You do not have the cards for that route');
    await expect(claimButtons(alice)).toHaveCount(0);
    // Claimed and closed tracks cannot be picked, and their labels say why
    await expect(track(alice, SEATTLE_PORTLAND).locator('title')).toHaveText('Seattle to Portland: 1 gray, claimed by Bob');
    await expect(track(alice, routeId('Seattle', 'Portland', 1)).locator('title')).toContainText('closed (the other track is taken)');
    await expect(track(alice, SEATTLE_PORTLAND)).not.toHaveAttribute('role', 'button');
  });

  test('clicking the ticket deck draws tickets, ticked ones are kept with Keep, and first tickets show before your turn', async ({ seat }) => {
    const table = await seat('tickettoride', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await expect(checkboxes(bob)).toHaveCount(3);
    await expect(keepButton(bob)).toBeDisabled();
    await expect(panel(bob)).toContainText('You can choose when your turn comes.');
    await keepButton(alice).click();
    await expect(keepButton(bob)).toBeEnabled();
    await checkboxes(bob).first().uncheck();
    await expect(keepButton(bob)).toHaveText('Keep 2 tickets');
    await keepButton(bob).click();
    await expect(stat(alice, 'Bob', 'Destination tickets')).toHaveText('2 tickets');

    await expect(turn(alice)).toHaveText('Your turn');
    await ticketDeck(alice).click();
    await expect(checkboxes(alice)).toHaveCount(3);
    await checkboxes(alice).nth(1).uncheck();
    await checkboxes(alice).nth(2).uncheck();
    await keepButton(alice).click();
    await expect(stat(bob, 'Alice', 'Destination tickets')).toHaveText('4 tickets');
  });

  test('both cards of a draw are outlined until your next turn\'s move', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, {}, { 1: { hand: { yellow: 2 } } });
    await faceUp(alice, 0).click(); // the blue card
    await expect(myHand(alice).locator('.newly-drawn')).toHaveCount(1);
    await deck(alice).click(); // a red card
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(myHand(alice).locator('.newly-drawn')).toHaveCount(2);
    await expect(myHand(alice).locator('.card-blue.newly-drawn')).toHaveCount(1);
    await expect(myHand(alice).locator('.card-red.newly-drawn')).toHaveCount(1);
    await expect(myHand(alice).locator('.card-yellow.newly-drawn')).toHaveCount(0);
    await drawTwo(bob);
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(myHand(alice).locator('.newly-drawn')).toHaveCount(2);
    await claim(alice, LA_VEGAS, '2 yellow');
    await expect(track(alice, LA_VEGAS)).toHaveClass(/owned seat1/);
    await expect(myHand(alice).locator('.newly-drawn')).toHaveCount(0);
  });

  test('your hand groups train cards by color with counts, checks completed tickets, and a pointed ticket rings its cities', async ({ seat }) => {
    const { alice } = await start(seat, 2, { claimed: { [DENVER_SANTA_FE]: 1, [EL_PASO_SANTA_FE]: 1 } }, {
      1: { hand: { red: 3, blue: 2, locomotive: 1 }, tickets: [DENVER_EL_PASO_TICKET, BOSTON_MIAMI_TICKET] }
    });
    await expect(myHand(alice).locator('.card .card-name')).toHaveText(['Blue', 'Red', 'Loco']);
    await expect(myHand(alice).locator('.card .card-count')).toHaveText(['2', '3', '1']);
    await expect(myHand(alice)).toContainText('Destination tickets (1 of 2 completed)');
    const tickets = myHand(alice).locator('.tickets li');
    await expect(tickets.nth(0).getByLabel('completed')).toBeVisible();
    await expect(tickets.nth(1).getByLabel('completed')).toHaveCount(0);

    await tickets.nth(0).hover();
    await expect(alice.locator('.city.ringed text')).toHaveText(['Denver', 'El Paso']);
    await alice.mouse.move(0, 0);
    await expect(alice.locator('.city.ringed')).toHaveCount(0);
  });

  test('the player list shows points, trains, cards and tickets, outlines whose turn it is and marks the last round', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, { claimed: { [CALGARY_HELENA]: 2 }, lastTurns: [1, 2] }, {
      1: { hand: { red: 2 }, tickets: [0, 3] },
      2: { trains: 2, tickets: [6] }
    });
    await expect(row(alice, 'Bob').locator('.player-stats')).toHaveText('7 pts2 trains0 cards1 ticket');
    await expect(row(alice, 'Alice').locator('.player-stats')).toHaveText('0 pts45 trains2 cards2 tickets');
    await expect(row(bob, 'Alice')).toHaveClass(/current/);
    await expect(row(bob, 'Bob')).not.toHaveClass(/current/);
    const border = await row(bob, 'Alice').evaluate(element => getComputedStyle(element).borderTopColor);
    expect(border).not.toBe('rgba(0, 0, 0, 0)');
    await expect(row(bob, 'Alice').locator('.last-turn')).toBeVisible();
    await expect(row(bob, 'Bob').locator('.last-turn')).toBeVisible();

    await drawTwo(alice);
    await expect(row(bob, 'Bob')).toHaveClass(/current/);
    await expect(row(bob, 'Alice').locator('.last-turn')).toHaveCount(0);
    await expect(row(bob, 'Bob').locator('.last-turn')).toBeVisible();
  });

  test('claimed routes show in the owner\'s color with white dots, closed tracks are faded and the last claim is outlined', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, {}, { 1: { hand: { blue: 2 } } });
    await claim(alice, KC_STL, '2 blue');
    const claimed = track(bob, KC_STL);
    await expect(claimed).toHaveClass(/owned seat1/);
    await expect(claimed).toHaveClass(/highlight/);
    await expect(claimed.locator('circle')).toHaveCount(2);
    expect(await claimed.locator('circle').first().evaluate(element => getComputedStyle(element).fill)).toBe('rgb(255, 255, 255)');
    const [fill, open] = await Promise.all([
      claimed.locator('rect').first().evaluate(element => getComputedStyle(element).fill),
      track(bob, LA_VEGAS).locator('rect').first().evaluate(element => getComputedStyle(element).fill)
    ]);
    expect(fill).not.toBe(open);
    const twin = track(bob, KC_STL_PINK);
    await expect(twin).toHaveClass(/closed/);
    expect(await twin.evaluate(element => getComputedStyle(element).opacity)).toBe('0.3');
  });

  test('when the game ends, the final scores below the map show routes, tickets made and missed, and the longest path', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await finish(table, alice, { claimed: { [DENVER_SANTA_FE]: 1, [EL_PASO_SANTA_FE]: 1 } }, {
      1: { tickets: [DENVER_EL_PASO_TICKET, BOSTON_MIAMI_TICKET] }
    });
    const scores = finalScores(alice);
    await expect(alice.locator('.map-area .final-scores')).toBeVisible();
    await expect(scores.locator('thead th')).toHaveText(['Player', 'Routes', 'Tickets', 'Longest path', 'Total']);
    await expect(finalCells(alice, 'Alice')).toHaveText(['Alice', '4', '-8', '4 (+10)', '6']);
    const tickets = scores.locator('.final-tickets', { hasText: 'Alice' }).locator('li');
    await expect(tickets.nth(0).getByLabel('completed', { exact: true })).toBeVisible();
    await expect(tickets.nth(1).getByLabel('not completed')).toBeVisible();
    await expect(tickets.nth(1)).toHaveClass('missed');
  });

  test('on a narrow window the map keeps a usable size and scrolls sideways', async ({ seat }) => {
    const { alice } = await start(seat);
    await alice.setViewportSize({ width: 420, height: 800 });
    const frame = alice.locator('.map-frame');
    await expect.poll(async () => (await alice.locator('svg.map').boundingBox())?.width).toBeGreaterThanOrEqual(640);
    const scrolled = await frame.evaluate(element => {
      element.scrollLeft = 200;
      return { scrollLeft: element.scrollLeft, fits: element.clientWidth <= 420 };
    });
    expect(scrolled.scrollLeft).toBeGreaterThan(0);
    expect(scrolled.fits).toBe(true);
  });

  test('clicking Undo asks everyone else to approve undoing the last move', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat, 3);
    await deck(alice).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(cara.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(bob.locator('.undo-vote-title')).toHaveText('Alice wants to undo the last turn');
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('double routes');
    await expect(faq).toContainText('Click the route on the map, then click a way to pay');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Ticket to Ride differences from Wikipedia', () => {
  test('first tickets are chosen one player after another, each choice can be undone, and an offer shows before your turn', async ({ seat }) => {
    const table = await seat('tickettoride', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await expect(checkboxes(bob)).toHaveCount(3);
    await expect(keepButton(bob)).toBeDisabled();
    await keepButton(alice).click();
    await expect(turn(bob)).toHaveText('Your turn to choose your first tickets');
    await undo(bob, alice);
    await expect(turn(alice)).toHaveText('Your turn to choose your first tickets');
    await expect(checkboxes(alice)).toHaveCount(3);
    await expect(keepButton(bob)).toBeDisabled();
  });

  test('the first seat goes first', async ({ seat }) => {
    const table = await seat('tickettoride', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await keepFirstTickets([alice, bob]);
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(turn(bob)).toHaveText("Alice's turn");
  });

  test('both tracks of a double route stay open after a dismissal leaves 3 of the 4 players who began', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat, 4, { claimed: { [KC_STL]: 2 } }, { 1: { hand: { pink: 2 } } });
    await leave(table.pages[3]);
    await dismiss('Dan', alice, bob, cara);
    await expect(row(alice, 'Dan')).toContainText('(left)');
    await expect(track(alice, KC_STL_PINK)).not.toHaveClass(/closed/);
    await claim(alice, KC_STL_PINK, '2 pink');
    await expect(track(bob, KC_STL_PINK)).toHaveClass(/owned seat1/);
  });

  test('three face-up locomotives are replaced at most 10 times in a row', async ({ seat }) => {
    // More locomotives than a real deck holds, so every new row is all locomotives
    const deckCards: Card[] = ['red', 'red', 'red', ...Array<Card>(60).fill('locomotive')];
    const { alice } = await start(seat, 2, { deck: deckCards, faceUp: ['red', 'locomotive', 'locomotive', 'green', 'blue'] });
    await faceUp(alice, 0).click();
    await expect(deckCount(alice)).toHaveText('12 left, 50 discarded');
    await expect(market(alice).locator('.face-up .card-name')).toHaveText(['Loco', 'Loco', 'Loco', 'Loco', 'Loco']);
  });

  test('three face-up locomotives stay when fewer than 3 other cards are left outside the hands', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, { deck: ['locomotive'], faceUp: ['red', 'locomotive', 'locomotive', 'green', 'blue'] });
    await faceUp(alice, 0).click();
    await expect(market(bob).locator('.face-up .card-name')).toHaveText(['Loco', 'Loco', 'Loco', 'Green', 'Blue']);
    await expect(status(bob)).not.toContainText('replaced');
    await expect(deckCount(bob)).toHaveText('0 left');
  });

  test('the turn ends after the first card when no card is left that could be a second', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, { deck: [], faceUp: ['red', 'locomotive', null, null, null] });
    await faceUp(alice, 0).click();
    await expect(held(alice, 'red')).toHaveText('1');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('a player who can do nothing passes, and when every player passes in a row the game ends and is scored', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2, { deck: [], faceUp: [null, null, null, null, null], ticketDeck: [] });
    await expect(panel(alice)).toContainText('There is nothing you can draw or claim.');
    await panel(alice).getByRole('button', { name: 'Pass' }).click();
    await expect(status(bob)).toHaveText('Alice could do nothing and passed');
    await panel(bob).getByRole('button', { name: 'Pass' }).click();
    await expect(turn(alice)).toHaveText('Game over');
    await expect(finalScores(alice)).toBeVisible();
  });

  test('the payment picker offers each color with as few locomotives as possible, and locomotives alone', async ({ seat }) => {
    const { alice } = await start(seat, 2, {}, { 1: { hand: { red: 2, locomotive: 2 } } });
    await pickRoute(alice, LA_VEGAS);
    await expect(claimButtons(alice)).toHaveText(['Claim with 2 red', 'Claim with 2 locomotives']);
    await panel(alice).getByRole('button', { name: 'Cancel' }).click();
    await pickRoute(alice, routeId('Phoenix', 'Santa Fe')); // 3 gray: 2 red and 1 locomotive is the fewest
    await expect(claimButtons(alice)).toHaveText(['Claim with 2 red and 1 locomotive']);
  });
});
