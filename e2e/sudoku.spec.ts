import type { Page } from '@playwright/test';
import {
  agreeToHouseRules, dismiss, expect, inHouseRules, joinGame, leave, newPlayer, openFaq, setHouseRules, tableScreen, test, watch,
  type Seat, type Table
} from './fixtures.ts';
import type { GameState } from '../games/sudoku/types.ts';

// One test per rule, control and difference in games/sudoku/README.md. Each test patches in one fixed solved grid
// (Wikipedia's example) with only a few cells left open, so a test fills them by hand. Cells are numbered 0 to 80,
// row-major from the top left, as the server stores them.

const SOLUTION = [...'534678912672195348198342567859761423426853791713924856961537284287419635345286179'].map(Number);
const emptyBoard = () => ({ entries: Array(81).fill(0), by: Array(81).fill(null) });

// The fixed puzzle with `open` cells blank; a Race gets one empty board per seat
async function setPuzzle(table: Table, open: number[], raceSeats: number[] = []) {
  await table.patch({
    givens: SOLUTION.map((digit, cell) => (open.includes(cell) ? 0 : digit)),
    solution: SOLUTION,
    board: emptyBoard(),
    raceBoards: Object.fromEntries(raceSeats.map(seat => [seat, emptyBoard()])),
    notes: {}, ownMoves: {}, raceWrong: {}, lastMove: null
  });
}

const cell = (page: Page, index: number) => page.locator(`[data-cell="${index}"]`);
const pad = (page: Page, digit: number) => page.getByRole('group', { name: 'Digits' }).getByRole('button', { name: String(digit), exact: true });
const status = (page: Page) => page.locator('.game-status');
const mode = (page: Page) => page.locator('.sudoku-mode');
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const standings = (page: Page) => gameOver(page).locator('.game-over-standings li');
const progress = (page: Page) => page.getByRole('list', { name: 'Race progress' }).locator('li');
const picker = (page: Page) => page.getByRole('group', { name: 'Boards' });
const pick = (page: Page, name: string) => picker(page).getByRole('button', { name: new RegExp(`^${name} `) });
const label = (index: number, shown: string) => `Row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}, ${shown}`;

// Selects `index` and clicks `digit` on the pad
async function enter(page: Page, index: number, digit: number) {
  await cell(page, index).click();
  await pad(page, digit).click();
}

async function expectCell(page: Page, index: number, shown: string) {
  await expect(cell(page, index)).toHaveAttribute('aria-label', label(index, shown));
}

async function solo(seat: Seat, open: number[]) {
  const table = await seat('sudoku', ['Alice']);
  await setPuzzle(table, open);
  return { table, alice: table.pages[0] };
}

async function together(seat: Seat, open: number[]) {
  const table = await seat('sudoku', ['Alice', 'Bob']);
  await setPuzzle(table, open);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

async function race(seat: Seat, open: number[]) {
  const table = await seat('sudoku', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  await setHouseRules(alice, 'sudoku', { mode: 'race' });
  await agreeToHouseRules(alice, bob);
  await setPuzzle(table, open, [1, 2]);
  await expect(mode(bob)).toHaveText('Race, Medium');
  return { table, alice, bob };
}

test.describe('Sudoku rules', () => {
  test('Solo: a player alone gets Solo and solves the puzzle', async ({ seat }) => {
    const { alice } = await solo(seat, [0, 1]);
    await expect(mode(alice)).toHaveText('Solo, Medium');
    await expect(cell(alice, 2)).toBeDisabled(); // a given
    await enter(alice, 0, 5);
    await expectCell(alice, 0, '5');
    await enter(alice, 1, 3);
    await expect(status(alice)).toHaveText('Solved!');
    await expect(standings(alice)).toHaveText(['1st Alice (you) Solved']);
  });

  test('Solo: Show mistakes marks a wrong entry only while on', async ({ seat }) => {
    const { alice } = await solo(seat, [0, 1]);
    await enter(alice, 0, 1);
    await expectCell(alice, 0, '1');
    const toggle = alice.getByRole('button', { name: 'Show mistakes' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expectCell(alice, 0, '1, wrong');
    await expect(cell(alice, 0)).toHaveClass(/wrong/);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expectCell(alice, 0, '1');
  });

  test('Solo: Undo takes back the last entry and the pencil marks made since', async ({ seat }) => {
    const { alice } = await solo(seat, [0, 1, 2]);
    await enter(alice, 0, 5);
    await alice.getByRole('button', { name: 'Pencil' }).click();
    await enter(alice, 1, 7);
    await expect(cell(alice, 1).locator('.notes')).toHaveText('7');
    await alice.getByRole('button', { name: 'Undo', exact: true }).click();
    await expectCell(alice, 0, 'empty');
    await expect(cell(alice, 1).locator('.notes')).toHaveCount(0);
  });

  test('Together: both players fill one board and share the win', async ({ seat }) => {
    const { alice, bob } = await together(seat, [0, 1, 2]);
    await expect(mode(alice)).toHaveText('Together, Medium');
    await enter(alice, 0, 5);
    await expectCell(bob, 0, '5');
    // Nobody holds a turn, so neither tab claims one
    for (const page of [alice, bob]) await expect(page).toHaveTitle('Sudoku · 2 players');
    await enter(bob, 1, 3);
    await expectCell(alice, 1, '3');
    await enter(alice, 2, 4);
    for (const page of [alice, bob]) await expect(status(page)).toHaveText('Solved together!');
    await expect(standings(bob)).toHaveText(['1st Alice 2 squares', '1st Bob (you) 1 square']);
  });

  test('Together: entries made at the same moment are both kept', async ({ seat }) => {
    const { alice, bob } = await together(seat, [0, 1, 2]);
    await Promise.all([enter(alice, 0, 5), enter(bob, 1, 3)]);
    for (const page of [alice, bob]) {
      await expectCell(page, 0, '5');
      await expectCell(page, 1, '3');
      await expect(page.locator('.game-status-error')).toHaveCount(0);
    }
  });

  test('Together: a wrong entry is marked for both players', async ({ seat }) => {
    const { alice, bob } = await together(seat, [0, 1, 2]);
    await enter(alice, 0, 1);
    for (const page of [alice, bob]) await expectCell(page, 0, '1, wrong');
  });

  test('Together: a correct entry is locked; anyone may replace or erase a wrong one', async ({ seat }) => {
    const { alice, bob } = await together(seat, [0, 1, 2]);
    await enter(alice, 0, 1);
    await enter(bob, 0, 2); // Bob replaces Alice's wrong entry
    await expectCell(alice, 0, '2, wrong');
    await alice.getByRole('button', { name: 'Erase' }).click(); // and Alice erases Bob's
    await expectCell(bob, 0, 'empty');

    await enter(bob, 0, 5);
    await expectCell(alice, 0, '5');
    // A locked square offers no digit and no Erase, to its owner or anyone else
    for (const page of [alice, bob]) {
      await expect(pad(page, 1)).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Erase' })).toBeDisabled();
    }
    await expectCell(alice, 0, '5');
  });

  test('Together: Undo my last move takes back only my entry', async ({ seat }) => {
    const { alice, bob } = await together(seat, [0, 1, 2]);
    await enter(alice, 0, 5);
    await enter(bob, 1, 3);
    await expectCell(alice, 1, '3');
    await alice.getByRole('button', { name: 'Undo my last move' }).click();
    for (const page of [alice, bob]) {
      await expectCell(page, 0, 'empty');
      await expectCell(page, 1, '3');
    }
    await expect(alice.getByRole('button', { name: 'Undo my last move' })).toBeDisabled();
    await expect(bob.getByRole('button', { name: 'Undo my last move' })).toBeEnabled();
  });

  test('Race: you see only your own board and the others\' percentages', async ({ seat }) => {
    const { alice, bob } = await race(seat, [0, 1, 2]);
    await enter(alice, 0, 1); // wrong, still counted as filled
    await expect(progress(bob)).toHaveText('Alice 33%');
    await expectCell(bob, 0, 'empty');
    await expect(picker(bob)).toHaveCount(0); // no other board to pick during play
    await expect(progress(alice)).toHaveText('Bob 0%');
    await expectCell(alice, 0, '1'); // a Race marks nothing wrong
    await expect(alice.getByRole('button', { name: 'Show mistakes' })).toHaveCount(0);
  });

  test('Race: a full wrong board tells only its owner', async ({ seat }) => {
    const { alice, bob } = await race(seat, [0, 1]);
    await enter(alice, 0, 1);
    await enter(alice, 1, 3);
    await expect(alice.getByRole('status').filter({ hasText: 'Your board is full, but something is wrong' })).toBeVisible();
    await expect(progress(bob)).toHaveText('Alice 100%');
    await expect(bob.getByText('Your board is full')).toHaveCount(0);
    await enter(alice, 0, 5);
    await expect(status(bob)).toHaveText('Alice finished first!');
  });

  test('Race: the first correct board wins', async ({ seat }) => {
    const { alice, bob } = await race(seat, [0, 1]);
    await enter(bob, 0, 5);
    await enter(alice, 0, 5);
    await enter(alice, 1, 3);
    for (const page of [alice, bob]) await expect(status(page)).toHaveText('Alice finished first!');
    await expect(standings(bob)).toHaveText(['1st Alice Solved', '2nd Bob (you) 50% correct']);

    // Once it is over, every board can be seen, and the winning cell is outlined only on the winner's board
    await gameOver(bob).getByRole('button', { name: 'See the table' }).click();
    await expect(pick(bob, 'Bob')).toHaveAttribute('aria-pressed', 'true');
    await expectCell(bob, 1, 'empty');
    await expect(bob.locator('.cell.last-move')).toHaveCount(0);
    await pick(bob, 'Alice').click();
    await expect(pick(bob, 'Alice')).toHaveAttribute('aria-pressed', 'true');
    await expectCell(bob, 1, '3');
    await expect(cell(bob, 1)).toHaveClass(/last-move/);
    // The picker wraps at phone width without scrolling the page sideways
    await bob.setViewportSize({ width: 320, height: 640 });
    await expect(picker(bob)).toBeVisible();
    expect(await bob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('History of a Race shows progress until the final step', async ({ seat }) => {
    const { alice, bob } = await race(seat, [0, 1]);
    await enter(alice, 0, 5);
    await enter(bob, 0, 5);
    await enter(alice, 1, 3);
    await expect(gameOver(bob)).toBeVisible();
    await gameOver(bob).getByRole('button', { name: 'See the table' }).click();
    await bob.getByRole('button', { name: 'History' }).click();
    const dialog = bob.getByRole('dialog', { name: 'History' });
    await expect(dialog.locator('.history-move')).toContainText('Alice finished first!');
    await expect(dialog.locator('[data-cell="0"]')).toHaveAttribute('aria-label', label(0, '5'));
    await dialog.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(dialog.locator('.history-move')).toContainText('Alice wrote a digit');
    await expect(dialog.locator('[data-cell="0"]')).toHaveAttribute('aria-label', label(0, 'empty'));
    await expect(dialog.getByRole('list', { name: 'Race progress' }).locator('li')).toHaveText(['Alice 50%', 'Bob 0%']);
  });

  test('the solution never reaches a browser before the end', async ({ seat, browser, server }) => {
    test.slow(); // two hand-made joins and a History load
    const table = await seat('sudoku', []);
    const frames: string[] = [];
    const pages: Page[] = [];
    for (const name of ['Alice', 'Bob']) {
      const page = await newPlayer(browser, server);
      page.on('websocket', socket => socket.on('framereceived', ({ payload }) => frames.push(String(payload))));
      await joinGame(page, 'sudoku', table.gameId, name);
      pages.push(page);
    }
    const [alice, bob] = pages;
    for (const page of pages) await inHouseRules(page, dialog => expect(dialog.locator('.house-rules-list li')).toHaveCount(2));
    await agreeToHouseRules(alice, bob);
    const { givens, solution } = await table.state<GameState>();
    const open = givens.flatMap((given, at) => (given ? [] : [at]));
    const [first, second, ...rest] = open;
    // Every open cell but two filled in by the test, then Alice fills one more by hand
    const entries = solution.map((digit, at) => (rest.includes(at) ? digit : 0));
    await table.patch({ board: { entries, by: entries.map(digit => (digit ? 1 : null)) } });
    await enter(alice, first, solution[first]);
    await expectCell(bob, first, String(solution[first]));
    await expectCell(bob, second, 'empty');

    const response = bob.waitForResponse(/\/api\/history\//);
    await bob.getByRole('button', { name: 'History' }).click();
    const body = await (await response).text();
    await expect(bob.getByRole('dialog', { name: 'History' }).locator('.history-slider')).toBeVisible();

    const secret = JSON.stringify(solution);
    expect(frames.length).toBeGreaterThan(0);
    expect(body.length).toBeGreaterThan(0);
    expect(frames.filter(frame => frame.includes(secret))).toEqual([]);
    expect(body.includes(secret)).toBe(false);

    // The check would see it: the solution arrives once the last cell ends the game
    await bob.getByRole('dialog', { name: 'History' }).getByRole('button', { name: 'Close' }).click();
    await enter(bob, second, solution[second]);
    await expect.poll(() => frames.some(frame => frame.includes(secret))).toBe(true);
    for (const page of pages) await page.context().close();
  });

  test('pencil marks show only to their owner', async ({ seat }) => {
    const { alice, bob } = await together(seat, [0, 1, 2]);
    const pencil = alice.getByRole('button', { name: 'Pencil' });
    await pencil.click();
    await expect(pencil).toHaveAttribute('aria-pressed', 'true');
    await enter(alice, 0, 2);
    await pad(alice, 7).click();
    await expect(cell(alice, 0).locator('.notes')).toHaveText('27');
    await expectCell(alice, 0, 'empty, notes 2 7');
    await pad(alice, 2).click(); // a second press removes the mark
    await expect(cell(alice, 0).locator('.notes')).toHaveText('7');
    await enter(bob, 1, 3);
    await expectCell(alice, 1, '3');
    await expect(cell(bob, 0).locator('.notes')).toHaveCount(0);

    // A note on a square holding an entry is ignored, so none shows once the entry is erased
    await enter(bob, 2, 1);
    await expectCell(alice, 2, '1, wrong');
    await enter(alice, 2, 6);
    await bob.getByRole('button', { name: 'Erase' }).click();
    await expectCell(alice, 2, 'empty');

    await cell(alice, 0).click();
    await pencil.click();
    await pad(alice, 5).click(); // writing a digit clears your marks there
    await expectCell(alice, 0, '5');
    await expect(cell(alice, 0).locator('.notes')).toHaveCount(0);
  });

  test('difficulty and mode are house rules', async ({ seat }) => {
    const medium = await seat('sudoku', ['Alice']);
    const mediumGivens = (await medium.state<GameState>()).givens.filter(Boolean).length;
    expect([30, 31]).toContain(mediumGivens);

    const hard = await seat('sudoku', ['Alice'], { houseRules: { difficulty: 'hard' } });
    await expect(mode(hard.pages[0])).toHaveText('Solo, Hard');
    expect((await hard.state<GameState>()).givens.filter(Boolean).length).toBeLessThan(mediumGivens);

    const two = await seat('sudoku', ['Alice', 'Bob']);
    await inHouseRules(two.pages[0], async dialog => {
      await expect(dialog.getByLabel('Mode', { exact: true }).locator('option')).toHaveText(['Together', 'Race']);
    });
  });

  test('the last player keeps playing after the other is dismissed', async ({ seat }) => {
    const { alice, bob } = await together(seat, [0, 1]);
    await enter(bob, 1, 3);
    await expectCell(alice, 1, '3');
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(alice.locator('.player-list li', { hasText: 'Bob' })).toContainText('(left)');
    await expectCell(alice, 1, '3'); // Bob's entries stay
    await expect(status(alice)).not.toHaveText(/over/);
    await enter(alice, 0, 5);
    await expect(status(alice)).toHaveText('Solved together!');
  });

  test('a spectator sees every Race board; a table screen none', async ({ seat, browser, server }) => {
    const { table, alice, bob } = await race(seat, [0, 1, 2]);
    const dana = await watch(browser, server, 'sudoku', table.gameId, 'Dana');
    const tv = await tableScreen(table);
    await enter(alice, 0, 5);
    await expectCell(dana, 0, '5'); // the last mover's board, Alice's
    await enter(bob, 1, 3);
    await expect(picker(dana).getByRole('button')).toHaveText(['Alice 33%', 'Bob 33%']);
    await pick(dana, 'Alice').click();
    await expect(pick(dana, 'Alice')).toHaveAttribute('aria-pressed', 'true');
    await expectCell(dana, 0, '5');
    await expectCell(dana, 1, 'empty');
    await pick(dana, 'Bob').click();
    await expect(pick(dana, 'Bob')).toHaveAttribute('aria-pressed', 'true');
    await expectCell(dana, 1, '3');
    await expectCell(dana, 0, 'empty');
    await expect(progress(dana)).toHaveText(['Alice 33%', 'Bob 33%']);
    await expect(picker(tv)).toHaveCount(0);
    await expect(progress(tv)).toHaveText(['Alice 33%', 'Bob 33%']);
    await expectCell(tv, 0, 'empty');
    await expectCell(tv, 1, 'empty');
  });
});

test.describe('Sudoku controls', () => {
  test('keys enter, erase and move', async ({ seat }) => {
    const { alice } = await solo(seat, [0, 1, 3, 9]);
    await cell(alice, 0).click();
    await alice.keyboard.press('5');
    await expectCell(alice, 0, '5');
    await alice.keyboard.press('Backspace');
    await expectCell(alice, 0, 'empty');
    await alice.keyboard.press('ArrowRight');
    await expect(cell(alice, 1)).toHaveAttribute('aria-pressed', 'true');
    await alice.keyboard.press('ArrowRight'); // over the given in cell 2
    await expect(cell(alice, 3)).toHaveAttribute('aria-pressed', 'true');
    await alice.keyboard.press('6');
    await expectCell(alice, 3, '6');
    await alice.keyboard.press('Delete');
    await expectCell(alice, 3, 'empty');
    await cell(alice, 0).click();
    await alice.keyboard.press('ArrowDown');
    await expect(cell(alice, 9)).toHaveAttribute('aria-pressed', 'true');
    await alice.keyboard.press('n');
    await expect(alice.getByRole('button', { name: 'Pencil' })).toHaveAttribute('aria-pressed', 'true');
    await alice.keyboard.press('6');
    await expect(cell(alice, 9).locator('.notes')).toHaveText('6');
    await alice.keyboard.press('N');
    await alice.keyboard.press('6');
    await expectCell(alice, 9, '6');
    await alice.keyboard.press('0');
    await expectCell(alice, 9, 'empty');
  });

  test('phone layout', async ({ seat }) => {
    const table = await seat('sudoku', ['Alice'], { touch: true });
    await setPuzzle(table, [0, 80]);
    const [alice] = table.pages;
    await cell(alice, 80).tap();
    await pad(alice, 9).tap();
    await expectCell(alice, 80, '9');
    const width = await alice.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(width).toBeLessThanOrEqual(0);
    const grid = (await alice.locator('.sudoku-grid').boundingBox())!;
    expect(grid.x).toBeGreaterThanOrEqual(0);
    expect(grid.x + grid.width).toBeLessThanOrEqual(alice.viewportSize()!.width);

    // At the narrowest phone, all nine pencil marks are readable and fit inside their square
    await alice.setViewportSize({ width: 320, height: 640 });
    await cell(alice, 0).tap();
    await alice.getByRole('button', { name: 'Pencil' }).tap();
    for (let digit = 1; digit <= 9; digit++) await pad(alice, digit).tap();
    await expectCell(alice, 0, 'empty, notes 1 2 3 4 5 6 7 8 9');
    // Each digit's inked box: the text box is taller than the glyph, so the glyph is placed from the font's baseline
    const marks = await cell(alice, 0).evaluate(square => {
      const box = square.getBoundingClientRect();
      const context = document.createElement('canvas').getContext('2d')!;
      return [...square.querySelectorAll('.notes span')].map(mark => {
        const range = document.createRange();
        range.selectNodeContents(mark);
        const text = range.getBoundingClientRect();
        const style = getComputedStyle(mark);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const metrics = context.measureText(mark.textContent!);
        const baseline = text.top + metrics.fontBoundingBoxAscent;
        const glyph = { left: text.left, right: text.right, top: baseline - metrics.actualBoundingBoxAscent, bottom: baseline + metrics.actualBoundingBoxDescent };
        const inside = glyph.left >= box.left && glyph.right <= box.right && glyph.top >= box.top && glyph.bottom <= box.bottom;
        return { size: parseFloat(style.fontSize), inside, ...glyph };
      });
    });
    expect(marks).toHaveLength(9);
    for (const mark of marks) expect(mark.inside).toBe(true);
    for (const at of [0, 1, 3, 4, 6, 7]) expect(marks[at].right).toBeLessThanOrEqual(marks[at + 1].left); // three to a row, apart
    for (const at of [0, 1, 2, 3, 4, 5]) expect(marks[at].bottom).toBeLessThanOrEqual(marks[at + 3].top); // and rows apart
    expect(Math.min(...marks.map(mark => mark.size))).toBeGreaterThanOrEqual(9);
    await alice.getByRole('button', { name: 'Pencil' }).tap();
    await cell(alice, 0).tap();
    await pad(alice, 5).tap();
    await expect(status(alice)).toHaveText('Solved!');
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await solo(seat, [0]);
    const dialog = await openFaq(alice);
    await expect(dialog.getByText('What are pencil marks?')).toBeVisible();
    await expect(dialog.getByText('What can I change in Together?')).toBeVisible();
  });
});
