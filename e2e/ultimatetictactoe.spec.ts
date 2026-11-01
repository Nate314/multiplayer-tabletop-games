import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, tableScreen, test, undo, type Seat, type Table } from './fixtures.ts';
import type { Cells } from '../games/tictactoe/lines.ts';

// One test per rule and control in games/ultimatetictactoe/README.md. In game 1 seat 1 (Alice) plays X and moves first,
// seat 2 (Bob) plays O. Boards and their cells are numbered 0 to 8, row-major from the top left, as the server stores them.

// One small board: rows from the top, '.' for empty and '1' or '2' for the seat holding the cell
function cellsOf(...rows: string[]): Cells {
  return [...rows.join('')].map(cell => cell === '.' ? null : Number(cell) as 1 | 2);
}

// The nine boards, empty except the ones given by board number
function boardsOf(given: Record<number, Cells>): Cells[] {
  return Array.from({ length: 9 }, (_, board) => given[board] ?? cellsOf('...', '...', '...'));
}

const X_CLAIMED = cellsOf('111', '22.', '...');
const O_CLAIMED = cellsOf('222', '11.', '...');
const FULL = cellsOf('121', '122', '211');

// Boards in play, `toMove` to mark in `forcedBoard` (null for any open board)
async function setUp(table: Table, boards: Cells[], forcedBoard: number | null, toMove = 1) {
  await table.patch({ boards, forcedBoard, lastMove: null, winningLine: null, currentPlayer: toMove, started: true });
}

const cell = (page: Page, board: number, index: number) => page.locator(`[data-anim-key="cell-${board}-${index}"]`);
const smallBoard = (page: Page, board: number) => page.locator(`.small-board[data-board="${board}"]`);
const playable = (page: Page) => page.locator('.small-board.playable');
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });

async function start(seat: Seat) {
  const table = await seat('ultimatetictactoe', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

test.describe('Ultimate Tic-Tac-Toe rules', () => {
  test('nine boards of nine cells, X first and free to play anywhere', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.small-board')).toHaveCount(9);
    await expect(alice.locator('.cell')).toHaveCount(81);
    await expect(alice.locator('.cell .mark')).toHaveCount(0);
    await expect(playable(alice)).toHaveCount(9);
    await expect(smallBoard(alice, 2)).toHaveAttribute('aria-label', 'Top right board');
    await expect(cell(alice, 4, 4)).toHaveAttribute('aria-label', 'Center, empty');
    await expect(cell(alice, 0, 0)).toBeEnabled();
    await expect(cell(alice, 8, 8)).toBeEnabled();
    await expect(turn(alice)).toHaveText('You (X) move first. Joining closes after the first move.');
    await expect(turn(bob)).toHaveText('Alice (X) moves first. Joining closes after the first move.');
  });

  test('the cell played sends the opponent to the matching board', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4, 2).click();
    await expect(status(bob)).toHaveText('Alice placed X in the top right of the center board');
    await expect(playable(bob)).toHaveCount(1);
    await expect(smallBoard(bob, 2)).toHaveClass(/playable/);
    await expect(cell(bob, 2, 0)).toBeEnabled();
    await expect(cell(bob, 4, 0)).toBeDisabled();
    await expect(cell(bob, 0, 0)).toBeDisabled();
    await expect(cell(bob, 4, 2)).toHaveAttribute('aria-label', 'Top right, X');
    await cell(bob, 2, 4).click();
    await expect(playable(alice)).toHaveCount(1);
    await expect(smallBoard(alice, 4)).toHaveClass(/playable/);
    await expect(cell(alice, 4, 2)).toBeDisabled();
    await expect(cell(alice, 4, 0)).toBeEnabled();
  });

  test('sent to a won or full board, the player may play in any open board', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardsOf({ 0: FULL, 2: X_CLAIMED }), 4);
    await cell(alice, 4, 0).click(); // sends Bob to the full top left board
    await expect(playable(bob)).toHaveCount(7);
    await expect(smallBoard(bob, 0)).not.toHaveClass(/playable/);
    await expect(cell(bob, 8, 8)).toBeEnabled();
    await expect(cell(bob, 1, 0)).toBeEnabled();
    await cell(bob, 1, 2).click(); // sends Alice to the won top right board
    await expect(playable(alice)).toHaveCount(7);
    await expect(smallBoard(alice, 2)).not.toHaveClass(/playable/);
    await expect(cell(alice, 6, 0)).toBeEnabled();
  });

  test('a won board takes no more marks', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await setUp(table, boardsOf({ 2: X_CLAIMED }), null);
    await expect(playable(alice)).toHaveCount(8);
    await expect(smallBoard(alice, 2)).not.toHaveClass(/playable/);
    await expect(cell(alice, 2, 5)).toHaveAttribute('aria-label', 'Middle right, empty');
    for (const index of [5, 6, 7, 8]) await expect(cell(alice, 2, index)).toBeDisabled();
    await expect(cell(alice, 0, 0)).toBeEnabled();
  });

  test('three in a row claims a small board', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardsOf({ 4: cellsOf('11.', '22.', '...') }), 4);
    await cell(alice, 4, 2).click();
    await expect(status(bob)).toHaveText(/ and claimed it$/);
    await expect(status(bob)).toHaveText('Alice placed X in the top right of the center board and claimed it');
    await expect(smallBoard(bob, 4)).toHaveClass(/claimed claimed-x/);
    await expect(smallBoard(bob, 4).locator('.claimed-mark .mark-x')).toHaveCount(1);
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('three claimed boards in a row win', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardsOf({ 0: X_CLAIMED, 1: X_CLAIMED, 2: cellsOf('11.', '22.', '...') }), 2);
    await cell(alice, 2, 2).click();
    await expect(status(bob)).toHaveText('Alice wins with three boards in a row!');
    await expect(bob.locator('.small-board.winning')).toHaveCount(3);
    for (const board of [0, 1, 2]) await expect(smallBoard(bob, board)).toHaveClass(/winning/);
    await expect(turn(bob)).toHaveText('Game Over');
  });

  test('a drawn board counts for nobody', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardsOf({ 0: FULL, 1: X_CLAIMED, 2: cellsOf('11.', '22.', '...') }), 2);
    await expect(smallBoard(alice, 0)).toHaveClass(/drawn/);
    await cell(alice, 2, 2).click();
    await expect(status(bob)).toHaveText('Alice placed X in the top right of the top right board and claimed it');
    await expect(bob.locator('.small-board.winning')).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('every board decided with no line is a draw', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // X O X / X O O / O X and a last open board that fills with no line
    await setUp(table, boardsOf({
      0: X_CLAIMED, 1: O_CLAIMED, 2: X_CLAIMED, 3: X_CLAIMED, 4: O_CLAIMED, 5: O_CLAIMED, 6: O_CLAIMED, 7: X_CLAIMED,
      8: cellsOf('121', '122', '21.')
    }), 8);
    await cell(alice, 8, 8).click();
    await expect(status(bob)).toHaveText('Every board is decided with no line. Draw.');
    await expect(turn(bob)).toHaveText('Game Over');
    await expect(smallBoard(bob, 8)).toHaveClass(/drawn/);
    await expect(bob.locator('.small-board.winning')).toHaveCount(0);
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
    await expect(cell(bob, 0, 0)).toBeEnabled();
    await expect(cell(alice, 0, 0)).toBeDisabled();
    await cell(bob, 0, 0).click();
    await expect(cell(alice, 0, 0)).toHaveAttribute('aria-label', 'Top left, X');
  });

  test('a player may resign at any time and the opponent wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4, 4).click();
    await expect(turn(alice)).toHaveText("Bob's turn");
    await alice.getByRole('button', { name: 'Resign' }).click();
    await alice.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(bob)).toHaveText('Alice resigned. Bob wins!');
  });

  test('a draw is agreed when accepted, and lapses when declined or after a move', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4, 4).click();
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(status(alice)).toHaveText('Bob declined the draw');

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await cell(bob, 4, 0).click();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toHaveCount(0);
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Accept draw' }).click();
    await expect(status(alice)).toHaveText('Draw by agreement');
    await expect(turn(alice)).toHaveText('Game Over');
  });

  test('if a player is dismissed mid-game, the other player wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4, 4).click();
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test("an undo needs the other player's approval", async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4, 2).click();
    await expect(cell(alice, 4, 2)).toHaveAttribute('aria-label', 'Top right, X');

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(cell(alice, 4, 2)).toHaveAttribute('aria-label', 'Top right, X');

    await undo(alice, bob);
    await expect(cell(alice, 4, 2)).toHaveAttribute('aria-label', 'Top right, empty');
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(playable(alice)).toHaveCount(9);
  });
});

test.describe('Ultimate Tic-Tac-Toe controls', () => {
  test('click an empty cell in a highlighted board', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 0, 8).click();
    await expect(cell(bob, 0, 8).locator('.mark-x')).toHaveCount(1);
    await expect(cell(bob, 0, 8).getByRole('img', { name: 'X' })).toHaveCount(1);
    await expect(smallBoard(bob, 8)).toHaveClass(/playable/);
    const highlight = await smallBoard(bob, 8).evaluate(element => getComputedStyle(element).outlineStyle);
    expect(highlight).toBe('solid');
    const plain = await smallBoard(bob, 0).evaluate(element => getComputedStyle(element).outlineStyle);
    expect(plain).toBe('none');
    await cell(bob, 8, 0).click();
    await expect(cell(alice, 8, 0).locator('.mark-o')).toHaveCount(1);
  });

  test('a claimed board shows its big mark and a drawn board is greyed out', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await setUp(table, boardsOf({ 0: FULL, 1: O_CLAIMED }), null);
    await expect(smallBoard(alice, 1)).toHaveClass(/claimed-o/);
    await expect(smallBoard(alice, 1).locator('.claimed-mark').getByRole('img', { name: 'O' })).toHaveCount(1);
    await expect(smallBoard(alice, 0)).toHaveClass(/drawn/);
    await expect(smallBoard(alice, 0).locator('.claimed-mark')).toHaveCount(0);
    const grey = await smallBoard(alice, 0).evaluate(element => getComputedStyle(element).filter);
    expect(grey).toContain('grayscale');
  });

  test('the last mark is outlined and the winning boards glow', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, boardsOf({ 0: X_CLAIMED, 1: X_CLAIMED, 2: cellsOf('1..', '22.', '...') }), 2);
    await cell(alice, 2, 1).click();
    await expect(bob.locator('.cell.last-move')).toHaveCount(1);
    await expect(cell(bob, 2, 1)).toHaveClass(/last-move/);
    const outline = await cell(bob, 2, 1).evaluate(element => getComputedStyle(element).outlineColor);
    expect(outline).toBe('rgb(255, 213, 79)');

    await cell(bob, 3, 2).click(); // Sent to the won top middle board, Bob plays anywhere and sends Alice back to the top right
    await cell(alice, 2, 2).click();
    await expect(bob.locator('.small-board.winning')).toHaveCount(3);
    const glow = await smallBoard(bob, 0).evaluate(element => getComputedStyle(element).boxShadow);
    expect(glow).toContain('rgb(102, 187, 106)');
  });

  test('off turn the board is dimmed and its cells are off', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.board')).not.toHaveClass(/dimmed/);
    await expect(bob.locator('.board')).toHaveClass(/dimmed/);
    await expect.poll(() => bob.locator('.board').evaluate(element => getComputedStyle(element).opacity)).toBe('0.75');
    await expect(cell(bob, 0, 0)).toBeDisabled();
    await expect(cell(alice, 0, 0)).toBeEnabled();
  });

  test('the big board fits a 320 px phone with tappable cells', async ({ seat }) => {
    const { alice } = await start(seat);
    await alice.setViewportSize({ width: 320, height: 700 });
    await expect(alice.locator('.cell')).toHaveCount(81);
    await expect.poll(() => alice.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const widths = await alice.locator('.cell').evaluateAll(cells => cells.map(element => element.getBoundingClientRect().width));
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(28);
    await cell(alice, 8, 8).click();
    await expect(cell(alice, 8, 8)).toHaveAttribute('aria-label', 'Bottom right, X');
  });

  test('clicking Undo asks the opponent', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4, 4).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('Offer draw reads Draw offered until answered', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4, 4).click();
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(alice.getByRole('button', { name: 'Draw offered' })).toBeDisabled();
    await expect(bob.locator('.draw-offer')).toContainText('Alice offers a draw');
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();
  });

  test('Resign asks to Confirm resign, and Keep playing changes your mind', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await cell(alice, 4, 4).click();
    await bob.getByRole('button', { name: 'Resign' }).click();
    await bob.getByRole('button', { name: 'Keep playing' }).click();
    await expect(bob.getByRole('button', { name: 'Confirm resign' })).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Your turn');

    await bob.getByRole('button', { name: 'Resign' }).click();
    await bob.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(alice)).toHaveText('Bob resigned. Alice wins!');
  });

  test('with a table screen on Hand only, the boards show only on your turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await tableScreen(table);
    for (const page of [alice, bob]) await expect(page.locator('.game-root[data-hand-only]')).toHaveCount(1);
    await expect(alice.locator('.big-board')).toBeVisible();
    await expect(bob.locator('.big-board')).toBeHidden();
    await cell(alice, 4, 4).click();
    await expect(bob.locator('.big-board')).toBeVisible();
    await expect(alice.locator('.big-board')).toBeHidden();
  });

  test('FAQ shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Where can I play?');
    await expect(faq).toContainText('What happens to a full board?');
    await expect(faq).toContainText('three boards in a row');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
