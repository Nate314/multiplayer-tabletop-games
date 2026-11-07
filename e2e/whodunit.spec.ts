import type { Page } from '@playwright/test';
import { dismiss, expect, headerButton, joinGame, leave, newPlayer, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import { nameOf, type CardId, type ObjectId, type RoomId, type SuspectId } from '../games/whodunit/content.ts';
import type { Position } from '../games/whodunit/board.ts';
import type { GameState } from '../games/whodunit/types.ts';

// One test per rule, control and difference in games/whodunit/README.md. Seat 1 is Alice (Commodore Brine), seat 2 Bob
// (Madame Coral), seat 3 Cara (Doctor Tidewell). Each test patches in a known answer, known hands and known token positions.

const ANSWER = { suspect: 'baroness-pearl', object: 'deck-mallet', room: 'wine-cellar' } as const;
const HANDS: Record<number, CardId[]> = {
  1: ['commodore-brine', 'madame-coral', 'harpoon', 'anchor-chain', 'boathouse', 'grand-foyer'],
  2: ['doctor-tidewell', 'miss-gull', 'boat-oar', 'brass-telescope', 'sun-terrace', 'salt-spa'],
  3: ['professor-kelp', 'marlinspike', 'chart-room', 'signal-room', 'galley', 'card-parlor']
};
const OBJECT_ROOMS: Record<ObjectId, RoomId> = {
  harpoon: 'boathouse', 'anchor-chain': 'grand-foyer', 'boat-oar': 'sun-terrace', 'brass-telescope': 'salt-spa', marlinspike: 'chart-room', 'deck-mallet': 'signal-room'
};
const names = (cards: CardId[]) => cards.map(nameOf);

const button = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });
const status = (page: Page) => page.getByRole('status');
const solution = (page: Page) => page.locator('.wd-solution');
const room = (page: Page, name: string) => page.locator('.wd-room').filter({ has: page.locator('.wd-room-name', { hasText: new RegExp(`^${name}$`) }) });
const cardsIn = (page: Page, label: string) => page.getByRole('region', { name: label, exact: true }).locator('.wd-card-name');
const hand = (page: Page) => cardsIn(page, 'Your cards');
const log = (page: Page) => page.getByRole('region', { name: 'Suggestions', exact: true }).getByRole('listitem');
const note = (page: Page, card: CardId, mark: string) => page.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: `${nameOf(card)}: ${mark}`, exact: true });
const showPrompt = (page: Page) => page.getByRole('region', { name: 'Show a card', exact: true });

// Seats Alice, Bob and Cara and patches in the answer, the hands and the objects' rooms
async function start(seat: Seat, players = ['Alice', 'Bob', 'Cara']): Promise<{ table: Table; alice: Page; bob: Page; cara: Page }> {
  const table = await seat('whodunit', players);
  await table.patch({ solution: ANSWER, hands: HANDS, objectRooms: OBJECT_ROOMS });
  const [alice, bob, cara] = table.pages;
  await expect(hand(alice)).toHaveText(names(HANDS[1]));
  return { table, alice, bob, cara };
}

// A seat is held for a leaver only once play has begun, so a test that leaves or reloads starts with a roll
async function begin(table: Table, alice: Page): Promise<void> {
  await table.dice(1, 1);
  await button(alice, 'Roll').click();
  await expect(alice.locator('.wd-dice')).toBeVisible();
}

// Moves tokens and sets the phase, then waits for the board to show it
async function place(table: Table, tokens: Partial<Record<SuspectId, Position>>, extra: Partial<GameState> = {}): Promise<void> {
  const { positions } = await table.state<GameState>();
  await table.patch({ positions: { ...positions, ...tokens }, ...extra });
}

async function suggest(page: Page, suspect: string, object: string): Promise<void> {
  await button(page, 'Suggest').click();
  const picker = page.getByRole('group', { name: 'Suggestion' });
  await picker.getByLabel('Suspect').selectOption({ label: suspect });
  await picker.getByLabel('Object').selectOption({ label: object });
  await button(page, 'Make suggestion').click();
}

// Opens the accusation pickers, picks (or keeps the first of each) and confirms
async function accuse(page: Page, [suspect, object, where]: [string?, string?, string?] = []): Promise<void> {
  await button(page, 'Accuse').click();
  const picker = page.getByRole('group', { name: 'Accusation' });
  if (suspect) await picker.getByLabel('Suspect').selectOption({ label: suspect });
  if (object) await picker.getByLabel('Object').selectOption({ label: object });
  if (where) await picker.getByLabel('Room').selectOption({ label: where });
  await button(page, 'Make accusation').click();
  await button(page, 'Yes, accuse').click();
}

test.describe('Whodunit rules', () => {
  test('the deal: each page shows only its own hand, and neither the page nor the frames hold the answer', async ({ seat, browser, server }) => {
    test.slow(); // two hand-made joins with recorded frames
    const table = await seat('whodunit', ['Alice']);
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    const frames: string[] = [];
    bob.on('websocket', ws => ws.on('framereceived', frame => frames.push(String(frame.payload))));
    await joinGame(bob, 'whodunit', table.gameId, 'Bob');
    const cara = await newPlayer(browser, server);
    await joinGame(cara, 'whodunit', table.gameId, 'Cara');
    try {
      const state = await table.state<GameState>();
      const all = [1, 2, 3].flatMap(n => state.hands[n]);
      expect(new Set([...all, state.solution!.suspect, state.solution!.object, state.solution!.room]).size).toBe(21);
      for (const [n, page] of [[1, alice], [2, bob], [3, cara]] as const) {
        expect(state.hands[n]).toHaveLength(6);
        await expect(hand(page)).toHaveText(names(state.hands[n]));
        await expect(solution(page)).toHaveCount(0);
        await expect(page.locator('body')).not.toContainText('The answer');
      }
      expect(frames.filter(frame => frame.includes('"hand"')).length).toBeGreaterThan(0);
      expect(frames.filter(frame => /"solution":\s*\{/.test(frame))).toEqual([]);
    } finally {
      await cara.context().close();
      await bob.context().close();
    }
  });

  test('the first seat starts and the objects and tokens begin where the game puts them', async ({ seat }) => {
    const { bob, alice } = await start(seat);
    await expect(alice.locator('.turn-message')).toHaveText('You go first. Joining closes after the first move.');
    await expect(bob.locator('.turn-message')).toHaveText("Alice's turn");
    await expect(button(bob, 'Roll')).toHaveCount(0);
    await expect(room(alice, 'Boathouse').locator('.wd-chip')).toHaveText(['Harpoon']);
    await expect(alice.getByRole('list', { name: 'Players' }).getByRole('listitem')).toHaveText([
      'Alice (Commodore Brine): 6 cards', 'Bob (Madame Coral): 6 cards', 'Cara (Doctor Tidewell): 6 cards'
    ]);
  });

  test('Roll highlights only the squares the roll reaches, and a door within the roll enters the room', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.dice(2, 2);
    await button(alice, 'Roll').click();
    await expect(alice.getByRole('button', { name: 'Move to Grand Foyer' })).toBeVisible();
    const { destinations } = await table.state<GameState>();
    await expect(alice.locator('.wd-target')).toHaveCount(destinations.length);
    await expect(alice.getByRole('button', { name: 'Move to row 1, column 6' })).toBeVisible();
    // An odd distance from the start cannot be reached with a roll of 4
    await expect(alice.getByRole('button', { name: 'Move to row 1, column 9' })).toHaveCount(0);
    await expect(bob.locator('.wd-target')).toHaveCount(0);
    await alice.getByRole('button', { name: 'Move to Grand Foyer' }).click();
    await expect(status(bob)).toHaveText('Alice entered the Grand Foyer');
    await expect(room(bob, 'Grand Foyer').getByRole('img', { name: 'Commodore Brine' })).toBeVisible();
    await expect(button(alice, 'Suggest')).toBeVisible();
    await expect(alice.locator('.wd-target')).toHaveCount(0);
  });

  test('Stay put when the roll has nowhere to go, in a corridor and in a room', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // Alice's three neighbors are held by tokens no seat plays
    await place(table, { 'miss-gull': { row: 0, col: 6 }, 'professor-kelp': { row: 0, col: 8 }, 'baroness-pearl': { row: 1, col: 7 } });
    await table.dice(1, 2);
    await button(alice, 'Roll').click();
    await expect(alice.getByText('Nowhere to go with this roll.')).toBeVisible();
    await button(alice, 'Stay put').click();
    await expect(status(alice)).toHaveText('Alice stays put');
    await expect(button(alice, 'Suggest')).toHaveCount(0);
    await expect(button(alice, 'End turn')).toBeVisible();
  });

  test('Stay put in a room whose doors are blocked still allows a suggestion there', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await place(table, { 'commodore-brine': { room: 'boathouse' }, 'miss-gull': { row: 3, col: 6 }, 'professor-kelp': { row: 6, col: 3 } });
    await table.dice(3, 3);
    await button(alice, 'Roll').click();
    await button(alice, 'Stay put').click();
    await expect(button(alice, 'Suggest')).toBeVisible();
  });

  test('a secret passage takes the player to the room at its other end instead of rolling', async ({ seat }) => {
    const { table, alice, cara } = await start(seat);
    await place(table, { 'commodore-brine': { room: 'boathouse' } });
    await expect(button(alice, 'Secret passage')).toBeVisible();
    await button(alice, 'Secret passage').click();
    await expect(status(cara)).toHaveText('Alice took the secret passage to the Wine Cellar');
    await expect(room(cara, 'Wine Cellar').getByRole('img', { name: 'Commodore Brine' })).toBeVisible();
    await expect(button(alice, 'Suggest')).toBeVisible();
    await expect(button(alice, 'Roll')).toHaveCount(0);
  });

  test('a suggestion moves the token and the object, and the moved player may stay in that room', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await place(table, { 'commodore-brine': { room: 'chart-room' } }, { phase: 'room' });
    await suggest(alice, 'Doctor Tidewell', 'Deck Mallet');
    await expect(room(cara, 'Chart Room').getByRole('img', { name: 'Doctor Tidewell' })).toBeVisible();
    await expect(room(cara, 'Chart Room').locator('.wd-chip')).toContainText(['Deck Mallet']);
    await expect(room(cara, 'Signal Room').locator('.wd-chip')).toHaveCount(0);
    await button(alice, 'End turn').click();
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
    await table.patch({ currentPlayer: 3 });
    await expect(button(cara, 'Stay in Chart Room')).toBeVisible();
    await button(cara, 'Stay in Chart Room').click();
    await expect(status(alice)).toHaveText('Cara stays in the Chart Room');
    await expect(button(cara, 'Suggest')).toBeVisible();
    await expect(button(cara, 'Roll')).toHaveCount(0);
  });

  test('a suggestion asks the first holder clockwise, offers only matching cards, and tells the third page no card', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await place(table, { 'commodore-brine': { room: 'chart-room' } }, { phase: 'room' });
    await suggest(alice, 'Miss Gull', 'Boat Oar');
    await expect(status(alice)).toContainText('Bob is choosing a card to show');
    await expect(showPrompt(bob).getByRole('button')).toHaveCount(2);
    await expect(button(bob, 'Show Miss Gull')).toBeVisible();
    await expect(button(bob, 'Show Boat Oar')).toBeVisible();
    await expect(showPrompt(alice)).toHaveCount(0);
    await expect(showPrompt(cara)).toHaveCount(0);
    await expect(button(alice, 'End turn')).toHaveCount(0);
    await button(bob, 'Show Boat Oar').click();
    await expect(status(cara)).toContainText('Bob showed Alice a card');
    await expect(log(alice)).toHaveText('You suggested Miss Gull with the Boat Oar in the Chart Room. Bob showed a card: Boat Oar');
    await expect(log(bob)).toHaveText('Alice suggested Miss Gull with the Boat Oar in the Chart Room. You showed a card: Boat Oar');
    await expect(log(cara)).toHaveText('Alice suggested Miss Gull with the Boat Oar in the Chart Room. Bob showed a card');
    await expect(button(alice, 'End turn')).toBeVisible();
    await expect(button(alice, 'Suggest')).toHaveCount(0);
    await expect(room(cara, 'Chart Room').getByRole('img', { name: 'Miss Gull' })).toBeVisible();
    await expect(room(cara, 'Chart Room').locator('.wd-chip')).toContainText(['Boat Oar']);
  });

  test('a single matching card is shown at once, and holders without one are named as passing', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await place(table, { 'commodore-brine': { room: 'boathouse' } }, { phase: 'room' });
    await suggest(alice, 'Professor Kelp', 'Deck Mallet');
    await expect(log(alice)).toHaveText('You suggested Professor Kelp with the Deck Mallet in the Boathouse. Bob could not show. Cara showed a card: Professor Kelp');
    await expect(log(bob)).toHaveText('Alice suggested Professor Kelp with the Deck Mallet in the Boathouse. You could not show. Cara showed a card');
    await expect(showPrompt(cara)).toHaveCount(0);
    await expect(status(bob)).toContainText('Cara showed a card');
  });

  test('when nobody can show a card the suggestion says so', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await place(table, { 'commodore-brine': { room: 'wine-cellar' } }, { phase: 'room' });
    await suggest(alice, 'Commodore Brine', 'Deck Mallet');
    await expect(status(bob)).toContainText('nobody could show a card');
    await expect(log(alice)).toHaveText('You suggested Commodore Brine with the Deck Mallet in the Wine Cellar. Bob, Cara could not show. Nobody could show a card');
    await expect(button(alice, 'End turn')).toBeVisible();
  });

  test('a wrong accusation puts the player out of turns but they are still asked to show', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await accuse(alice); // Commodore Brine, Harpoon, Boathouse: all in Alice's own hand
    await expect(status(cara)).toHaveText('Alice accused wrongly and is out of turns');
    await expect(alice.locator('.turn-message')).toHaveText('You are out of turns, but still show cards');
    await expect(alice.getByRole('list', { name: 'Players' }).getByRole('listitem').first()).toContainText('6 cards, out');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
    await expect(solution(bob)).toHaveCount(0);
    await place(table, { 'madame-coral': { room: 'wine-cellar' } }, { phase: 'room' });
    await suggest(bob, 'Commodore Brine', 'Harpoon');
    await expect(showPrompt(alice).getByRole('button')).toHaveCount(2);
    await button(alice, 'Show Harpoon').click();
    await expect(log(bob)).toContainText('Alice showed a card: Harpoon');
    await expect(log(cara)).toContainText('You could not show. Alice showed a card');
    await button(bob, 'End turn').click();
    await expect(cara.locator('.turn-message')).toHaveText('Your turn');
  });

  test('a right accusation wins and shows the answer to everyone', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await accuse(alice, ['Baroness Pearl', 'Deck Mallet', 'Wine Cellar']);
    for (const page of [alice, bob, cara]) {
      await expect(solution(page)).toHaveText('The answer: Baroness Pearl with the Deck Mallet in the Wine Cellar');
      await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();
    }
    await expect(status(bob)).toHaveText('Alice solved it: Baroness Pearl with the Deck Mallet in the Wine Cellar');
  });

  test('when all but one are out the last player able to accuse wins', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await accuse(alice);
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
    await accuse(bob);
    for (const page of [alice, bob, cara]) {
      await expect(status(page)).toHaveText('Cara wins: everyone else is out');
      await expect(solution(page)).toHaveText('The answer: Baroness Pearl with the Deck Mallet in the Wine Cellar');
    }
  });

  test('the notes sheet keeps its marks across a reload', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await begin(table, alice);
    await note(alice, 'boat-oar', 'blank').click();
    await expect(note(alice, 'boat-oar', 'yes')).toBeVisible();
    await note(alice, 'boat-oar', 'yes').click();
    await expect(note(alice, 'boat-oar', 'no')).toBeVisible();
    await alice.reload();
    await expect(note(alice, 'boat-oar', 'no')).toBeVisible();
    await expect(note(bob, 'boat-oar', 'blank')).toBeVisible();
    await expect(alice.getByRole('region', { name: 'Notes' }).getByText('(in your hand)')).toHaveCount(6);
  });
});

test.describe('Whodunit leaving, undo and history', () => {
  test('going back to the game list holds the seat a minute later with nothing revealed', async ({ seat }) => {
    test.setTimeout(150_000);
    const { table, alice, bob, cara } = await start(seat);
    await begin(table, alice);
    const before = await hand(bob).allTextContents();
    await button(bob, 'Back to games').click();
    await bob.waitForTimeout(61_000);
    for (const page of [alice, cara]) await expect(page.getByRole('region', { name: /face up/ })).toHaveCount(0);
    expect(Object.values((await table.state<GameState>()).faceUp).flat()).toEqual([]);
    await button(bob, `Back to Whodunit (${table.gameId})`).click();
    await expect(hand(bob)).toHaveText(before);
    expect(before).toEqual(names(HANDS[2]));
  });

  test('a dismissed player has their cards turned face up on every page', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await begin(table, alice);
    await leave(cara);
    await dismiss('Cara', alice, bob);
    for (const page of [alice, bob]) await expect(cardsIn(page, "Cara's cards, face up")).toHaveText(names(HANDS[3]));
    await expect(hand(alice)).toHaveText(names(HANDS[1]));
    expect((await table.state<GameState>()).faceUp[3]).toEqual(HANDS[3]);
    await expect(note(alice, 'marlinspike', 'blank')).toBeVisible();
    await expect(alice.getByRole('region', { name: 'Notes' }).getByText('(face up)')).toHaveCount(6);
  });

  test('Undo is offered after a roll and gone right after a shown card or an accusation', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await expect(button(alice, 'Undo')).toHaveCount(0);
    await table.dice(1, 2);
    await button(alice, 'Roll').click();
    await expect(button(alice, 'Undo')).toBeVisible();
    await expect(button(bob, 'Undo')).toBeVisible();
    await place(table, { 'commodore-brine': { room: 'boathouse' } }, { phase: 'room' });
    await suggest(alice, 'Professor Kelp', 'Deck Mallet');
    await expect(status(bob)).toContainText('Cara showed a card');
    for (const page of [alice, bob, cara]) await expect(button(page, 'Undo')).toHaveCount(0);
    await button(alice, 'End turn').click();
    await accuse(bob);
    await expect(status(cara)).toHaveText('Bob accused wrongly and is out of turns');
    for (const page of [alice, bob, cara]) await expect(button(page, 'Undo')).toHaveCount(0);
  });

  test('an undone move takes notes made after it with it', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.dice(1, 2);
    await button(alice, 'Roll').click();
    await expect(alice.locator('.wd-dice')).toBeVisible();
    await note(alice, 'boat-oar', 'blank').click();
    await expect(note(alice, 'boat-oar', 'yes')).toBeVisible();
    await undo(alice, bob, cara);
    await expect(button(alice, 'Roll')).toBeVisible();
    await expect(alice.locator('.wd-dice')).toHaveCount(0);
    await expect(note(alice, 'boat-oar', 'blank')).toBeVisible();
  });

  test('History shows neither a hand nor a shown card', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const bodies: string[] = [];
    bob.on('response', response => { if (response.url().includes('/api/')) response.text().then(text => bodies.push(text), () => {}); });
    await place(table, { 'commodore-brine': { room: 'boathouse' } }, { phase: 'room' });
    await suggest(alice, 'Professor Kelp', 'Deck Mallet');
    await expect(log(alice)).toContainText('Cara showed a card: Professor Kelp');
    await (await headerButton(bob, 'History')).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history).toBeVisible();
    await expect(history).toContainText('Cara showed Alice a card');
    await expect(history.getByRole('region', { name: 'Your cards' })).toHaveCount(0);
    await expect(history).not.toContainText('showed a card: ');
    await expect.poll(() => bodies.some(body => body.includes('"seen":[]'))).toBe(true);
    expect(bodies.filter(body => /"seen":\[\{/.test(body))).toEqual([]);
  });

  test('FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('What are secret passages?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
