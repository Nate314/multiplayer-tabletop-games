import type { Page } from '@playwright/test';
import { dismiss, expect, headerButton, joinGame, leave, newPlayer, openFaq, tableScreen, test, undo, watch, type Seat, type Table } from './fixtures.ts';
import type { GameState } from '../games/hintgrid/types.ts';

// One test per rule, control and difference in games/hintgrid/README.md.
// Seats are Alice 1, Bob 2, Cara 3, Dan 4, Eve 5. Once the teams are set the grid and key are patched:
// words 0 to 8 are Red's, 9 to 16 Blue's, 17 to 23 bystanders and 24 (candle) the trap; Red starts.

const WORDS = ['ocean', 'apple', 'river', 'stone', 'cloud', 'tiger', 'piano', 'glass', 'bread', 'chair', 'flame', 'horse', 'lemon', 'mouse', 'paper', 'plant', 'robot',
  'salad', 'shirt', 'table', 'train', 'water', 'wheel', 'zebra', 'candle'];
const KEY = [...Array(9).fill('red'), ...Array(8).fill('blue'), ...Array(7).fill('bystander'), 'trap'];
const BLUE = WORDS.slice(9, 17);
const BYSTANDER = WORDS[17];
const TRAP = WORDS[24];

// Alice and Bob are Red's clue-giver and guesser, Cara and Dan Blue's; Eve, when there, is a second Red guesser
const PICKS = ['Be Red\'s clue-giver', 'Guess for Red', 'Be Blue\'s clue-giver', 'Guess for Blue', 'Guess for Red'];

const button = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });
const card = (page: Page, word: string) => page.locator('.hint-card').filter({ has: page.locator('.hint-word', { hasText: new RegExp(`^${word}$`) }) });
const turn = (page: Page) => page.locator('.turn-message');
const clueText = (page: Page) => page.locator('.clue-text');
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
// Both teams are set and the first clue is due
const ready = (page: Page) => page.locator('.team-status');
const role = (page: Page) => page.locator('.player-info');
const stateOf = (table: Table) => table.state<GameState>();

async function pickAll(pages: Page[]) {
  for (const [i, page] of pages.entries()) await button(page, PICKS[i]).click();
}

// Seats `names`, everyone picks as in PICKS, then the known grid is patched in
async function start(seat: Seat, names: string[]) {
  const table = await seat('hintgrid', names);
  await pickAll(table.pages);
  await expect(ready(table.pages[0])).toContainText('gives the first clue');
  await table.patch({ words: WORDS, key: KEY, startingTeam: 'red', turn: 'red', currentPlayer: 1 });
  await expect(card(table.pages[0], 'ocean')).toHaveAccessibleName('ocean, red');
  return table;
}

const FOUR = ['Alice', 'Bob', 'Cara', 'Dan'];
const FIVE = [...FOUR, 'Eve'];

async function clue(page: Page, word: string, count: number) {
  await page.getByLabel('Clue', { exact: true }).fill(word);
  await page.getByLabel('Number').selectOption(String(count));
  await button(page, 'Give clue').click();
}

// Alice gives a clue and everyone sees it
async function redClue(table: Table, count = 2) {
  await clue(table.pages[0], 'sea', count);
  for (const page of table.pages) await expect(clueText(page)).toContainText(`Red's clue: sea ${count}`);
}

test.describe('Hint Grid rules', () => {
  test('picking roles shows them on every page and the game waits until ready', async ({ seat }) => {
    const table = await seat('hintgrid', FOUR);
    const [alice, bob, cara, dan] = table.pages;
    await button(alice, 'Be Red\'s clue-giver').click();
    await button(bob, 'Guess for Red').click();
    await button(cara, 'Be Blue\'s clue-giver').click();
    for (const page of table.pages) {
      const red = page.getByRole('region', { name: 'Teams' }).locator('.team-red');
      await expect(red).toContainText('Alice');
      await expect(red).toContainText('Bob');
      await expect(red.locator('.role-tag')).toHaveText('clue-giver');
      await expect(page.locator('.team-blue')).toContainText('Cara');
      await expect(page.locator('.team-status')).toContainText('Pick teams');
    }
    await expect(role(alice)).toContainText('Red clue-giver');
    await expect(role(dan)).toContainText('no team yet');
    await button(dan, 'Guess for Blue').click();
    for (const page of table.pages) await expect(ready(page)).toContainText('gives the first clue');
    await expect(role(dan)).toContainText('Blue guesser');
  });

  test('a clue-giver who steps down gets a new grid', async ({ seat }) => {
    const table = await seat('hintgrid', FOUR);
    const alice = table.pages[0];
    await button(alice, "Be Red's clue-giver").click();
    await expect(role(alice)).toContainText('Red clue-giver');
    const before = await alice.locator('.hint-word').allTextContents();
    await button(alice, 'Guess for Red').click();
    await expect(role(alice)).toContainText('Red guesser');
    await expect.poll(async () => (await alice.locator('.hint-word').allTextContents()).join()).not.toBe(before.join());
  });

  test('Even out balances four unplaced players', async ({ seat }) => {
    const table = await seat('hintgrid', FOUR);
    await button(table.pages[1], 'Even out').click();
    for (const page of table.pages) await expect(ready(page)).toContainText('gives the first clue');
    const [alice, bob, cara, dan] = table.pages;
    await expect(role(alice)).toContainText('Red clue-giver');
    await expect(role(bob)).toContainText('Blue clue-giver');
    await expect(role(cara)).toContainText('Red guesser');
    await expect(role(dan)).toContainText('Blue guesser');
  });

  test('Even out keeps the clue-giver already chosen', async ({ seat }) => {
    const table = await seat('hintgrid', FOUR);
    await button(table.pages[3], 'Be Blue\'s clue-giver').click();
    await button(table.pages[0], 'Even out').click();
    await expect(role(table.pages[3])).toContainText('Blue clue-giver');
    await expect(role(table.pages[0])).toContainText('Red clue-giver');
  });

  test('a fifth joiner is unplaced and blocks the start', async ({ seat }) => {
    const table = await seat('hintgrid', FIVE);
    await pickAll(table.pages.slice(0, 4));
    const [alice, , , , eve] = table.pages;
    await expect(alice.locator('.team-status')).toContainText('Pick teams');
    await expect(role(eve)).toContainText('no team yet');
    await button(eve, 'Guess for Blue').click();
    await expect(ready(alice)).toContainText('gives the first clue');
  });

  test('the clue-givers\' cards name their kinds and the guessers\' do not', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const [alice, bob, cara, dan] = table.pages;
    for (const page of [alice, cara]) {
      await expect(card(page, 'ocean')).toHaveAccessibleName('ocean, red');
      await expect(card(page, 'flame')).toHaveAccessibleName('flame, blue');
      await expect(card(page, BYSTANDER)).toHaveAccessibleName(`${BYSTANDER}, bystander`);
      await expect(card(page, TRAP)).toHaveAccessibleName(`${TRAP}, trap`);
    }
    for (const page of [bob, dan]) {
      await expect(page.locator('.hint-card')).toHaveCount(25);
      await expect(card(page, 'ocean')).toHaveAccessibleName('ocean');
      await expect(page.locator('.hint-mark')).toHaveCount(0);
    }
  });

  test('a grid-word clue is refused and a good one shows to everyone', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const alice = table.pages[0];
    await clue(alice, 'Ocean', 2);
    await expect(alice.getByRole('alert')).toHaveText('Your clue is a word on the grid');
    await clue(alice, 'ice cream', 2);
    await expect(alice.getByRole('alert')).toHaveText('Give one word');
    await expect(clueText(table.pages[1])).toHaveCount(0);
    await redClue(table);
    await expect(clueText(table.pages[3])).toContainText('3 guesses left');
  });

  test('the number runs from 1 to 9', async ({ seat }) => {
    const table = await start(seat, FOUR);
    await expect(table.pages[0].getByLabel('Number').locator('option')).toHaveText(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  test('cards cannot be tapped before a clue, by the clue-giver or by the other team', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const [alice, bob, , dan] = table.pages;
    await expect(card(bob, 'ocean')).toHaveAttribute('aria-disabled', 'true');
    await redClue(table);
    await expect(card(bob, 'ocean')).not.toHaveAttribute('aria-disabled');
    await expect(card(alice, 'ocean')).toHaveAttribute('aria-disabled', 'true');
    await expect(card(dan, 'ocean')).toHaveAttribute('aria-disabled', 'true');
    await expect(button(bob, 'End guessing')).toBeDisabled();
    await expect(button(dan, 'End guessing')).toHaveCount(0);
  });

  test('a team word lets the team guess on and the number plus one ends the turn', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const [alice, bob, cara] = table.pages;
    await redClue(table, 1);
    await card(bob, 'ocean').click();
    for (const page of table.pages) await expect(card(page, 'ocean')).toHaveAccessibleName('ocean, red, turned over');
    await expect(turn(bob)).toHaveText('Red\'s turn');
    await expect(clueText(bob)).toContainText('1 guess left');
    await expect(alice.locator('.words-left')).toHaveText('Words left: Red 8, Blue 8');
    await card(bob, 'apple').click();
    await expect(turn(bob)).toHaveText('Blue\'s turn');
    await expect(clueText(bob)).toHaveCount(0);
    await expect(cara.getByLabel('Clue', { exact: true })).toBeVisible();
  });

  test('any guesser of the team may tap', async ({ seat }) => {
    const table = await start(seat, FIVE);
    await redClue(table, 3);
    await card(table.pages[4], 'river').click();
    await expect(card(table.pages[1], 'river')).toHaveAccessibleName('river, red, turned over');
    await card(table.pages[1], 'stone').click();
    await expect(card(table.pages[4], 'stone')).toHaveAccessibleName('stone, red, turned over');
  });

  test('a bystander ends the turn', async ({ seat }) => {
    const table = await start(seat, FOUR);
    await redClue(table, 3);
    await card(table.pages[1], BYSTANDER).click();
    await expect(turn(table.pages[1])).toHaveText('Blue\'s turn');
    await expect(card(table.pages[3], BYSTANDER)).toHaveAccessibleName(`${BYSTANDER}, bystander, turned over`);
  });

  test('the other team\'s word ends the turn', async ({ seat }) => {
    const table = await start(seat, FOUR);
    await redClue(table, 3);
    await card(table.pages[1], BLUE[0]).click();
    await expect(turn(table.pages[1])).toHaveText('Blue\'s turn');
    await expect(table.pages[0].locator('.words-left')).toHaveText('Words left: Red 9, Blue 7');
  });

  test('End guessing needs a guess, then hands the turn to the other team', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const bob = table.pages[1];
    await redClue(table, 3);
    await expect(button(bob, 'End guessing')).toBeDisabled();
    await card(bob, 'ocean').click();
    await expect(button(bob, 'End guessing')).toBeEnabled();
    await button(bob, 'End guessing').click();
    await expect(turn(bob)).toHaveText('Blue\'s turn');
  });

  test('the trap ends the game for the other team', async ({ seat }) => {
    const table = await start(seat, FOUR);
    await redClue(table, 3);
    await card(table.pages[1], TRAP).click();
    for (const page of table.pages) await expect(gameOver(page)).toContainText('Cara and Dan win');
    await expect(turn(table.pages[0])).toHaveText('Red turned over the trap. Blue wins!');
    expect((await stateOf(table)).winners).toEqual([3, 4]);
  });

  test('finding all words wins and the standings name the team', async ({ seat }) => {
    const table = await start(seat, FOUR);
    await table.patch({ revealed: KEY.map((_, i) => i > 0 && i < 9) });
    await redClue(table, 1);
    await card(table.pages[1], 'ocean').click();
    for (const page of table.pages) await expect(gameOver(page)).toContainText('Alice and Bob win');
    await expect(turn(table.pages[0])).toHaveText('Red found all its words!');
    await expect(gameOver(table.pages[3])).toContainText('Red team');
    expect((await stateOf(table)).winners).toEqual([1, 2]);
  });

  test('Undo of a guess, approved, turns the card face down', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const [alice, bob, cara, dan] = table.pages;
    await redClue(table, 2);
    await card(bob, 'ocean').click();
    await expect(card(bob, 'ocean')).toHaveAccessibleName('ocean, red, turned over');
    await undo(bob, alice, cara, dan);
    await expect(card(bob, 'ocean')).toHaveAccessibleName('ocean');
    await expect(card(alice, 'ocean')).toHaveAccessibleName('ocean, red');
    await expect(card(dan, 'ocean')).toHaveAccessibleName('ocean');
    expect((await stateOf(table)).revealed[0]).toBe(false);
  });

  test('a spectator sees the key and a table screen does not', async ({ seat, browser, server }) => {
    const table = await start(seat, FOUR);
    await redClue(table, 2);
    await card(table.pages[1], 'ocean').click();
    const spectator = await watch(browser, server, 'hintgrid', table.gameId, 'Zed');
    const screen = await tableScreen(table);
    await expect(card(spectator, 'apple')).toHaveAccessibleName('apple, red');
    await expect(card(spectator, TRAP)).toHaveAccessibleName(`${TRAP}, trap`);
    await expect(card(screen, 'ocean')).toHaveAccessibleName('ocean, red, turned over');
    await expect(card(screen, 'apple')).toHaveAccessibleName('apple');
    await expect(screen.locator('.hint-mark')).toHaveCount(1);
  });

  test('History mid-game shows no face-down kinds', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const bob = table.pages[1];
    await redClue(table, 2);
    await card(bob, 'ocean').click();
    await (await headerButton(bob, 'History')).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-layout')).toBeVisible();
    await expect(history.locator('.hint-card')).toHaveCount(25);
    await expect(history.locator('.hint-card.down')).toHaveCount(24);
    const labels = await history.locator('.hint-card.down').evaluateAll(cards => cards.map(c => c.getAttribute('aria-label') ?? ''));
    for (const label of labels) expect(label).not.toMatch(/, (red|blue|bystander|trap)/);
  });

  test('the frames a guesser receives never contain the key', async ({ seat, browser, server }) => {
    test.slow(); // a hand-made join with recorded frames
    const table = await seat('hintgrid', ['Alice', 'Bob', 'Cara']);
    const dan = await newPlayer(browser, server);
    const frames: string[] = [];
    dan.on('websocket', ws => ws.on('framereceived', frame => frames.push(String(frame.payload))));
    try {
      await joinGame(dan, 'hintgrid', table.gameId, 'Dan');
      await pickAll([...table.pages, dan]);
      await expect(ready(dan)).toContainText('gives the first clue');
      await table.patch({ words: WORDS, key: KEY, startingTeam: 'red', turn: 'red', currentPlayer: 1 });
      await redClue(table, 2);
      await card(table.pages[1], 'ocean').click();
      await expect(card(table.pages[0], 'ocean')).toHaveAccessibleName('ocean, red, turned over');
      await (await headerButton(dan, 'History')).click();
      await expect(dan.getByRole('dialog', { name: 'History' }).locator('.history-layout')).toBeVisible();
      const keyed = frames.filter(frame => /"key":\[/.test(frame));
      expect(keyed.length).toBeGreaterThan(0);
      for (const frame of keyed) {
        expect(frame).not.toMatch(/"key":\[[^\]]*"(bystander|trap)"/);
        // at most the one turned-over card names its kind
        expect((/"key":\[[^\]]*\]/.exec(frame)?.[0].match(/"(red|blue)"/g) ?? []).length).toBeLessThanOrEqual(1);
      }
    } finally {
      await dan.context().close();
    }
  });

  test('dismissing a clue-giver ends the game', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const [alice, bob, cara, dan] = table.pages;
    await redClue(table); // the first clue starts the game
    await leave(alice);
    await dismiss('Alice', bob, cara, dan);
    for (const page of [bob, cara, dan]) await expect(gameOver(page)).toContainText('Cara and Dan win');
    await expect(turn(bob)).toHaveText('Not enough players left: Blue wins');
    expect((await stateOf(table)).isGameOver).toBe(true);
  });

  test('the FAQ opens', async ({ seat }) => {
    const table = await seat('hintgrid', FOUR);
    const faq = await openFaq(table.pages[0]);
    await expect(faq).toContainText('How do I set up the teams?');
    await expect(faq).toContainText('What is the trap?');
  });

  test('the grid fits at phone size', async ({ seat }) => {
    const table = await seat('hintgrid', FOUR, { touch: true });
    await pickAll(table.pages);
    const page = table.pages[1];
    await expect(ready(page)).toContainText('gives the first clue');
    await table.patch({ words: WORDS, key: KEY, startingTeam: 'red', turn: 'red', currentPlayer: 1 });
    await expect(card(page, 'ocean')).toBeVisible();
    const width = page.viewportSize()!.width;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const word of ['ocean', 'candle']) {
      const box = (await card(page, word).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  });

  test('a team wins when the other team turns over its last word', async ({ seat }) => {
    const table = await start(seat, FOUR);
    await table.patch({ revealed: KEY.map((_, i) => i > 9 && i < 17) });
    await redClue(table, 2);
    await card(table.pages[1], BLUE[0]).click();
    for (const page of table.pages) await expect(gameOver(page)).toContainText('Cara and Dan win');
    await expect(turn(table.pages[0])).toHaveText('Blue found all its words!');
  });

  test('dismissing a clue-giver with equal words left is a draw', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const [alice, bob, cara, dan] = table.pages;
    await redClue(table);
    await table.patch({ revealed: KEY.map((_, i) => i === 0) });
    await leave(alice);
    await dismiss('Alice', bob, cara, dan);
    for (const page of [bob, cara, dan]) await expect(gameOver(page)).toBeVisible();
    await expect(turn(bob)).toHaveText('Not enough players left: a draw');
    expect((await stateOf(table)).winners).toEqual([]);
  });

  test('face-up cards show a mark for each kind', async ({ seat }) => {
    const table = await start(seat, FOUR);
    await table.patch({ revealed: KEY.map((_, i) => [0, 9, 17, 24].includes(i)) });
    const bob = table.pages[1];
    await expect(card(bob, 'ocean').locator('.hint-mark')).toContainText('R');
    await expect(card(bob, 'chair').locator('.hint-mark')).toContainText('B');
    await expect(card(bob, BYSTANDER).locator('.hint-mark')).toContainText('○');
    await expect(card(bob, TRAP).locator('.hint-mark')).toContainText('✖');
    await expect(bob.locator('.hint-mark')).toHaveCount(4);
  });

  test('the last word turned over is outlined', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const [alice, bob] = table.pages;
    await redClue(table, 3);
    await card(bob, 'ocean').click();
    await expect(card(alice, 'ocean')).toHaveClass(/\blast\b/);
    await card(bob, 'apple').click();
    await expect(card(alice, 'apple')).toHaveClass(/\blast\b/);
    await expect(card(alice, 'ocean')).not.toHaveClass(/\blast\b/);
  });

  test('picking a team or role is not a move and cannot be undone', async ({ seat }) => {
    const table = await seat('hintgrid', FOUR);
    await pickAll(table.pages);
    for (const page of table.pages) {
      await expect(ready(page)).toContainText('gives the first clue');
      await expect(button(page, 'Undo')).toBeDisabled();
    }
  });

  test('the Rules button opens the rules', async ({ seat }) => {
    const table = await seat('hintgrid', FOUR);
    await (await headerButton(table.pages[0], 'Rules')).click();
    await expect(table.pages[0].getByRole('dialog', { name: / rules$/ })).toContainText('clue-giver');
  });

  test('Even out names a clue-giver for a team that has none', async ({ seat }) => {
    const table = await seat('hintgrid', FIVE);
    await button(table.pages[0], 'Be Red\'s clue-giver').click();
    await button(table.pages[1], 'Even out').click();
    for (const page of table.pages) await expect(ready(page)).toContainText('gives the first clue');
    const roles = Object.values((await stateOf(table)).roles);
    expect(roles.filter(r => r?.team === 'red' && r.clueGiver)).toHaveLength(1);
    expect(roles.filter(r => r?.team === 'blue' && r.clueGiver)).toHaveLength(1);
    expect(roles).toHaveLength(5);
  });

  test('History shows no face-down kinds to a clue-giver either', async ({ seat }) => {
    const table = await start(seat, FOUR);
    const alice = table.pages[0];
    await redClue(table, 2);
    await card(table.pages[1], 'ocean').click();
    await (await headerButton(alice, 'History')).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-layout')).toBeVisible();
    await expect(history.locator('.hint-card.down')).toHaveCount(24);
    const labels = await history.locator('.hint-card.down').evaluateAll(cards => cards.map(c => c.getAttribute('aria-label') ?? ''));
    for (const label of labels) expect(label).not.toMatch(/, (red|blue|bystander|trap)/);
  });
});
