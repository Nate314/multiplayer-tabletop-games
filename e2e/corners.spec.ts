import type { Locator, Page } from '@playwright/test';
import { dismiss, expect, headerButton, inHouseRules, leave, openFaq, setPreference, test, undo, type Seat } from './fixtures.ts';
import { PIECES, TRIANGLE_STARTS, boardCells, cellKey, corners, edgeTouch, orientations, transformed, type Cell } from '../games/corners/geometry.ts';

// One test per rule, control and difference in games/corners/README.md. Seat 1 is Alice, seat 2 Bob, seat 3 Cara.
// Squares starts: Blue 0,0, Yellow 19,0, Red 19,19, Green 0,19. With two players Alice has Blue and Red, Bob Yellow and Green.

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];
const STARTS = ['0,0,0', '19,0,0', '19,19,0', '0,19,0'];
const MONO = 0;
const DOMINO = 1;
// A piece with 8 orientations, so a turn and a flip each change it
const SKEW = PIECES.squares.findIndex(shape => shape.length === 5 && orientations('squares', shape).length === 8);
// A piece whose first orientation covers the cell 0,0 but whose next turn does not, so turning it at the corner drops the preview
const covers00 = (shape: Cell[]) => shape.some(c => c[0] === 0 && c[1] === 0);
const DROPPER = PIECES.squares.findIndex(shape => {
  const first = orientations('squares', shape)[0];
  return covers00(first) && !covers00(transformed('squares', first, 'rotate'));
});
// The straight piece of 5, which fits at a corner both ways
const STRAIGHT = PIECES.squares.findIndex(shape => shape.length === 5 && (shape.every(c => c[0] === 0) || shape.every(c => c[1] === 0)));

async function start(seat: Seat, players: number, options: { board?: 'triangles'; touch?: boolean } = {}) {
  const { board, touch } = options;
  const table = await seat('corners', NAMES.slice(0, players), { touch, ...(board ? { houseRules: { board } } : {}) });
  return { table, pages: table.pages };
}

const board = (page: Page) => page.locator('svg.corners-board');
const cell = (page: Page, key: string) => board(page).locator(`g[data-cell="${key}"]`);
const fill = (page: Page, color?: number) => board(page).locator(color === undefined ? 'g.corners-fill:not(.corners-preview)' : `g.corners-fill:not(.corners-preview).corners-c${color}`);
const spots = (page: Page) => board(page).locator('g.corners-spot');
const preview = (page: Page) => board(page).locator('g.corners-preview');
const turn = (page: Page, text: string) => expect(page.locator('.corners-turn')).toContainText(text);
const status = (page: Page) => page.locator('.corners-status');
const totals = (page: Page) => page.locator('.corners-totals');
const colorRow = (page: Page, color: string) => page.locator('.corners-color-row', { hasText: new RegExp(`^${color}:`) });
const tray = (page: Page) => page.getByRole('region', { name: 'Your pieces' });
const piece = (page: Page, id: number) => tray(page).getByRole('button', { name: new RegExp(`^Piece of \\d+ (square|triangle)s? \\(${id}\\)$`) });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const standing = (page: Page, index: number) => gameOver(page).locator('.game-over-standings li').nth(index);

// A mouse click places the piece once the hover has shown it there, so hover first and wait for the preview
async function clickSpot(page: Page, spot: Locator) {
  await spot.hover();
  await expect(preview(page).first()).toBeVisible();
  await spot.click();
}
// Picks piece `id` and places it on the outlined spot `at`
async function place(page: Page, id: number, at: string) {
  await piece(page, id).click();
  await clickSpot(page, cell(page, at));
}
// Picks piece `id` and places it on its first outlined spot
async function placeAnywhere(page: Page, id: number) {
  await piece(page, id).click();
  await clickSpot(page, spots(page).first());
}
// The data-cell keys of `locator`, sorted
const keys = (locator: Locator) => locator.evaluateAll(gs => gs.map(g => g.getAttribute('data-cell') ?? '').sort());
// The drawn shape of tray piece `id`, which changes whenever it turns or flips
const drawn = (page: Page, id: number) => piece(page, id).locator('polygon').evaluateAll(ps => ps.map(p => p.getAttribute('points')).join('|'));

// A crafted position: Blue has played every piece but `left` (its one cell is 10,10), and the other colors have no
// start left to cover, so placing `left` ends the game. Alice is to place Blue.
const lastPiece = (left: number) => ({
  used: { 0: PIECES.squares.map((_, id) => id).filter(id => id !== left), 1: [], 2: [], 3: [] },
  placed: [{ color: 0, piece: 5, cells: [[10, 10, 0], [19, 0, 0], [19, 19, 0], [0, 19, 0]] }],
  turnColor: 0, currentPlayer: 1, lastMove: null
});

test.describe('Corners rules', () => {
  test('Squares is the standard Board and Triangles is offered', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, 2);
    await expect(board(alice)).toHaveClass(/corners-squares/);
    await expect(board(alice)).toHaveAccessibleName('Corners board, squares');
    await expect(board(alice).locator('g[data-cell]')).toHaveCount(400);
    await inHouseRules(alice, async dialog => {
      const rule = dialog.getByLabel('Board', { exact: true });
      await expect(rule).toHaveValue('squares');
      await expect(rule.locator('option')).toHaveText(['Squares', 'Triangles']);
    });
  });

  test('two players alternate two colors each', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2);
    await turn(alice, 'Alice places Blue');
    await expect(tray(bob)).toHaveCount(0);
    await place(alice, MONO, STARTS[0]);
    await turn(bob, 'Bob places Yellow');
    await place(bob, MONO, STARTS[1]);
    await turn(alice, 'Alice places Red');
    await placeAnywhere(alice, DOMINO);
    await turn(bob, 'Bob places Green');
    await placeAnywhere(bob, DOMINO);
    await turn(alice, 'Alice places Blue');
    for (const [index, color] of ['Blue', 'Yellow', 'Red', 'Green'].entries()) {
      await expect(colorRow(alice, color)).toContainText(index % 2 === 0 ? 'Alice' : 'Bob');
    }
    await expect(fill(alice, 2)).toHaveCount(2);
    await expect(fill(alice, 3)).toHaveCount(2);
    await expect(totals(bob)).toHaveText('Scores: Alice -175 · Bob -175');
  });

  test('three players rotate the shared color and its score shows for nobody', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    await place(alice, MONO, STARTS[0]);
    await place(bob, MONO, STARTS[1]);
    await place(cara, MONO, STARTS[2]);
    await turn(alice, 'Alice places Green (shared)');
    await expect(colorRow(bob, 'Green')).toContainText('shared');
    await place(alice, MONO, STARTS[3]);
    await expect(colorRow(bob, 'Green').locator('.corners-score')).toHaveText('-88');
    await expect(totals(bob)).toHaveText('Scores: Alice -88 · Bob -88 · Cara -88');

    await placeAnywhere(alice, DOMINO);
    await placeAnywhere(bob, DOMINO);
    await placeAnywhere(cara, DOMINO);
    await turn(cara, 'Bob places Green (shared)');
    await expect(tray(cara)).toHaveCount(0);
    await placeAnywhere(bob, DOMINO);
    await expect(colorRow(cara, 'Green').locator('.corners-score')).toHaveText('-86');
    await expect(totals(cara)).toHaveText('Scores: Alice -86 · Bob -86 · Cara -86');
    await turn(alice, 'Alice places Blue');
  });

  test('four players each play one color', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat, 4);
    for (const [index, name] of ['Alice', 'Bob', 'Cara', 'Dan'].entries()) {
      await turn(dan, `${name} places ${['Blue', 'Yellow', 'Red', 'Green'][index]}`);
      await place([alice, bob, cara, dan][index], MONO, STARTS[index]);
    }
    await turn(alice, 'Alice places Blue');
    await expect(totals(dan)).toHaveText('Scores: Alice -88 · Bob -88 · Cara -88 · Dan -88');
    for (const [index, color] of ['Blue', 'Yellow', 'Red', 'Green'].entries()) {
      await expect(colorRow(dan, color)).toContainText(NAMES[index]);
      await expect(colorRow(dan, color)).not.toContainText('shared');
    }
  });

  test('a first piece must cover the corner, so one off it is not placed', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, 2);
    await piece(alice, DOMINO).click();
    expect((await keys(spots(alice))).every(spot => spot.split(',').slice(0, 2).every(n => Number(n) <= 1))).toBe(true);
    await cell(alice, '10,10,0').click();
    await expect(preview(alice)).toHaveCount(0);
    await expect(button(alice, 'Place')).toBeDisabled();
    await expect(fill(alice)).toHaveCount(0);
    await turn(alice, 'Alice places Blue');
  });

  test('clicking the picked piece again puts it back, and there is no Pass button', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, 2);
    await piece(alice, DOMINO).click();
    await expect(piece(alice, DOMINO)).toHaveAttribute('aria-pressed', 'true');
    await piece(alice, DOMINO).click();
    await expect(piece(alice, DOMINO)).toHaveAttribute('aria-pressed', 'false');
    await expect(button(alice, 'Place')).toBeVisible();
    await expect(alice.getByRole('button', { name: /pass/i })).toHaveCount(0);
  });

  test('a side touch of the same color is refused and a corner touch is placed', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2);
    await place(alice, MONO, STARTS[0]);
    await place(bob, MONO, STARTS[1]);
    await placeAnywhere(alice, DOMINO);
    await placeAnywhere(bob, DOMINO);
    await piece(alice, DOMINO).click();
    expect(await keys(spots(alice))).not.toContain('1,0,0');
    await cell(alice, '1,0,0').click(); // beside Blue's square, along a side
    await expect(preview(alice)).toHaveCount(0);
    await expect(fill(alice, 0)).toHaveCount(1);
    await clickSpot(alice, cell(alice, '1,1,0')); // diagonal to it
    await expect(fill(alice, 0)).toHaveCount(3);
    await expect(cell(alice, '1,1,0')).toHaveClass(/corners-c0/);
  });

  test('Turn left, Turn right and Flip change the preview, and so do Q, E and F', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, 2);
    await expect(button(alice, 'Turn left')).toBeDisabled();
    await piece(alice, SKEW).click();
    const first = await drawn(alice, SKEW);
    await button(alice, 'Turn right').click();
    const right = await drawn(alice, SKEW);
    expect(right).not.toBe(first);
    await button(alice, 'Turn left').click();
    expect(await drawn(alice, SKEW)).toBe(first);
    await button(alice, 'Flip').click();
    const flipped = await drawn(alice, SKEW);
    expect(flipped).not.toBe(first);
    await button(alice, 'Flip').click();
    expect(await drawn(alice, SKEW)).toBe(first);

    await alice.keyboard.press('e');
    expect(await drawn(alice, SKEW)).toBe(right);
    await alice.keyboard.press('q');
    expect(await drawn(alice, SKEW)).toBe(first);
    await alice.keyboard.press('f');
    expect(await drawn(alice, SKEW)).toBe(flipped);
    await alice.keyboard.press('Escape');
    await expect(piece(alice, SKEW)).toHaveAttribute('aria-pressed', 'false');

    // On the board the preview follows: the straight piece lies one way, then the other
    await piece(alice, STRAIGHT).click();
    await cell(alice, '0,0,0').hover();
    await expect(preview(alice)).toHaveCount(5);
    const lying = await keys(preview(alice));
    await alice.keyboard.press('e');
    await expect(preview(alice)).toHaveCount(5);
    expect(await keys(preview(alice))).not.toEqual(lying);
    await button(alice, 'Turn left').click();
    expect(await keys(preview(alice))).toEqual(lying);
  });

  test('turning keeps the preview where the piece still fits and drops it where it does not', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, 2);
    expect(DROPPER).toBeGreaterThanOrEqual(0);
    await piece(alice, STRAIGHT).click();
    await cell(alice, '0,0,0').hover();
    await expect(preview(alice)).toHaveCount(5);
    await button(alice, 'Turn right').click();
    await expect(preview(alice)).toHaveCount(5); // it fits at the corner turned either way
    await piece(alice, STRAIGHT).click();

    await piece(alice, DROPPER).click();
    await cell(alice, '0,0,0').hover();
    await expect(preview(alice).first()).toBeVisible();
    await button(alice, 'Turn right').click();
    await expect(preview(alice)).toHaveCount(0);
    await expect(button(alice, 'Place')).toBeDisabled();
    await expect(fill(alice)).toHaveCount(0);
  });

  test('the places a piece can go are outlined', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2);
    await expect(spots(alice)).toHaveCount(0);
    await piece(alice, MONO).click();
    await expect(spots(alice)).toHaveCount(1);
    await expect(spots(alice)).toHaveAttribute('data-cell', STARTS[0]);
    await expect(spots(alice)).toHaveAttribute('role', 'button');
    await expect(spots(bob)).toHaveCount(0);
    await clickSpot(alice, spots(alice));
    await expect(spots(alice)).toHaveCount(0);
    await place(bob, MONO, STARTS[1]);
    await placeAnywhere(alice, DOMINO);
    await placeAnywhere(bob, DOMINO);
    await piece(alice, DOMINO).click();
    await expect(spots(alice).first()).toBeVisible();
    expect(await keys(spots(alice))).toContain('1,1,0');
  });

  test('a click places the piece and Place places the piece that is showing', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2);
    await piece(alice, DOMINO).click();
    await cell(alice, '0,0,0').hover();
    await expect(preview(alice)).toHaveCount(2);
    await expect(fill(alice)).toHaveCount(0);
    await button(alice, 'Place').click();
    await expect(fill(bob, 0)).toHaveCount(2);
    await expect(piece(alice, DOMINO)).toHaveCount(0);
    await expect(status(bob)).toContainText('Alice placed a piece in Blue');
    await place(bob, MONO, STARTS[1]);
    await expect(fill(alice, 1)).toHaveCount(1);
  });

  test('on a phone a tap previews the piece and a second tap places it', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2, { touch: true });
    await piece(alice, DOMINO).tap();
    await cell(alice, '10,10,0').tap(); // not a legal place
    await expect(preview(alice)).toHaveCount(0);
    await cell(alice, '0,0,0').tap();
    await expect(preview(alice)).toHaveCount(2);
    await expect(fill(alice)).toHaveCount(0);
    await cell(alice, '0,0,0').tap();
    await expect(fill(bob, 0)).toHaveCount(2);
    await expect(preview(alice)).toHaveCount(0);
    await turn(alice, 'Bob places Yellow');
  });

  test('a tie for the top score is a shared win', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, 2);
    const all = PIECES.squares.map((_, id) => id);
    const finished = [...all.slice(1), MONO]; // every piece, the single square last
    await table.patch({
      used: { 0: all.filter(id => id !== MONO), 1: finished, 2: finished, 3: finished },
      placed: [{ color: 0, piece: 5, cells: [[10, 10, 0]] }],
      turnColor: 0, currentPlayer: 1, lastMove: null
    });
    await place(alice, MONO, '9,9,0');
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toContainText('Alice and Bob win');
      await expect(standing(page, 0)).toContainText('1st');
      await expect(standing(page, 1)).toContainText('1st');
      await expect(standing(page, 0)).toContainText('40 points');
      await expect(standing(page, 1)).toContainText('40 points');
    }
  });

  test('a color with no legal place is skipped and its status line says so', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, 2);
    // Yellow's one square sits in its corner with its only diagonal taken by Red
    await table.patch({
      used: { 0: [MONO], 1: [MONO], 2: [MONO], 3: [] },
      placed: [
        { color: 0, piece: MONO, cells: [[0, 0, 0]] },
        { color: 1, piece: MONO, cells: [[19, 0, 0]] },
        { color: 2, piece: MONO, cells: [[18, 1, 0]] }
      ],
      turnColor: 0, currentPlayer: 1
    });
    await placeAnywhere(alice, DOMINO);
    for (const page of [alice, bob]) {
      await expect(status(page)).toHaveText('Alice placed a piece in Blue. Yellow cannot place any more');
      await expect(colorRow(page, 'Yellow')).toContainText('(out)');
      await turn(page, 'Alice places Red');
    }
  });

  test('the game ends when nobody can place, and the last piece adds 15, and 5 more for the single square', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, 2);
    await table.patch(lastPiece(MONO));
    await place(alice, MONO, '9,9,0');
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toContainText('Alice wins');
      await expect(standing(page, 0)).toContainText('Alice');
      await expect(standing(page, 0)).toContainText('-69 points'); // Blue 20, Red -89
      await expect(standing(page, 1)).toContainText('-178 points');
    }
  });

  test('placing the last piece, when it is not the single square, scores 15', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat, 2);
    await table.patch(lastPiece(DOMINO));
    await piece(alice, DOMINO).click();
    await clickSpot(alice, cell(alice, '9,9,0'));
    await expect(standing(alice, 0)).toContainText('-74 points'); // Blue 15, Red -89
  });
});

test.describe('Corners on Triangles', () => {
  test('the board has 486 cells and six start markers, and a first piece must cover one', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2, { board: 'triangles' });
    await expect(board(alice)).toHaveClass(/corners-triangles/);
    await expect(board(alice).locator('g[data-cell]')).toHaveCount(486);
    await expect(board(alice).locator('circle.corners-start')).toHaveCount(6);
    const starts = TRIANGLE_STARTS.map(cellKey).sort();
    expect(await keys(board(alice).locator('g[data-cell]:has(circle.corners-start)'))).toEqual(starts);

    // A single triangle points up or down; each way fits the starts that point that way, and turning it swaps them
    await piece(alice, MONO).click();
    const up = await keys(spots(alice));
    expect(up).toHaveLength(3);
    await button(alice, 'Turn right').click();
    expect([...up, ...await keys(spots(alice))].sort()).toEqual(starts);
    await button(alice, 'Turn right').click();
    await cell(alice, '0,0,0').click();
    await expect(fill(alice)).toHaveCount(0);
    await clickSpot(alice, cell(alice, up[0]));
    await expect(fill(bob, 0)).toHaveCount(1);
    await piece(bob, MONO).click();
    expect(await keys(spots(bob))).toEqual(up.slice(1)); // Yellow takes any start not yet covered
  });

  test('a corner touching the middle of a straight side of the same color is placed', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat, 2, { board: 'triangles' });
    // Three triangles in a row around one point make a straight side there; a fourth cell touches only that point
    const point = corners('triangles', [0, 0, 0])[0];
    const ring = boardCells('triangles').filter(c => corners('triangles', c).includes(point));
    expect(ring).toHaveLength(6);
    const a = ring[0];
    const b = ring.find(c => edgeTouch('triangles', a, c))!;
    const c = ring.find(x => edgeTouch('triangles', b, x) && cellKey(x) !== cellKey(a))!;
    const row = [a, b, c];
    const target = ring.find(x => !row.some(r => cellKey(r) === cellKey(x) || edgeTouch('triangles', r, x)))!;
    await table.patch({
      used: { 0: [2], 1: [], 2: [], 3: [] },
      placed: [{ color: 0, piece: 2, cells: row }],
      turnColor: 0, currentPlayer: 1
    });
    await piece(alice, MONO).click();
    if (!(await keys(spots(alice))).includes(cellKey(target))) await button(alice, 'Turn right').click();
    await clickSpot(alice, cell(alice, cellKey(target)));
    await expect(cell(alice, cellKey(target))).toHaveClass(/corners-c0/);
    await expect(fill(alice, 0)).toHaveCount(4);
  });

  test('the Triangles board uses four colors at every player count', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, 3, { board: 'triangles' });
    await expect(alice.locator('.corners-color-row')).toHaveCount(4);
    await expect(colorRow(alice, 'Green')).toContainText('shared');
    await expect(piece(alice, 21)).toBeVisible(); // 22 shapes per color
  });
});

test.describe('Corners table controls', () => {
  test('Undo by vote takes back a placement', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2);
    await place(alice, MONO, STARTS[0]);
    await expect(fill(bob)).toHaveCount(1);
    await undo(alice, bob);
    await expect(fill(alice)).toHaveCount(0);
    await expect(fill(bob)).toHaveCount(0);
    await turn(alice, 'Alice places Blue');
    await expect(piece(alice, MONO)).toBeVisible();
  });

  test('History steps through the placements', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2);
    await place(alice, MONO, STARTS[0]);
    await place(bob, MONO, STARTS[1]);
    await (await headerButton(alice, 'History')).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-move')).toContainText('Bob placed a piece of 1 square in Yellow');
    await expect(history.locator('g.corners-last')).toHaveCount(1);
    await expect(history.locator('g.corners-fill')).toHaveCount(2);
    await history.getByRole('slider', { name: 'Step' }).press('ArrowLeft');
    await expect(history.locator('.history-move')).toContainText('Alice placed a piece of 1 square in Blue');
    await expect(history.locator('g.corners-fill')).toHaveCount(1);
  });

  test('a dismissed player\'s colors stop', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    await place(alice, MONO, STARTS[0]);
    await turn(cara, 'Bob places Yellow');
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(colorRow(alice, 'Yellow')).toContainText('(out)');
    await turn(cara, 'Cara places Red');
    await place(cara, MONO, STARTS[2]);
    await turn(alice, 'Alice places Green (shared)');
    await place(alice, MONO, STARTS[3]);
    await turn(cara, 'Alice places Blue');
    await placeAnywhere(alice, DOMINO);
    await placeAnywhere(cara, DOMINO);
    await turn(alice, 'Cara places Green (shared)'); // the shared color now goes to the other player left
    await placeAnywhere(cara, DOMINO);
    await expect(fill(alice, 3)).toHaveCount(3);
    await expect(fill(alice, 1)).toHaveCount(0);
  });

  test('Color-blind symbols show a shape on each color', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat, 2);
    await place(alice, MONO, STARTS[0]);
    await place(bob, MONO, STARTS[1]);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    await expect(cell(alice, STARTS[0]).locator('.color-symbol-square')).toHaveCount(1);
    await expect(cell(alice, STARTS[1]).locator('.color-symbol-star')).toHaveCount(1);
    for (const [color, shape] of [['Blue', 'square'], ['Yellow', 'star'], ['Red', 'circle'], ['Green', 'triangle']]) {
      await expect(colorRow(alice, color).locator(`.color-symbol-${shape}`)).toHaveCount(1);
    }
    await expect(bob.locator('.color-symbol')).toHaveCount(0);
  });

  test('Rules at the top of the page opens the rules', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, 2);
    await (await headerButton(alice, 'Rules')).click();
    await expect(alice.getByRole('dialog', { name: / rules$/ })).toBeVisible();
    await alice.keyboard.press('Escape');
    await expect(alice.getByRole('dialog', { name: / rules$/ })).toHaveCount(0);
  });

  test('FAQ at the top of the page covers the colors, placing and scoring', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, 2);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Who plays which color?');
    await expect(faq).toContainText('How do I place a piece?');
    await expect(faq).toContainText('How is it scored?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
