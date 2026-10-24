import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Seat, type Table } from './fixtures.ts';
import type { Board } from '../games/connectfour/types.ts';

// One test per rule, control and difference in games/connectfour/README.md. Seat 1 (Alice) plays Red and moves first,
// seat 2 (Bob) plays Yellow. Cells are named 'row,col' as the server stores them, row 0 at the top.

// Rows from the top, '.' for empty and '1' or '2' for a disc
function boardOf(...rows: string[]): Board {
  return rows.map(row => [...row].map(cell => cell === '.' ? null : Number(cell) as 1 | 2));
}

const EMPTY = Array<string>(6).fill('.......');

// A board in play, `toMove` to drop
async function setUp(table: Table, board: Board, toMove = 1) {
  await table.patch({ board, lastMove: null, winningLine: null, currentPlayer: toMove, started: true });
}

const cell = (page: Page, name: string) => page.locator(`[data-anim-key="cell-${name.replace(',', '-')}"]`);
const disc = (page: Page, name: string) => cell(page, name).locator('.disc');
const arrow = (page: Page, column: number) => page.getByRole('button', { name: `Drop in column ${column}` });
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');

async function start(seat: Seat) {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

async function expectWin(page: Page, cells: string[], text: string) {
  await expect(status(page)).toHaveText(text);
  await expect(page.locator('.cell.winning')).toHaveCount(4);
  for (const name of cells) await expect(cell(page, name)).toHaveClass(/winning/);
  await expect(turn(page)).toHaveText('Game Over');
}

// Full except the top of column 7, with no four in a row anywhere
const NEARLY_FULL = ['1221122', '2112211', '1221122', '2112211', '1221122', '2112211'];

test.describe('Connect Four rules', () => {
  test('the grid has 7 columns and 6 rows and starts empty, with Red to move', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.cell')).toHaveCount(42);
    await expect(alice.locator('.drop-button')).toHaveCount(7);
    await expect(alice.locator('.disc')).toHaveCount(0);
    await expect(turn(alice)).toHaveText('You (Red) move first. Joining closes after the first move.');
    await expect(turn(bob)).toHaveText('Alice (Red) moves first. Joining closes after the first move.');
  });

  test('a disc falls to the lowest empty cell', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 4).click();
    await expect(disc(bob, '5,3')).toHaveAttribute('aria-label', 'Red disc');
    await arrow(bob, 4).click();
    await expect(disc(alice, '4,3')).toHaveAttribute('aria-label', 'Yellow disc');
    await expect(disc(alice, '5,3')).toHaveAttribute('aria-label', 'Red disc');
    await expect(alice.locator('.disc')).toHaveCount(2);
    await expect(status(alice)).toHaveText('Bob dropped a disc in column 4');
  });

  test('a full column is refused', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await setUp(table, boardOf('2......', '1......', '2......', '1......', '2......', '1......'));
    await expect(arrow(alice, 1)).toBeDisabled();
    await expect(arrow(alice, 2)).toBeEnabled();
    await cell(alice, '3,0').click();
    await expect(alice.locator('.disc')).toHaveCount(6);
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('four in a row wins horizontally', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardOf(...EMPTY.slice(0, 5), '111....'));
    await arrow(alice, 4).click();
    await expectWin(bob, ['5,0', '5,1', '5,2', '5,3'], 'Alice wins with four in a row!');
  });

  test('four in a row wins vertically', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardOf(...EMPTY.slice(0, 3), '1......', '1......', '1......'));
    await arrow(alice, 1).click();
    await expectWin(bob, ['2,0', '3,0', '4,0', '5,0'], 'Alice wins with four in a row!');
  });

  test('four in a row wins on both diagonals', async ({ seat }) => {
    const rising = await start(seat);
    await setUp(rising.table, boardOf(...EMPTY.slice(0, 3), '..12...', '.122...', '1222...'));
    await arrow(rising.alice, 4).click();
    await expectWin(rising.bob, ['5,0', '4,1', '3,2', '2,3'], 'Alice wins with four in a row!');

    const falling = await start(seat);
    await setUp(falling.table, boardOf(...EMPTY.slice(0, 3), '...21..', '...221.', '...2221'));
    await arrow(falling.alice, 4).click();
    await expectWin(falling.bob, ['5,6', '4,5', '3,4', '2,3'], 'Alice wins with four in a row!');
  });

  test('the second player can win, and three in a row does not end the game', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardOf(...EMPTY.slice(0, 5), '222....'));
    await arrow(alice, 7).click();
    await expect(turn(bob)).toHaveText('Your turn');
    await arrow(bob, 4).click();
    await expectWin(alice, ['5,0', '5,1', '5,2', '5,3'], 'Bob wins with four in a row!');
  });

  test('a full board with no four is a draw', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const board = boardOf(...NEARLY_FULL);
    board[0][6] = null;
    await setUp(table, board, 2);
    await arrow(bob, 7).click();
    await expect(status(alice)).toHaveText('The board is full. Draw.');
    await expect(turn(alice)).toHaveText('Game Over');
    await expect(alice.locator('.cell.winning')).toHaveCount(0);
  });

  test('a player may resign at any time, on either turn, and the opponent wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 1).click();
    await expect(turn(alice)).toHaveText("Bob's turn");
    await alice.getByRole('button', { name: 'Resign' }).click();
    await alice.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(bob)).toHaveText('Alice resigned. Bob wins!');
  });

  test('a draw is agreed when the opponent accepts, and an offer lapses when declined or when the opponent drops a disc', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 1).click();
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(status(alice)).toHaveText('Bob declined the draw');

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await arrow(bob, 2).click();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toHaveCount(0);
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Accept draw' }).click();
    await expect(status(alice)).toHaveText('Draw by agreement');
    await expect(turn(alice)).toHaveText('Game Over');
  });

  test('if a player is dismissed mid-game, the other player wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 1).click();
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test("an undo needs the other player's approval", async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 1).click();
    await expect(disc(alice, '5,0')).toHaveCount(1);

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(disc(alice, '5,0')).toHaveCount(1);

    await undo(alice, bob);
    await expect(disc(alice, '5,0')).toHaveCount(0);
    await expect(turn(alice)).toHaveText('Your turn');
  });
});

test.describe('Connect Four controls', () => {
  test('with Color-blind symbols on, Red discs show a circle and Yellow discs a star, in the board and the player list', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await setPreference(alice, 'Color-blind symbols', true);
    await expect(alice.locator('.player-dot.player1 .color-symbol-circle')).toHaveCount(1);
    await expect(alice.locator('.player-dot.player2 .color-symbol-star')).toHaveCount(1);
    await expect(alice.locator('.disc .color-symbol')).toHaveCount(0);
    await arrow(alice, 4).click();
    await expect(alice.locator('.disc.player1 .color-symbol-circle')).toHaveCount(1);
    await arrow(bob, 5).click();
    await expect(alice.locator('.disc.player2 .color-symbol-star')).toHaveCount(1);
    await expect(alice.locator('.disc .color-symbol')).toHaveCount(2);
    await expect(bob.locator('.disc .color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', false);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
  });

  test('click the arrow above a column, or anywhere in the column, to drop a disc there', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 3).click();
    await expect(disc(bob, '5,2')).toHaveCount(1);
    await cell(bob, '0,5').click();
    await expect(disc(alice, '5,5')).toHaveAttribute('aria-label', 'Yellow disc');
  });

  test('the arrows are off and the board is dimmed when it is not your turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.board')).not.toHaveClass(/dimmed/);
    await expect(bob.locator('.board')).toHaveClass(/dimmed/);
    await expect.poll(() => bob.locator('.board').evaluate(element => getComputedStyle(element).opacity)).toBe('0.75');
    await expect(arrow(bob, 1)).toBeDisabled();
    await expect(arrow(alice, 1)).toBeEnabled();
  });

  test('the last disc is outlined in yellow, and the winning four glow green', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardOf(...EMPTY.slice(0, 5), '11.....'));
    await arrow(alice, 4).click();
    await expect(bob.locator('.cell.last-move')).toHaveCount(1);
    await expect(cell(bob, '5,3')).toHaveClass(/last-move/);
    const outline = await cell(bob, '5,3').evaluate(element => getComputedStyle(element, '::before').boxShadow);
    expect(outline).toContain('rgb(255, 213, 79)');

    await setUp(table, boardOf(...EMPTY.slice(0, 5), '111....'));
    await arrow(alice, 4).click();
    const glow = await disc(bob, '5,3').evaluate(element => getComputedStyle(element).outlineColor);
    expect(glow).toBe('rgb(102, 187, 106)');
  });

  test('clicking Undo asks the opponent to undo the last disc', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 1).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('Offer draw reads Draw offered until answered, and the opponent sees Accept draw and Decline', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 1).click();
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(alice.getByRole('button', { name: 'Draw offered' })).toBeDisabled();
    await expect(bob.locator('.draw-offer')).toContainText('Alice offers a draw');
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await expect(bob.getByRole('button', { name: 'Decline' })).toBeVisible();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();
  });

  test('Resign asks to Confirm resign, and Keep playing changes your mind', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await arrow(alice, 1).click();
    await bob.getByRole('button', { name: 'Resign' }).click();
    await bob.getByRole('button', { name: 'Keep playing' }).click();
    await expect(bob.getByRole('button', { name: 'Confirm resign' })).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Your turn');

    await bob.getByRole('button', { name: 'Resign' }).click();
    await bob.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(alice)).toHaveText('Bob resigned. Alice wins!');
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How do I drop a disc?');
    await expect(faq).toContainText('four of your discs in a row');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
