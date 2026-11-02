import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, tableScreen, test, undo, type Seat, type Table } from './fixtures.ts';
import type { Cells } from '../games/tictactoe/lines.ts';

// One test per rule and control in games/tictactoe/README.md. In game 1 seat 1 (Alice) plays X and moves first,
// seat 2 (Bob) plays O. Cells are numbered 0 to 8, row-major from the top left, as the server stores them.

// Rows from the top, '.' for empty and '1' or '2' for the seat holding the cell
function boardOf(...rows: string[]): Cells {
  return [...rows.join('')].map(cell => cell === '.' ? null : Number(cell) as 1 | 2);
}

// A board in play, `toMove` to mark
async function setUp(table: Table, board: Cells, toMove = 1) {
  await table.patch({ board, lastMove: null, winningLine: null, currentPlayer: toMove, started: true });
}

const cell = (page: Page, index: number) => page.locator(`[data-anim-key="cell-${index}"]`);
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });

async function start(seat: Seat) {
  const table = await seat('tictactoe', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

async function expectWin(page: Page, cells: number[], text: string) {
  await expect(status(page)).toHaveText(text);
  await expect(page.locator('.cell.winning')).toHaveCount(3);
  for (const index of cells) await expect(cell(page, index)).toHaveClass(/winning/);
  await expect(turn(page)).toHaveText('Game Over');
}

test.describe('Tic-Tac-Toe rules', () => {
  test('the grid has nine empty cells and X moves first', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.cell')).toHaveCount(9);
    await expect(alice.locator('.cell .mark')).toHaveCount(0);
    await expect(cell(alice, 4)).toHaveAttribute('aria-label', 'Center, empty');
    await expect(turn(alice)).toHaveText('You (X) move first. Joining closes after the first move.');
    await expect(turn(bob)).toHaveText('Alice (X) moves first. Joining closes after the first move.');
  });

  test('players take turns, and a taken cell cannot be chosen', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4).click();
    await expect(status(bob)).toHaveText('Alice placed X in the center');
    await expect(cell(bob, 4)).toHaveAttribute('aria-label', 'Center, X');
    await expect(cell(bob, 4)).toBeDisabled();
    await expect(turn(bob)).toHaveText('Your turn');
    await cell(bob, 0).click();
    await expect(cell(alice, 0)).toHaveAttribute('aria-label', 'Top left, O');
    await expect(status(alice)).toHaveText('Bob placed O in the top left');
    await expect(cell(alice, 0)).toBeDisabled();
    await expect(cell(alice, 4)).toBeDisabled();
    await expect(cell(alice, 8)).toBeEnabled();
  });

  test('three in a row wins across, down and on a diagonal', async ({ seat }) => {
    const across = await start(seat);
    await setUp(across.table, boardOf('11.', '22.', '...'));
    await cell(across.alice, 2).click();
    await expectWin(across.bob, [0, 1, 2], 'Alice wins with three in a row!');

    const down = await start(seat);
    await setUp(down.table, boardOf('12.', '12.', '...'));
    await cell(down.alice, 6).click();
    await expectWin(down.bob, [0, 3, 6], 'Alice wins with three in a row!');

    const diagonal = await start(seat);
    await setUp(diagonal.table, boardOf('..1', '21.', '..2'));
    await cell(diagonal.alice, 6).click();
    await expect(status(diagonal.bob)).toHaveText('Alice wins with three in a row!');
    await expect(diagonal.bob.locator('.cell.winning')).toHaveCount(3);
    for (const index of [2, 4, 6]) await expect(cell(diagonal.bob, index)).toHaveClass(/winning/);
  });

  test('O can win', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardOf('22.', '11.', '..1'), 2);
    await cell(bob, 2).click();
    await expectWin(alice, [0, 1, 2], 'Bob wins with three in a row!');
  });

  test('a full grid with no line is a draw', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardOf('121', '122', '21.'));
    await cell(alice, 8).click();
    await expect(status(bob)).toHaveText('The board is full. Draw.');
    await expect(turn(bob)).toHaveText('Game Over');
    await expect(bob.locator('.cell.winning')).toHaveCount(0);
  });

  test('on a rematch the marks swap and the other player moves first', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({ isGameOver: true, currentPlayer: null, winners: [1], gameStatus: 'Alice wins!' });
    for (const page of [alice, bob]) await expect(gameOver(page)).toBeVisible();
    await gameOver(alice).getByRole('button', { name: 'Rematch' }).click();
    await gameOver(bob).getByRole('button', { name: 'Join', exact: true }).click();
    for (const page of [alice, bob]) await expect(gameOver(page)).toHaveCount(0);
    await expect(turn(alice)).toHaveText('Bob (X) moves first. Joining closes after the first move.');
    await expect(turn(bob)).toHaveText('You (X) move first. Joining closes after the first move.');
    await expect(cell(bob, 0)).toBeEnabled();
    await expect(cell(alice, 0)).toBeDisabled();
    await cell(bob, 0).click();
    await expect(cell(alice, 0)).toHaveAttribute('aria-label', 'Top left, X');
  });

  test('a player may resign at any time and the opponent wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4).click();
    await expect(turn(alice)).toHaveText("Bob's turn");
    await alice.getByRole('button', { name: 'Resign' }).click();
    await alice.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(bob)).toHaveText('Alice resigned. Bob wins!');
  });

  test('a draw is agreed when accepted, and lapses when declined or after a move', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4).click();
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(status(alice)).toHaveText('Bob declined the draw');

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await cell(bob, 0).click();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toHaveCount(0);
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Accept draw' }).click();
    await expect(status(alice)).toHaveText('Draw by agreement');
    await expect(turn(alice)).toHaveText('Game Over');
  });

  test('if a player is dismissed mid-game, the other player wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4).click();
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test("an undo needs the other player's approval", async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4).click();
    await expect(cell(alice, 4)).toHaveAttribute('aria-label', 'Center, X');

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(cell(alice, 4)).toHaveAttribute('aria-label', 'Center, X');

    await undo(alice, bob);
    await expect(cell(alice, 4)).toHaveAttribute('aria-label', 'Center, empty');
    await expect(turn(alice)).toHaveText('Your turn');
  });
});

test.describe('Tic-Tac-Toe controls', () => {
  test('click an empty cell to place your mark', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 0).click();
    await expect(cell(bob, 0).locator('.mark-x')).toHaveCount(1);
    await expect(cell(bob, 0).getByRole('img', { name: 'X' })).toHaveCount(1);
    await cell(bob, 8).click();
    await expect(cell(alice, 8).locator('.mark-o')).toHaveCount(1);
  });

  test('the last mark is outlined and the winning three glow', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardOf('1..', '22.', '...'));
    await cell(alice, 1).click();
    await expect(bob.locator('.cell.last-move')).toHaveCount(1);
    await expect(cell(bob, 1)).toHaveClass(/last-move/);
    const outline = await cell(bob, 1).evaluate(element => getComputedStyle(element).outlineColor);
    expect(outline).toBe('rgb(255, 213, 79)');

    await cell(bob, 8).click();
    await cell(alice, 2).click();
    await expect(bob.locator('.cell.winning')).toHaveCount(3);
    const glow = await cell(bob, 0).evaluate(element => getComputedStyle(element).boxShadow);
    expect(glow).toContain('rgb(102, 187, 106)');
  });

  test('off turn the board is dimmed and its cells are off', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.board')).not.toHaveClass(/dimmed/);
    await expect(bob.locator('.board')).toHaveClass(/dimmed/);
    await expect.poll(() => bob.locator('.board').evaluate(element => getComputedStyle(element).opacity)).toBe('0.75');
    await expect(cell(bob, 0)).toBeDisabled();
    await expect(cell(alice, 0)).toBeEnabled();
  });

  test('clicking Undo asks the opponent', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('Offer draw reads Draw offered until answered', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4).click();
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(alice.getByRole('button', { name: 'Draw offered' })).toBeDisabled();
    await expect(bob.locator('.draw-offer')).toContainText('Alice offers a draw');
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();
  });

  test('Resign asks to Confirm resign, and Keep playing changes your mind', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4).click();
    await bob.getByRole('button', { name: 'Resign' }).click();
    await bob.getByRole('button', { name: 'Keep playing' }).click();
    await expect(bob.getByRole('button', { name: 'Confirm resign' })).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Your turn');

    await bob.getByRole('button', { name: 'Resign' }).click();
    await bob.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(alice)).toHaveText('Bob resigned. Alice wins!');
  });

  test('with a table screen on Hand only, the board shows only on your turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await tableScreen(table);
    for (const page of [alice, bob]) await expect(page.locator('.game-root[data-hand-only]')).toHaveCount(1);
    await expect(alice.locator('.ttt-grid')).toBeVisible();
    await expect(bob.locator('.ttt-grid')).toBeHidden();
    await cell(alice, 4).click();
    await expect(bob.locator('.ttt-grid')).toBeVisible();
    await expect(alice.locator('.ttt-grid')).toBeHidden();
  });

  test('FAQ shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How do I place a mark?');
    await expect(faq).toContainText('Who goes first?');
    await expect(faq).toContainText('three of your marks in a row');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
