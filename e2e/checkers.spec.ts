import type { Page } from '@playwright/test';
import { dismiss, drag, expect, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import type { Board } from '../games/checkers/types.ts';

// One test per rule and control in games/checkers/README.md. Seat 1 (Alice) plays Red from rows 5-7 and moves up the
// board (toward row 0); seat 2 (Bob) plays White from rows 0-2. Squares are named 'row,col' as the server stores them.

// 'r' is a red man and 'R' a red king; 'w' and 'W' the same for white
function boardOf(pieces: Record<string, string>): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [name, letter] of Object.entries(pieces)) {
    const [row, col] = name.split(',').map(Number);
    board[row][col] = { seat: letter.toLowerCase() === 'r' ? 1 : 2, king: letter === letter.toUpperCase() };
  }
  return board;
}

// Only the given pieces on the board, `toMove` to play, the game already started
async function setUp(table: Table, pieces: Record<string, string>, toMove = 1) {
  await table.patch({ board: boardOf(pieces), lastMove: null, currentPlayer: toMove, started: true });
}

const square = (page: Page, name: string) => page.locator(`[data-anim-key="square-${name.replace(',', '-')}"]`);
const piece = (page: Page, name: string) => square(page, name).locator('.piece');
const targets = (page: Page) => page.locator('.square.target');
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');

async function clicks(page: Page, ...names: string[]) {
  for (const name of names) await square(page, name).click();
}

async function start(seat: Seat) {
  const table = await seat('checkers', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

// A red man on 6,1 that must jump 5,2 and then may go on over 3,2 or 3,4; the red man on 6,7 could only step
const BRANCHING = { '6,1': 'r', '5,2': 'w', '3,2': 'w', '3,4': 'w', '6,7': 'r', '0,7': 'w' };

test.describe('Checkers rules', () => {
  test('each side starts with 12 men on the dark squares of the three rows nearest them', async ({ seat }) => {
    const { alice } = await start(seat);
    await expect(alice.getByLabel('Red man')).toHaveCount(12);
    await expect(alice.getByLabel('White man')).toHaveCount(12);
    await expect(alice.locator('.square.light .piece')).toHaveCount(0);
    for (const row of [0, 1, 2]) await expect(alice.locator(`[data-anim-key^="square-${row}-"] .piece.player2`)).toHaveCount(4);
    for (const row of [5, 6, 7]) await expect(alice.locator(`[data-anim-key^="square-${row}-"] .piece.player1`)).toHaveCount(4);
    await expect(alice.locator('[data-anim-key^="square-3-"] .piece, [data-anim-key^="square-4-"] .piece')).toHaveCount(0);
  });

  test('men move one square diagonally forward and kings one square diagonally either way', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await setUp(table, { '4,3': 'r', '0,7': 'w' });
    await square(alice, '4,3').click();
    await expect(targets(alice)).toHaveCount(2);
    await expect(square(alice, '3,2')).toHaveClass(/target/);
    await expect(square(alice, '3,4')).toHaveClass(/target/);
    await square(alice, '4,3').click();
    await expect(targets(alice)).toHaveCount(0);

    await setUp(table, { '4,3': 'R', '0,7': 'w' });
    await square(alice, '4,3').click();
    await expect(targets(alice)).toHaveCount(4);
    for (const name of ['3,2', '3,4', '5,2', '5,4']) await expect(square(alice, name)).toHaveClass(/target/);
  });

  test('a capture jumps an adjacent enemy piece onto the empty square beyond; men capture forward only, kings both ways', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, { '5,2': 'r', '4,3': 'w', '0,7': 'w' });
    await square(alice, '5,2').click();
    await expect(targets(alice)).toHaveCount(1);
    await square(alice, '3,4').click();
    await expect(piece(bob, '4,3')).toHaveCount(0);
    await expect(piece(bob, '3,4')).toHaveAttribute('aria-label', 'Red man');
    await expect(status(bob)).toHaveText('Alice captured a piece');

    // The white man behind the red man cannot be taken by it, so the red man just steps
    const back = await start(seat);
    await setUp(back.table, { '3,2': 'r', '4,3': 'w', '0,7': 'w' });
    await expect(back.alice.locator('.hint')).toHaveText('Click one of your pieces');
    await square(back.alice, '3,2').click();
    await expect(targets(back.alice)).toHaveCount(2);
    await expect(square(back.alice, '5,4')).not.toHaveClass(/target/);
    await square(back.alice, '3,2').click();

    // A king takes it backward
    await setUp(back.table, { '3,2': 'R', '4,3': 'w', '0,7': 'w' });
    await expect(back.alice.locator('.hint')).toHaveText('You must capture: click a glowing piece');
    await square(back.alice, '3,2').click();
    await expect(targets(back.alice)).toHaveCount(1);
    await square(back.alice, '5,4').click();
    await expect(piece(back.bob, '4,3')).toHaveCount(0);
  });

  test('capturing is mandatory, a piece that can jump again must keep jumping, and the player picks where jumps branch', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, BRANCHING);
    // The man that could only step cannot move
    await square(alice, '6,7').click();
    await expect(piece(alice, '6,7')).not.toHaveClass(/selected/);
    await expect(targets(alice)).toHaveCount(0);

    await square(alice, '6,1').click();
    await expect(targets(alice)).toHaveCount(1);
    await square(alice, '4,3').click();
    await expect(alice.locator('.hint')).toHaveText('Keep jumping: click the next landing square');
    await expect(targets(alice)).toHaveCount(2);
    await expect(square(alice, '2,1')).toHaveClass(/target/);
    await expect(square(alice, '2,5')).toHaveClass(/target/);
    // Nothing is sent until the jumps are done
    await expect(piece(bob, '5,2')).toHaveCount(1);

    await square(alice, '2,5').click();
    await expect(status(bob)).toHaveText('Alice captured 2 pieces');
    await expect(piece(bob, '2,5')).toHaveAttribute('aria-label', 'Red man');
    await expect(piece(bob, '5,2')).toHaveCount(0);
    await expect(piece(bob, '3,4')).toHaveCount(0);
    await expect(piece(bob, '3,2')).toHaveAttribute('aria-label', 'White man');
  });

  test('a man reaching the far row is crowned, and a man crowned by a jump ends the turn there', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, { '1,2': 'r', '0,7': 'w' });
    await clicks(alice, '1,2', '0,1');
    await expect(piece(bob, '0,1')).toHaveAttribute('aria-label', 'Red king');
    await expect(status(bob)).toHaveText('Alice moved and crowned a king');

    // As a king on 0,3 it could jump 1,4 next, but the turn ends
    const jump = await start(seat);
    await setUp(jump.table, { '2,1': 'r', '1,2': 'w', '1,4': 'w', '0,7': 'w' });
    await clicks(jump.alice, '2,1', '0,3');
    await expect(status(jump.bob)).toHaveText('Alice captured a piece and crowned a king');
    await expect(piece(jump.bob, '0,3')).toHaveAttribute('aria-label', 'Red king');
    await expect(piece(jump.bob, '1,4')).toHaveAttribute('aria-label', 'White man');
    await expect(turn(jump.bob)).toHaveText('Your turn');
  });

  test('you win by capturing all of the opponent\'s pieces or leaving them no legal move', async ({ seat }) => {
    const all = await start(seat);
    await setUp(all.table, { '5,2': 'r', '4,3': 'w' });
    await clicks(all.alice, '5,2', '3,4');
    await expect(status(all.bob)).toHaveText('Alice wins! Bob has no pieces left.');
    await expect(turn(all.bob)).toHaveText('Game Over');

    // Bob's only man is on Red's back row and cannot move forward
    const stuck = await start(seat);
    await setUp(stuck.table, { '5,4': 'r', '7,0': 'w' });
    await clicks(stuck.alice, '5,4', '4,3');
    await expect(status(stuck.bob)).toHaveText('Alice wins! Bob has no legal moves.');
  });

  test('a player may resign at any time, on either turn, and the opponent wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, '5,0', '4,1');
    await expect(turn(alice)).toHaveText("Bob's turn");
    await alice.getByRole('button', { name: 'Resign' }).click();
    await alice.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(bob)).toHaveText('Alice resigned. Bob wins!');
  });

  test('the game is drawn only by agreement, and an offer lapses when declined or when the opponent moves', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, '5,0', '4,1');
    // There is no other way to a draw
    await expect(alice.getByRole('button', { name: /claim/i })).toHaveCount(0);

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(status(alice)).toHaveText('Bob declined the draw');

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await clicks(bob, '2,1', '3,2');
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toHaveCount(0);
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();

    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Accept draw' }).click();
    await expect(status(alice)).toHaveText('Draw by agreement');
    await expect(turn(alice)).toHaveText('Game Over');
  });

  test('if a player is dismissed mid-game, the other player wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, '5,0', '4,1');
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo needs the other player\'s approval', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, '5,0', '4,1');
    await expect(piece(alice, '4,1')).toHaveCount(1);

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(piece(alice, '4,1')).toHaveCount(1);

    await undo(alice, bob);
    await expect(piece(alice, '5,0')).toHaveAttribute('aria-label', 'Red man');
    await expect(piece(alice, '4,1')).toHaveCount(0);
    await expect(turn(alice)).toHaveText('Your turn');
  });
});

test.describe('Checkers controls', () => {
  test('Player 1 plays Red and moves first, and each player sees their own pieces at the bottom', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(turn(alice)).toHaveText('You (Red) move first. Joining closes after the first move.');
    await expect(turn(bob)).toHaveText('Alice (Red) moves first. Joining closes after the first move.');
    // The second-to-last square drawn is on the bottom row
    await expect(alice.locator('.square').nth(62).locator('.piece')).toHaveAttribute('aria-label', 'Red man');
    await expect(bob.locator('.square').nth(62).locator('.piece')).toHaveAttribute('aria-label', 'White man');
  });

  test('on your turn, click one of your pieces and then a highlighted square to move there', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await square(alice, '5,0').click();
    await expect(piece(alice, '5,0')).toHaveClass(/selected/);
    await expect(targets(alice)).toHaveCount(1);
    await expect(square(alice, '4,1')).toHaveClass(/target/);
    await square(alice, '4,1').click();
    await expect(piece(bob, '4,1')).toHaveAttribute('aria-label', 'Red man');
    await expect(piece(bob, '5,0')).toHaveCount(0);
  });

  test('a multi-jump is clicked one landing at a time and sent at the end; clicking the piece starts over and another piece switches', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // A second red man on 6,5 can also capture, over 5,6
    await setUp(table, { ...BRANCHING, '6,5': 'r', '5,6': 'w' });
    await clicks(alice, '6,1', '4,3');
    await expect(square(alice, '4,3')).toHaveClass(/picked/);
    await expect(piece(bob, '6,1')).toHaveCount(1);

    // Start over
    await square(alice, '6,1').click();
    await expect(square(alice, '4,3')).not.toHaveClass(/picked/);
    await expect(targets(alice)).toHaveCount(1);
    await expect(square(alice, '4,3')).toHaveClass(/target/);

    // Choose the other piece
    await square(alice, '6,5').click();
    await expect(piece(alice, '6,5')).toHaveClass(/selected/);
    await expect(piece(alice, '6,1')).not.toHaveClass(/selected/);
    await expect(square(alice, '4,7')).toHaveClass(/target/);

    await clicks(alice, '6,1', '4,3', '2,1');
    await expect(piece(bob, '2,1')).toHaveAttribute('aria-label', 'Red man');
    await expect(status(bob)).toHaveText('Alice captured 2 pieces');
  });

  test('pieces that must capture glow orange', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await setUp(table, BRANCHING);
    await expect(alice.locator('.piece.must-capture')).toHaveCount(1);
    await expect(piece(alice, '6,1')).toHaveClass(/must-capture/);
    await expect(piece(alice, '6,7')).not.toHaveClass(/must-capture/);
    const glow = await piece(alice, '6,1').evaluate(element => getComputedStyle(element).outlineColor);
    expect(glow).toBe('rgb(255, 152, 0)');
  });

  test('the last move\'s squares are outlined in yellow and a captured piece\'s square is crossed', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, { '5,2': 'r', '4,3': 'w', '0,7': 'w' });
    await clicks(alice, '5,2', '3,4');
    await expect(bob.locator('.square.last-move')).toHaveCount(2);
    await expect(square(bob, '5,2')).toHaveClass(/last-move/);
    await expect(square(bob, '3,4')).toHaveClass(/last-move/);
    await expect(square(bob, '4,3')).toHaveClass(/last-captured/);
    const outline = await square(bob, '3,4').evaluate(element => getComputedStyle(element).boxShadow);
    expect(outline).toContain('rgb(255, 213, 79)');
    const cross = await square(bob, '4,3').evaluate(element => getComputedStyle(element).backgroundImage);
    expect(cross).toContain('linear-gradient');
  });

  test('the board is dimmed when it is not your turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.board')).not.toHaveClass(/dimmed/);
    await expect(bob.locator('.board')).toHaveClass(/dimmed/);
    await expect.poll(() => bob.locator('.board').evaluate(element => getComputedStyle(element).opacity)).toBe('0.75');
  });

  test('clicking Undo asks the opponent to undo the last turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, '5,0', '4,1');
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('Offer draw reads Draw offered until answered, and the opponent sees Accept draw and Decline', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, '5,0', '4,1');
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
    await clicks(alice, '5,0', '4,1');
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
    await expect(faq).toContainText('multi-jumps');
    await expect(faq).toContainText('glow orange');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Checkers drag and drop', () => {
  test('a man dragged onto a highlighted square moves, and a double jump continues from the first landing', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, BRANCHING);
    await drag(alice, piece(alice, '6,1'), square(alice, '4,3'));
    await expect(square(alice, '4,3')).toHaveClass(/picked/);
    await expect(targets(alice)).toHaveCount(2);
    await expect(square(alice, '2,1')).toHaveClass(/target/);
    await expect(square(alice, '2,5')).toHaveClass(/target/);
    await expect(piece(bob, '5,2')).toHaveCount(1);

    // The man still stands on its start square until the jumps are done; drag it again to the next landing
    await drag(alice, piece(alice, '6,1'), square(alice, '2,5'));
    await expect(status(bob)).toHaveText('Alice captured 2 pieces');
    await expect(piece(bob, '2,5')).toHaveAttribute('aria-label', 'Red man');
    await expect(piece(bob, '5,2')).toHaveCount(0);
    await expect(piece(bob, '3,4')).toHaveCount(0);
  });

  test('a man dropped on an unhighlighted square goes back', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const before = await table.state();
    await drag(alice, piece(alice, '5,0'), square(alice, '3,0'));
    await expect(alice.locator('.drag-ghost')).toHaveCount(0);
    await expect(piece(alice, '5,0')).toHaveAttribute('aria-label', 'Red man');
    await expect(alice.locator('.piece.selected')).toHaveCount(0);
    await expect(targets(alice)).toHaveCount(0);
    expect(await table.state()).toEqual(before);
  });
});
