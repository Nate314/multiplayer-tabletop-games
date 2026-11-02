import type { Page } from '@playwright/test';
import { dismiss, expect, inHouseRules, leave, openFaq, seeTable, test, undo, type Seat, type Table } from './fixtures.ts';
import { boardOf } from '../games/go/testBoards.ts';
import type { Seat as SeatNumber } from '../games/go/types.ts';

// One test per rule and control in games/go/README.md. Seat 1 (Alice) plays black and moves first, seat 2 (Bob) white.
// Points are named as on the board, 'D4': column letter (no I) then the row counted from the bottom.

async function start(seat: Seat, boardSize: 9 | 13 | 19 = 9) {
  const table = await seat('go', ['Alice', 'Bob'], boardSize === 19 ? {} : { houseRules: { boardSize } });
  return { table, alice: table.pages[0], bob: table.pages[1] };
}

// A 9x9 position in the rows of games/go/testBoards.ts ('X' black, 'O' white, '.' empty, top row first), already started
async function setUp(table: Table, rows: string[], currentPlayer: SeatNumber = 1) {
  await table.patch({
    board: boardOf(rows, 9), size: 9, started: true, currentPlayer, previousKey: null,
    passes: 0, captures: { black: 0, white: 0 }, lastMove: null, gameStatus: ''
  });
}

const point = (page: Page, name: string) => page.locator('.board-area .go-board').getByRole('button', { name: new RegExp(`^${name},`) });
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page, text: string) => expect(page.locator('.side-panel').getByText(text, { exact: true })).toBeVisible();
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const captures = (page: Page, name: string) => page.locator('.player-row', { hasText: name }).locator('.go-captures');
const totals = (page: Page) => page.locator('.go-count tr.go-total td');

// Black owns columns A to E and White F to J, with a dead white pair at B5 and B6 inside Black's side.
// With the pair dead: Black 9 stones and 36 points, 45; White 9 stones, 27 points and 7.5 komi, 43.5.
const COUNTED = [
  '....XO...',
  '....XO...',
  '....XO...',
  '.O..XO...',
  '.O..XO...',
  '....XO...',
  '....XO...',
  '....XO...',
  '....XO...'
];

async function passTwice(first: Page, second: Page) {
  await button(first, 'Pass').click();
  await button(second, 'Pass').click();
}

test.describe('Go rules', () => {
  test('Black moves first and the players alternate', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await turn(alice, 'Alice plays black and moves first. Joining closes after the first move.');
    await expect(alice.getByText('Alice (Black)')).toBeVisible();
    await expect(alice.getByText('Bob (White)')).toBeVisible();
    await point(alice, 'E5').click();
    await expect(point(bob, 'E5')).toHaveAccessibleName('E5, black, last move');
    await turn(bob, "Bob's turn");
    await point(alice, 'D4').click(); // not Alice's turn: nothing happens
    await expect(point(alice, 'D4')).toHaveAccessibleName('D4, empty');
    await point(bob, 'D4').click();
    await expect(point(alice, 'D4')).toHaveAccessibleName('D4, white, last move');
    await turn(alice, "Alice's turn");
  });

  test('a surrounded stone is captured and the capture count goes up', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, ['', '', '', '....X', '...XO', '....X']);
    await expect(captures(bob, 'Alice')).toHaveText('Captures: 0');
    await point(alice, 'F5').click();
    await expect(point(bob, 'E5')).toHaveAccessibleName('E5, empty');
    await expect(status(bob)).toHaveText('Alice played F5 and captured 1');
    await expect(captures(bob, 'Alice')).toHaveText('Captures: 1');
    await expect(captures(bob, 'Bob')).toHaveText('Captures: 0');
  });

  test('one stone captures two groups at once', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, ['.OX', 'OX', 'X']);
    await point(alice, 'A9').click();
    await expect(point(bob, 'B9')).toHaveAccessibleName('B9, empty');
    await expect(point(bob, 'A8')).toHaveAccessibleName('A8, empty');
    await expect(status(bob)).toHaveText('Alice played A9 and captured 2');
    await expect(captures(bob, 'Alice')).toHaveText('Captures: 2');
  });

  test('a stone with no liberties is allowed when it captures', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // A8 touches only white stones, but it takes the last liberty of the white stone on A9
    await setUp(table, ['OX', '.O', 'O']);
    await point(alice, 'A8').click();
    await expect(point(bob, 'A8')).toHaveAccessibleName('A8, black, last move');
    await expect(point(bob, 'A9')).toHaveAccessibleName('A9, empty');
    await turn(bob, "Bob's turn");
  });

  test('suicide is refused', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await setUp(table, ['.O', 'O']);
    await point(alice, 'A9').click();
    await expect(status(alice)).toHaveText('That would be suicide');
    await expect(point(alice, 'A9')).toHaveAccessibleName('A9, empty');
    await turn(alice, "Alice's turn");
  });

  test('retaking a ko at once is refused; after a move elsewhere it is allowed', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, ['', '', '', '...XO', '..XO.O', '...XO']);
    await point(alice, 'E5').click();
    await expect(point(bob, 'D5')).toHaveAccessibleName('D5, empty');
    await point(bob, 'D5').click();
    await expect(status(bob)).toHaveText('Ko: play elsewhere before retaking');
    await expect(point(bob, 'D5')).toHaveAccessibleName('D5, empty');
    await turn(bob, "Bob's turn");

    await point(bob, 'A1').click();
    await point(alice, 'J9').click();
    await point(bob, 'D5').click();
    await expect(point(alice, 'D5')).toHaveAccessibleName('D5, white, last move');
    await expect(point(alice, 'E5')).toHaveAccessibleName('E5, empty');
    await expect(status(alice)).toHaveText('Bob played D5 and captured 1');
  });

  test('the last move is marked', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await point(alice, 'E5').click();
    await expect(point(bob, 'E5')).toHaveAccessibleName('E5, black, last move');
    await expect(bob.locator('.go-last')).toHaveCount(1);
    await point(bob, 'D4').click();
    await expect(point(alice, 'D4')).toHaveAccessibleName('D4, white, last move');
    await expect(point(alice, 'E5')).toHaveAccessibleName('E5, black');
    await expect(alice.locator('.go-last')).toHaveCount(1);
  });

  test('board size 9x9, 13x13 and 19x19, 19x19 standard', async ({ seat }) => {
    const nine = await start(seat, 9);
    await expect(nine.alice.locator('.go-point')).toHaveCount(81);
    const thirteen = await start(seat, 13);
    await expect(thirteen.alice.locator('.go-point')).toHaveCount(169);
    const standard = await start(seat, 19);
    await expect(standard.alice.locator('.go-point')).toHaveCount(361);
    await inHouseRules(standard.bob, async dialog => {
      const size = dialog.getByLabel('Board size', { exact: true });
      await expect(size).toHaveValue('19');
      await expect(size.locator('option:checked')).toHaveText('19x19');
    });
  });

  test('two passes start marking; clicking a stone marks its group and the projected score updates', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, COUNTED);
    await button(alice, 'Pass').click();
    await expect(status(bob)).toHaveText('Alice passed');
    await turn(bob, "Bob's turn");
    await button(bob, 'Pass').click();
    await expect(status(alice)).toHaveText('Both passed. Click stones to mark them dead, then Agree');
    await turn(alice, 'Marking dead stones');
    await expect(alice.locator('.go-count caption')).toHaveText('Projected count');
    await expect(totals(alice)).toHaveText(['9', '45.5']);

    await point(alice, 'B5').click();
    await expect(point(bob, 'B5')).toHaveAccessibleName('B5, white, marked dead');
    await expect(point(bob, 'B6')).toHaveAccessibleName('B6, white, marked dead');
    await expect(totals(bob)).toHaveText(['45', '43.5']);

    await point(bob, 'B6').click(); // clicking again brings the group back
    await expect(point(alice, 'B5')).toHaveAccessibleName('B5, white');
    await expect(totals(alice)).toHaveText(['9', '45.5']);
  });

  test('a change to the marks clears the other player\'s agreement', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, COUNTED);
    await passTwice(alice, bob);
    await point(alice, 'B5').click();
    await expect(point(bob, 'B5')).toHaveAccessibleName('B5, white, marked dead');
    await button(alice, 'Agree').click();
    await expect(button(alice, 'Agreed')).toBeDisabled();
    await expect(bob.getByText('Waiting for Bob to agree')).toBeVisible();

    await point(bob, 'C5').click(); // an empty point changes nothing
    await point(bob, 'E1').click(); // marks the black wall
    await expect(status(alice)).toHaveText('Dead stones changed. Both players must agree again');
    await expect(button(alice, 'Agree')).toBeEnabled();
    await expect(alice.getByText('Waiting for Alice and Bob to agree')).toBeVisible();
  });

  test('when both agree the score is counted with komi 7.5 and the winner shown', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, COUNTED);
    await passTwice(alice, bob);
    await point(bob, 'B5').click();
    await expect(point(alice, 'B5')).toHaveAccessibleName('B5, white, marked dead');
    await button(alice, 'Agree').click();
    await expect(bob.getByText('Waiting for Bob to agree')).toBeVisible();
    await button(bob, 'Agree').click();
    await expect(status(alice)).toHaveText('Alice wins by 1.5 (Black 45, White 43.5)');
    await seeTable(bob);
    await expect(bob.locator('.go-count caption')).toHaveText('Final count');
    await expect(bob.locator('.go-count tbody td')).toHaveText(['9', '9', '36', '27', '0', '7.5', '45', '43.5']);
    await expect(point(bob, 'B5')).toHaveAccessibleName('B5, empty'); // dead stones leave the board
    await turn(bob, 'Game Over');
  });

  test('Resume play continues with the player who would have moved', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, COUNTED, 2);
    await passTwice(bob, alice); // Bob would move next
    await point(alice, 'B5').click();
    await button(bob, 'Agree').click();
    await button(alice, 'Resume play').click();
    await expect(status(bob)).toHaveText('Alice resumed play. Bob to move');
    await turn(bob, "Bob's turn");
    await expect(point(bob, 'B5')).toHaveAccessibleName('B5, white');
    await expect(bob.locator('.go-count')).toHaveCount(0);

    await button(bob, 'Pass').click(); // one pass does not end play again
    await turn(alice, "Alice's turn");
    await expect(button(alice, 'Pass')).toBeEnabled();
  });

  test('Resign then Confirm resign ends the game; Keep playing cancels; there is no Offer draw', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await point(alice, 'E5').click();
    await expect(button(alice, 'Offer draw')).toHaveCount(0);
    await button(alice, 'Resign').click(); // on Bob's turn
    await expect(button(alice, 'Confirm resign')).toBeVisible();
    await button(alice, 'Keep playing').click();
    await expect(button(alice, 'Confirm resign')).toHaveCount(0);
    await expect(button(alice, 'Resign')).toBeVisible();
    await turn(bob, "Bob's turn");

    await button(alice, 'Resign').click();
    await button(alice, 'Confirm resign').click();
    await expect(status(bob)).toHaveText('Alice resigned. Bob wins!');
  });

  test('undo by vote takes back the last stone', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await point(alice, 'E5').click();
    await expect(point(bob, 'E5')).toHaveAccessibleName('E5, black, last move');
    await undo(alice, bob);
    await expect(point(alice, 'E5')).toHaveAccessibleName('E5, empty');
    await turn(alice, "Alice's turn");
  });

  test('a player who leaves loses', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await point(alice, 'E5').click();
    await leave(bob);
    await expect(alice.getByText('Waiting for Bob to reconnect')).toBeVisible();
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });
});

test.describe('Go controls', () => {
  test('History shows each move and the counted end', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await point(alice, 'E5').click();
    await point(bob, 'D4').click();
    await passTwice(alice, bob);
    await button(alice, 'Agree').click();
    await button(bob, 'Agree').click();
    await expect(status(alice)).toHaveText('Bob wins by 7.5 (Black 1, White 8.5)');
    await seeTable(alice);
    await button(alice, 'History').click();
    const history = alice.getByRole('dialog', { name: 'History' });
    const step = history.locator('.history-move');
    const slider = history.getByRole('slider', { name: 'Step' });
    // The slider starts on the agreement that counted the game, with the final count beside the board
    await expect(step).toHaveText('Move 5 of 5: Counted: Black 1, White 8.5');
    await expect(history.locator('.go-count caption')).toHaveText('Final count');
    const steps = [
      'Move 4 of 5: Bob passed',
      'Move 3 of 5: Alice passed',
      'Move 2 of 5: Bob played D4',
      'Move 1 of 5: Alice played E5'
    ];
    for (const text of steps) {
      await slider.press('ArrowLeft');
      await expect(step).toHaveText(text);
    }
    await expect(history.getByRole('button', { name: 'E5, black, last move' })).toBeVisible();
    await expect(history.getByRole('button', { name: 'D4, empty' })).toBeVisible();
  });

  test('tapping a point at phone width places the stone there', async ({ seat }) => {
    const table = await seat('go', ['Alice', 'Bob'], { touch: true });
    const [alice, bob] = table.pages;
    await alice.setViewportSize({ width: 390, height: 844 });
    await expect(alice.locator('.go-point')).toHaveCount(361);
    // The square board's viewBox runs from -1 to 19 on each axis, so K10 (column 9, row 9) is where its lines cross
    const board = alice.locator('.board-area .go-board');
    await board.scrollIntoViewIfNeeded();
    const box = (await board.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    const side = Math.min(box.width, box.height);
    const unit = side / 20;
    const left = box.x + (box.width - side) / 2;
    const top = box.y + (box.height - side) / 2;
    await alice.touchscreen.tap(left + 10 * unit, top + 10 * unit);
    await expect(point(bob, 'K10')).toHaveAccessibleName('K10, black, last move');
    await expect(bob.locator('.go-stone:not(.go-ghost)')).toHaveCount(1); // the only stone; a ghost can follow a resting mouse
    // A near-corner point catches a scale error the center cannot: White taps T1 (column 18, row 18) on a phone-wide page
    await bob.setViewportSize({ width: 390, height: 844 });
    const bobBoard = bob.locator('.board-area .go-board');
    await bobBoard.scrollIntoViewIfNeeded();
    const bobBox = (await bobBoard.boundingBox())!;
    const bobSide = Math.min(bobBox.width, bobBox.height);
    const bobUnit = bobSide / 20;
    const bobLeft = bobBox.x + (bobBox.width - bobSide) / 2;
    const bobTop = bobBox.y + (bobBox.height - bobSide) / 2;
    await bob.touchscreen.tap(bobLeft + 19 * bobUnit, bobTop + 19 * bobUnit);
    await expect(point(alice, 'T1')).toHaveAccessibleName('T1, white, last move');
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('What is ko?');
    await expect(faq).toContainText('How do I mark dead stones?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
