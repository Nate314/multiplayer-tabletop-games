import type { Locator, Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Table } from './fixtures.ts';
import { LADDERS, SNAKES } from '../games/snakesladders/board.ts';

// One test per rule, control and difference in games/snakesladders/README.md. Seat 1 is Alice (red), seat 2 Bob
// (blue) and seat 3 Cara (green). Every roll is made on the server, so each test queues the die faces it needs.

const token = (page: Page | Locator, seat: number) => page.locator(`[data-anim-key="token-${seat}"]`);
const square = (page: Page, number: number) => page.locator(`[data-square="${number}"]`);
const rollButton = (page: Page) => page.getByRole('button', { name: 'Roll', exact: true });
const status = (page: Page) => page.locator('.sl-status');
const turn = (page: Page) => page.locator('.sl-turn');
const playerRow = (page: Page, name: string) => page.locator('.sl-player-row', { hasText: name });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });

async function expectAt(page: Page, seat: number, name: string, at: number): Promise<void> {
  await expect(token(page, seat)).toHaveAttribute('aria-label', `${name}, square ${at}`);
}

// `page` presses Roll and waits until the status shows `expected`
async function press(page: Page, expected: string): Promise<void> {
  await rollButton(page).click();
  await expect(status(page)).toHaveText(expected);
}

// Queues one die face and presses Roll with it
async function rollOnce(table: Table, page: Page, face: number, expected: string): Promise<void> {
  await table.dice(face);
  await press(page, expected);
}

// Puts the tokens on these squares with Alice to roll, and waits until every open page shows them
async function place(table: Table, positions: Record<number, number>, names: string[]): Promise<void> {
  await table.patch({ positions, currentPlayer: 1, lastMove: null });
  for (const page of table.pages) {
    if (page.isClosed()) continue;
    for (const [seat, at] of Object.entries(positions)) await expectAt(page, Number(seat), names[Number(seat) - 1], at);
  }
}

test.describe('Snakes and Ladders rules', () => {
  test('the 100 squares run back and forth, 1 at the bottom left and 100 at the top left', async ({ seat }) => {
    const { pages: [alice] } = await seat('snakesladders', ['Alice', 'Bob']);
    await expect(alice.getByRole('group', { name: 'Board' }).locator('[data-square]')).toHaveCount(100);
    const box = async (number: number) => (await square(alice, number).boundingBox())!;
    const [one, ten, eleven, twenty, hundred, ninetyOne] = [await box(1), await box(10), await box(11), await box(20), await box(100), await box(91)];
    expect(ten.x).toBeGreaterThan(one.x);
    expect(ten.y).toBe(one.y);
    expect(eleven.x).toBe(ten.x); // 11 sits above 10, and the row runs back to the left
    expect(eleven.y).toBeLessThan(ten.y);
    expect(twenty.x).toBe(one.x);
    expect(hundred.x).toBe(one.x);
    expect(hundred.y).toBeLessThan(eleven.y);
    expect(ninetyOne.x).toBe(ten.x);
  });

  test('every token starts on square 1, seat 1 rolls first, and turns go in join order', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = table.pages;
    for (const page of table.pages) {
      for (const [index, name] of ['Alice', 'Bob', 'Cara'].entries()) await expectAt(page, index + 1, name, 1);
    }
    await expect(turn(alice)).toContainText('Your turn');
    await expect(turn(bob)).toContainText("Alice's turn");
    await rollOnce(table, alice, 1, 'Alice rolled 1 and moved from 1 to 2');
    await expect(turn(bob)).toContainText('Your turn');
    await rollOnce(table, bob, 3, 'Bob rolled 3 and moved from 1 to 4');
    await expect(turn(cara)).toContainText('Your turn');
    await rollOnce(table, cara, 4, 'Cara rolled 4 and moved from 1 to 5');
    await expect(turn(alice)).toContainText('Your turn');
  });

  test('a roll moves the token that many squares', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await rollOnce(table, alice, 4, 'Alice rolled 4 and moved from 1 to 5');
    await expectAt(bob, 1, 'Alice', 5);
    await expect(playerRow(bob, 'Alice')).toContainText('Square 5');
  });

  test('landing on a ladder foot climbs it', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await rollOnce(table, alice, 2, 'Alice rolled 2 and climbed a ladder from 3 to 22');
    await expectAt(bob, 1, 'Alice', 22);
  });

  test('landing on a snake head slides down', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await place(table, { 1: 24, 2: 1 }, ['Alice', 'Bob']);
    await rollOnce(table, alice, 3, 'Alice rolled 3 and slid down a snake from 27 to 5');
    await expectAt(bob, 1, 'Alice', 5);
  });

  test('tokens share a square', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await rollOnce(table, alice, 4, 'Alice rolled 4 and moved from 1 to 5');
    await rollOnce(table, bob, 4, 'Bob rolled 4 and moved from 1 to 5');
    await expectAt(alice, 1, 'Alice', 5);
    await expectAt(alice, 2, 'Bob', 5);
    // Drawn side by side, both inside the square
    const cell = (await square(alice, 5).boundingBox())!;
    const boxes = [(await token(alice, 1).boundingBox())!, (await token(alice, 2).boundingBox())!];
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(cell.x);
      expect(box.y).toBeGreaterThanOrEqual(cell.y);
      expect(box.x + box.width).toBeLessThanOrEqual(cell.x + cell.width);
      expect(box.y + box.height).toBeLessThanOrEqual(cell.y + cell.height);
    }
    // Side by side in one row; only the discs' edge strokes may touch
    const [a, b] = boxes;
    expect(b.y).toBeCloseTo(a.y, 1);
    expect(b.x - a.x).toBeGreaterThan(a.width * 0.85);
  });

  test('a 6 gives another roll', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await rollOnce(table, alice, 6, 'Alice rolled 6 and moved from 1 to 7, and rolls again');
    await expect(turn(alice)).toContainText('Your turn');
    await expect(rollButton(alice)).toBeEnabled();
    await expect(rollButton(bob)).toBeDisabled();
    await rollOnce(table, alice, 2, 'Alice rolled 2 and moved from 7 to 9');
    await expect(turn(bob)).toContainText('Your turn');
  });

  test('a roll past 100 stops on 100 and wins', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await place(table, { 1: 97, 2: 1 }, ['Alice', 'Bob']);
    await rollOnce(table, alice, 5, 'Alice wins!');
    await expectAt(bob, 1, 'Alice', 100);
    await expect(gameOver(bob)).toBeVisible();
  });

  test('with Exact finish a roll past 100 does not move', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob'], { houseRules: { exactFinish: true } });
    const [alice, bob] = table.pages;
    await place(table, { 1: 97, 2: 1 }, ['Alice', 'Bob']);
    await rollOnce(table, alice, 5, 'Alice rolled 5 and needs exactly 3 to reach 100');
    await expectAt(bob, 1, 'Alice', 97);
    await expect(turn(bob)).toContainText('Your turn');
    // A 6 that would pass 100 still rolls again
    await place(table, { 1: 97, 2: 1 }, ['Alice', 'Bob']);
    await rollOnce(table, alice, 6, 'Alice rolled 6 and needs exactly 3 to reach 100, and rolls again');
    await expect(turn(alice)).toContainText('Your turn');
    await rollOnce(table, alice, 3, 'Alice wins!');
    await expectAt(bob, 1, 'Alice', 100);
  });

  test('first to 100 wins and the game ends', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await place(table, { 1: 99, 2: 50 }, ['Alice', 'Bob']);
    await rollOnce(table, alice, 1, 'Alice wins!');
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toBeVisible();
      await expect(turn(page)).toHaveText('Game Over');
      await expect(rollButton(page)).toBeDisabled();
      await expect(playerRow(page, 'Alice')).toContainText('(winner)');
      await expect(playerRow(page, 'Bob')).not.toContainText('(winner)');
    }
  });

  test('a player who leaves loses their token and play goes on', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = table.pages;
    await rollOnce(table, alice, 1, 'Alice rolled 1 and moved from 1 to 2');
    await expect(turn(bob)).toContainText('Your turn');
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(token(alice, 2)).toHaveCount(0);
    await expect(playerRow(alice, 'Bob')).toContainText('left');
    // Bob's turn passed to Cara, and after Cara it is Alice's again
    await expect(turn(cara)).toContainText('Your turn');
    await rollOnce(table, cara, 3, 'Cara rolled 3 and moved from 1 to 4');
    await expect(turn(alice)).toContainText('Your turn');
    // The last player left wins
    await leave(cara);
    await dismiss('Cara', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo needs every player still in the game to approve', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = table.pages;
    await rollOnce(table, alice, 4, 'Alice rolled 4 and moved from 1 to 5');
    await bob.getByRole('button', { name: 'Undo' }).click();
    await cara.getByRole('button', { name: 'Approve' }).click();
    // One approval is not enough while Alice has not voted
    await expect(alice.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(bob.locator('.undo-vote')).toHaveCount(1);
    await expectAt(bob, 1, 'Alice', 5);
    await alice.getByRole('button', { name: 'Approve' }).click();
    for (const page of table.pages) await expectAt(page, 1, 'Alice', 1);
    await expect(bob.locator('.undo-vote')).toHaveCount(0);
  });

  test('a player who left has no say in an undo', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = table.pages;
    await rollOnce(table, alice, 1, 'Alice rolled 1 and moved from 1 to 2');
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(token(alice, 3)).toHaveCount(0);
    await rollOnce(table, bob, 3, 'Bob rolled 3 and moved from 1 to 4');
    // Alice and Bob are everyone still in the game, so Alice's request and Bob's approval undo the roll
    await undo(alice, bob);
    for (const page of [alice, bob]) await expectAt(page, 2, 'Bob', 1);
    await expect(alice.locator('.undo-vote')).toHaveCount(0);
    await expect(turn(bob)).toContainText('Your turn');
  });

  test('a declined undo keeps the roll, and an approved one is rolled again fresh', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await rollOnce(table, alice, 4, 'Alice rolled 4 and moved from 1 to 5');

    await bob.getByRole('button', { name: 'Undo' }).click();
    await expect(rollButton(bob)).toBeDisabled(); // no roll while the vote is open
    await alice.getByRole('button', { name: 'Decline' }).click();
    await expect(bob.locator('.undo-vote')).toHaveCount(0);
    await expectAt(bob, 1, 'Alice', 5);

    await undo(alice, bob);
    await expectAt(alice, 1, 'Alice', 1);
    await expectAt(bob, 1, 'Alice', 1);
    await expect(turn(alice)).toContainText('Your turn');
    // The undone roll is rolled again fresh
    await rollOnce(table, alice, 2, 'Alice rolled 2 and climbed a ladder from 3 to 22');
  });
});

test.describe('Snakes and Ladders layout', () => {
  test('the board draws the eight documented ladders and eight snakes', async ({ seat }) => {
    const { pages: [alice] } = await seat('snakesladders', ['Alice', 'Bob']);
    const pairs = (kind: string) => alice.locator(`g[data-kind="${kind}"]`).evaluateAll(groups =>
      Object.fromEntries(groups.map(group => [Number(group.getAttribute('data-from')), Number(group.getAttribute('data-to'))])));
    await expect(alice.locator('g[data-kind="ladder"]')).toHaveCount(8);
    await expect(alice.locator('g[data-kind="snake"]')).toHaveCount(8);
    expect(await pairs('ladder')).toEqual(LADDERS);
    expect(await pairs('snake')).toEqual(SNAKES);
  });
});

test.describe('Snakes and Ladders controls', () => {
  test('only the current player can press Roll', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await expect(rollButton(alice)).toBeEnabled();
    await expect(rollButton(bob)).toBeDisabled();
    await rollOnce(table, alice, 1, 'Alice rolled 1 and moved from 1 to 2');
    await expect(rollButton(alice)).toBeDisabled();
    await expect(rollButton(bob)).toBeEnabled();
  });

  test('the die shows the last roll', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await expect(bob.locator('.sl-roller')).toHaveText('No roll yet');
    await rollOnce(table, alice, 4, 'Alice rolled 4 and moved from 1 to 5');
    await expect(bob.getByRole('img', { name: 'Last roll: 4' })).toBeVisible();
    await expect(bob.locator('.sl-roller')).toHaveText("Alice's roll");
  });

  test('the last move\'s squares are outlined', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await rollOnce(table, alice, 2, 'Alice rolled 2 and climbed a ladder from 3 to 22');
    for (const page of [alice, bob]) {
      await expect(square(page, 1)).toHaveClass(/sl-last-from/);
      await expect(square(page, 22)).toHaveClass(/sl-last-to/);
      await expect(page.locator('.sl-last-from')).toHaveCount(1);
      await expect(page.locator('.sl-last-to')).toHaveCount(1);
    }
    const styles = await bob.evaluate(() => [
      getComputedStyle(document.querySelector('.sl-last-from')!).outlineStyle,
      getComputedStyle(document.querySelector('.sl-last-to')!).outlineStyle
    ]);
    expect(styles).toEqual(['dashed', 'solid']);
  });

  test('the player list shows each player\'s square and highlights the player on turn', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await expect(playerRow(bob, 'Alice')).toHaveClass(/sl-player-current/);
    await expect(playerRow(bob, 'Bob')).not.toHaveClass(/sl-player-current/);
    await rollOnce(table, alice, 4, 'Alice rolled 4 and moved from 1 to 5');
    await expect(playerRow(bob, 'Alice')).toContainText('Square 5');
    await expect(playerRow(bob, 'Bob')).toContainText('Square 1');
    await expect(playerRow(bob, 'Bob')).toHaveClass(/sl-player-current/);
    await expect(playerRow(bob, 'Alice')).not.toHaveClass(/sl-player-current/);
  });

  test('Color-blind symbols show a shape on each token and in the player list', async ({ seat }) => {
    const { pages: [alice] } = await seat('snakesladders', ['Alice', 'Bob', 'Cara']);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    for (const [seatNumber, shape] of [[1, 'circle'], [2, 'square'], [3, 'triangle']] as const) {
      await expect(token(alice, seatNumber).locator(`.color-symbol-${shape}`)).toHaveCount(1);
      await expect(alice.locator(`.sl-player-dot.sl-seat${seatNumber} .color-symbol-${shape}`)).toHaveCount(1);
    }
    await setPreference(alice, 'Color-blind symbols', false);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
  });

  test('the token walks along the path', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob'], { motion: true });
    const [alice, bob] = table.pages;
    await table.dice(5);
    await rollButton(alice).click();
    await expect.poll(() => token(bob, 1).evaluate(element => element.getAnimations().length), { intervals: [20] }).toBeGreaterThan(0);
    await expectAt(bob, 1, 'Alice', 6);
  });

  test('History shows each roll and its board', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await rollOnce(table, alice, 4, 'Alice rolled 4 and moved from 1 to 5');
    await rollOnce(table, bob, 2, 'Bob rolled 2 and climbed a ladder from 3 to 22');
    await bob.getByRole('button', { name: 'History' }).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-move')).toContainText('Bob rolled 2 and climbed a ladder from 3 to 22');
    await expect(token(history, 2)).toHaveAttribute('aria-label', 'Bob, square 22');
    await expect(history.locator('.sl-last-to')).toHaveAttribute('data-square', '22');
    await history.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(history.locator('.history-move')).toContainText('Alice rolled 4 and moved from 1 to 5');
    await expect(token(history, 1)).toHaveAttribute('aria-label', 'Alice, square 5');
    await expect(token(history, 2)).toHaveAttribute('aria-label', 'Bob, square 1');
    await expect(history.locator('.sl-last-from')).toHaveAttribute('data-square', '1');
    await expect(history.locator('.sl-last-to')).toHaveAttribute('data-square', '5');
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { pages: [alice] } = await seat('snakesladders', ['Alice', 'Bob']);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('What happens when I roll a 6?');
    await expect(faq).toContainText('There is no limit on how many sixes in a row you can roll');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });

  test('on a phone the Roll button is on screen below the board', async ({ seat }) => {
    const { pages: [alice] } = await seat('snakesladders', ['Alice', 'Bob']);
    await alice.setViewportSize({ width: 390, height: 844 });
    await expect(rollButton(alice)).toBeVisible();
    const box = (await rollButton(alice).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    const { scrollWidth, minWidth } = await alice.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      minWidth: parseFloat(getComputedStyle(document.body).minWidth) || 0,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(Math.max(390, minWidth));
  });
});

test.describe('Snakes and Ladders differences from Wikipedia', () => {
  test('seat 1 always starts', async ({ seat }) => {
    const table = await seat('snakesladders', ['Bob', 'Alice']);
    const [bob, alice] = table.pages;
    // No roll-off: the first to join rolls first
    await expect(bob.locator('.sl-roller')).toHaveText('No roll yet');
    await expect(turn(bob)).toContainText('Your turn');
    await expect(turn(alice)).toContainText("Bob's turn");
    await expect(rollButton(alice)).toBeDisabled();
  });

  test('any number of sixes in a row keep rolling', async ({ seat }) => {
    const table = await seat('snakesladders', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await table.dice(6, 6, 6, 2);
    await press(alice, 'Alice rolled 6 and moved from 1 to 7, and rolls again');
    await press(alice, 'Alice rolled 6 and moved from 7 to 13, and rolls again');
    await press(alice, 'Alice rolled 6 and moved from 13 to 19, and rolls again');
    await expect(rollButton(bob)).toBeDisabled();
    await press(alice, 'Alice rolled 2 and climbed a ladder from 21 to 42');
    await expect(turn(bob)).toContainText('Your turn');
  });
});
