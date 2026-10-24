import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Seat as SeatFixture } from './fixtures.ts';
import type { PlacedWall, Position } from '../games/quoridor/types.ts';

// One test per rule and control in games/quoridor/README.md. Every player sees the board the same way up: row 0 is
// the top, where Alice (seat 1) is heading, and Bob (seat 2) starts there heading for row 8.

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];

async function start(seat: SeatFixture, players = 2) {
  const table = await seat('quoridor', NAMES.slice(0, players));
  return { table, pages: table.pages, alice: table.pages[0], bob: table.pages[1] };
}

const board = (page: Page) => page.locator('.board-area .board');
const square = (page: Page, row: number, col: number) => board(page).locator('.board-row').nth(row).locator('.square').nth(col);
const pawn = (page: Page, name: string) => board(page).locator(`.pawn[title="${name}"]`);
const wallsLeft = (page: Page) => page.locator('.game-info').getByText(/^Walls left:/);
const turn = (page: Page, text: string | RegExp) => expect(page.locator('.game-info')).toContainText(text);

const at = (row: number, col: number): Position => ({ row, col });
const hWall = (row: number, col: number, playerNumber = 2): PlacedWall => ({ row, col, orientation: 'horizontal', playerNumber });
const vWall = (row: number, col: number, playerNumber = 2): PlacedWall => ({ row, col, orientation: 'vertical', playerNumber });

// The highlighted squares on `page`, as sorted "row,col" strings
async function highlighted(page: Page): Promise<string[]> {
  return board(page).locator('.board-row').evaluateAll(rows => rows.flatMap((row, r) =>
    [...row.querySelectorAll('.square')].flatMap((cell, c) => cell.classList.contains('valid-move') ? [`${r},${c}`] : [])
  ).sort());
}
const squares = (...positions: Position[]) => positions.map(({ row, col }) => `${row},${col}`).sort();
const expectHighlighted = (page: Page, ...positions: Position[]) =>
  expect.poll(() => highlighted(page)).toEqual(squares(...positions));

test.describe('Quoridor rules', () => {
  test('players take turns either moving their pawn or placing a wall', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await turn(alice, 'Alice moves first');
    await square(alice, 7, 4).click();
    await expect(pawn(alice, 'Alice')).toHaveCount(1);
    await expect(square(alice, 7, 4).locator('.pawn')).toHaveAttribute('title', 'Alice');
    await turn(bob, "Bob's turn");

    await bob.getByRole('button', { name: 'Horizontal Wall' }).click();
    await square(bob, 3, 3).click();
    await expect(board(alice).locator('.wall')).toHaveCount(1);
    await expect(wallsLeft(alice)).toHaveText('Walls left: Alice 10 · Bob 9');
    await turn(alice, "Alice's turn");
    await expect(square(bob, 0, 4).locator('.pawn')).toHaveAttribute('title', 'Bob'); // the wall was Bob's whole turn
  });

  test('pawns move one square up, down, left or right', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await expectHighlighted(alice, at(7, 4), at(8, 3), at(8, 5)); // the bottom edge stops a step down
    await table.patch({ pawns: { 1: at(4, 4), 2: at(0, 4) } });
    await expectHighlighted(alice, at(3, 4), at(5, 4), at(4, 3), at(4, 5));
    await square(alice, 4, 5).click();
    await expect(square(alice, 4, 5).locator('.pawn')).toHaveAttribute('title', 'Alice');
  });

  test('a pawn jumps straight over an adjacent pawn when the square beyond is free and not walled off', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch({ pawns: { 1: at(4, 4), 2: at(3, 4) } });
    await expectHighlighted(alice, at(2, 4), at(5, 4), at(4, 3), at(4, 5));
    await square(alice, 2, 4).click();
    await expect(square(alice, 2, 4).locator('.pawn')).toHaveAttribute('title', 'Alice');
    await expect(square(alice, 3, 4).locator('.pawn')).toHaveAttribute('title', 'Bob');
  });

  test('with a wall, a third pawn or the edge behind, the pawn steps diagonally instead; walls and two pawns are never jumped', async ({ seat }) => {
    // A wall behind Bob: Alice may step to either side of him
    const wall = await start(seat);
    await wall.table.patch({ pawns: { 1: at(4, 4), 2: at(3, 4) }, walls: [hWall(2, 4)] });
    await expectHighlighted(wall.alice, at(3, 3), at(3, 5), at(5, 4), at(4, 3), at(4, 5));
    await square(wall.alice, 3, 5).click();
    await expect(square(wall.alice, 3, 5).locator('.pawn')).toHaveAttribute('title', 'Alice');

    // A wall on one side of Bob closes that diagonal
    const side = await start(seat);
    await side.table.patch({ pawns: { 1: at(4, 4), 2: at(3, 4) }, walls: [hWall(2, 4), vWall(3, 4)] });
    await expectHighlighted(side.alice, at(3, 3), at(5, 4), at(4, 3));

    // The board edge behind Bob
    const edge = await start(seat);
    await edge.table.patch({ pawns: { 1: at(1, 4), 2: at(0, 4) } });
    await expectHighlighted(edge.alice, at(0, 3), at(0, 5), at(2, 4), at(1, 3), at(1, 5));

    // A wall between the two pawns is never jumped
    const walled = await start(seat);
    await walled.table.patch({ pawns: { 1: at(4, 4), 2: at(3, 4) }, walls: [hWall(3, 4)] });
    await expectHighlighted(walled.alice, at(5, 4), at(4, 3), at(4, 5));

    // Two pawns in a row are never jumped: a step to either side of the first instead, and a pawn there blocks it
    const three = await start(seat, 3);
    await three.table.patch({ pawns: { 1: at(4, 4), 2: at(3, 4), 3: at(2, 4) } });
    await expectHighlighted(three.alice, at(3, 3), at(3, 5), at(5, 4), at(4, 3), at(4, 5));
    await three.table.patch({ pawns: { 1: at(4, 4), 2: at(3, 4), 3: at(3, 5) }, walls: [hWall(2, 4)] });
    await expectHighlighted(three.alice, at(3, 3), at(5, 4), at(4, 3), at(4, 5)); // Cara stands on the right diagonal
    await three.table.patch({ pawns: { 1: at(4, 4), 2: at(3, 4), 3: at(2, 4) }, walls: [vWall(2, 3, 3)] });
    await expectHighlighted(three.alice, at(3, 5), at(5, 4), at(4, 3), at(4, 5)); // a wall closes the left diagonal
  });

  test('walls block pawns but can never cut a player off from their goal', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // A wall over Alice's square stops her stepping up
    await table.patch({ walls: [hWall(7, 4)] });
    await expectHighlighted(alice, at(8, 3), at(8, 5));

    // Walls along row 7 leave only column 0 open; a vertical wall beside it would shut Alice in
    await table.patch({ walls: [hWall(7, 1), hWall(7, 3), hWall(7, 5), hWall(7, 7)] });
    await alice.getByRole('button', { name: 'Vertical Wall' }).click();
    await square(alice, 7, 0).hover();
    await expect(board(alice).locator('.wall-preview')).toHaveCount(0);
    await square(alice, 7, 0).click();
    await square(alice, 5, 5).hover();
    await expect(board(alice).locator('.wall-preview')).toHaveCount(1);
    await expect(board(alice).locator('.wall')).toHaveCount(4);
    await expect(wallsLeft(alice)).toHaveText('Walls left: Alice 10 · Bob 10');
    await turn(alice, 'Alice moves first');
  });

  test('the twenty walls are shared out equally: 10 each for two, 6 each for three, 5 each for four', async ({ seat }) => {
    const two = await start(seat, 2);
    await expect(wallsLeft(two.alice)).toHaveText('Walls left: Alice 10 · Bob 10');
    const three = await start(seat, 3);
    await expect(wallsLeft(three.alice)).toHaveText('Walls left: Alice 6 · Bob 6 · Cara 6');
    const four = await start(seat, 4);
    await expect(wallsLeft(four.alice)).toHaveText('Walls left: Alice 5 · Bob 5 · Cara 5 · Dan 5');
  });

  test('the first player to reach their opposite edge wins', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({ pawns: { 1: at(1, 2), 2: at(0, 6) } });
    await square(alice, 0, 2).click();
    await expect(bob.locator('.game-status')).toHaveText('Alice wins!');
    await turn(bob, 'Game Over');
    await expect(board(alice)).toHaveClass(/game-over/);
    await expect(alice.locator('.valid-move')).toHaveCount(0);
  });

  test('a player who leaves mid-game has their pawn removed, their walls kept and their turns skipped', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    await square(alice, 7, 4).click();
    await bob.getByRole('button', { name: 'Horizontal Wall' }).click();
    await square(bob, 3, 3).click();
    await turn(cara, "Cara's turn");
    await square(cara, 4, 1).click();
    await turn(alice, "Alice's turn");

    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(alice.locator('.game-status')).toHaveText('Bob was dismissed');
    await expect(pawn(alice, 'Bob')).toHaveCount(0);
    await expect(board(alice).locator('.wall')).toHaveCount(1);
    await expect(wallsLeft(alice)).toHaveText('Walls left: Alice 6 · Bob 5 (left) · Cara 6');

    await square(alice, 6, 4).click();
    await turn(cara, "Cara's turn");
    await square(cara, 4, 2).click();
    await turn(alice, "Alice's turn");
  });

  test('any player can ask to undo, and it is undone only if every player still in the game approves', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    await square(alice, 7, 4).click();
    await turn(bob, "Bob's turn");

    // Cara, who did not make the move, asks; Bob declines
    await cara.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Approve' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(cara.locator('.undo-vote')).toHaveCount(0);
    await expect(square(cara, 7, 4).locator('.pawn')).toHaveAttribute('title', 'Alice');

    await undo(cara, alice, bob);
    await expect(square(cara, 8, 4).locator('.pawn')).toHaveAttribute('title', 'Alice');
    await turn(cara, /Alice('s turn| moves first)/);
  });
});

test.describe('Quoridor controls', () => {
  test('with Color-blind symbols on, each pawn and Goals dot shows the shape of its color: blue square, red circle, green triangle, purple cross', async ({ seat }) => {
    const { alice, bob } = await start(seat, 4);
    await setPreference(alice, 'Color-blind symbols', true);
    const shapes = ['square', 'circle', 'triangle', 'cross'];
    for (const [index, name] of NAMES.entries()) {
      await expect(pawn(alice, name).locator(`.color-symbol-${shapes[index]}`)).toHaveCount(1);
      await expect(alice.locator(`.goal-dot.player${index + 1} .color-symbol-${shapes[index]}`)).toHaveCount(1);
    }
    await expect(alice.locator('.color-symbol')).toHaveCount(8);
    await expect(bob.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', false);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
  });

  test('click Move and then a valid square to move your pawn', async ({ seat }) => {
    const { alice } = await start(seat);
    await alice.getByRole('button', { name: 'Horizontal Wall' }).click();
    await alice.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Move', exact: true })).toHaveClass(/active/);
    await square(alice, 6, 4).click(); // not a valid square: nothing happens
    await expect(square(alice, 8, 4).locator('.pawn')).toHaveAttribute('title', 'Alice');
    await square(alice, 8, 3).click();
    await expect(square(alice, 8, 3).locator('.pawn')).toHaveAttribute('title', 'Alice');
  });

  test('click Horizontal Wall or Vertical Wall to place walls', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await alice.getByRole('button', { name: 'Horizontal Wall' }).click();
    await expect(alice.getByRole('button', { name: 'Horizontal Wall' })).toHaveClass(/active/);
    await square(alice, 2, 2).click();
    await expect(board(bob).locator('.wall.horizontal')).toHaveCount(1);

    await bob.getByRole('button', { name: 'Vertical Wall' }).click();
    await square(bob, 5, 5).click();
    await expect(board(alice).locator('.wall.vertical')).toHaveCount(1);
    await expect(wallsLeft(alice)).toHaveText('Walls left: Alice 9 · Bob 9');
  });

  test('valid moves, diagonal ones included, and wall placements are highlighted', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch({ pawns: { 1: at(4, 4), 2: at(3, 4) }, walls: [hWall(2, 4)] });
    await expectHighlighted(alice, at(3, 3), at(3, 5), at(5, 4), at(4, 3), at(4, 5));

    await alice.getByRole('button', { name: 'Horizontal Wall' }).click();
    await expectHighlighted(alice, at(3, 3), at(3, 5), at(5, 4), at(4, 3), at(4, 5)); // pawn moves stay marked
    await square(alice, 6, 1).hover();
    await expect(board(alice).locator('.wall-preview.horizontal')).toHaveCount(1);
    await square(alice, 2, 5).hover(); // would overlap the wall at 2,4
    await expect(board(alice).locator('.wall-preview')).toHaveCount(0);
    await alice.getByRole('button', { name: 'Vertical Wall' }).click();
    await square(alice, 6, 1).hover();
    await expect(board(alice).locator('.wall-preview.vertical')).toHaveCount(1);
  });

  test('the board is dimmed when it is not your turn, and its frame is colored by goal side', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(board(alice)).not.toHaveClass(/not-your-turn/);
    await expect(board(bob)).toHaveClass(/not-your-turn/);
    await expect(bob.locator('.valid-move')).toHaveCount(0);
    await expect(board(bob)).toHaveCSS('opacity', '0.7');

    const frame = bob.locator('.board-frame');
    await expect(frame).toHaveClass(/goal-edge1/);
    await expect(frame).toHaveClass(/goal-edge2/);
    await expect(frame).toHaveCSS('border-top-color', 'rgb(30, 136, 229)'); // Alice's blue on top
    await expect(frame).toHaveCSS('border-bottom-color', 'rgb(229, 57, 53)'); // Bob's red at the bottom
  });

  test('FAQ at the top of the page covers moving, placing walls and the rules', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How do I move?');
    await expect(faq).toContainText('How do I place a wall?');
    await expect(faq).toContainText('How do I win?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });

  test('clicking Undo asks everyone still in the game to approve', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    await square(alice, 7, 4).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(cara.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(alice.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
  });
});
