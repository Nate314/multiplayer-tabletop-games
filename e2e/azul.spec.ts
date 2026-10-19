import type { Locator, Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat as SeatFixture } from './fixtures.ts';
import type { Color, FloorItem, PlayerBoard } from '../games/azul/types.ts';

// One test per rule and control in games/azul/README.md. Seat 1 (Alice) goes first. Two players get five factories,
// three get seven. Wall row r holds blue at column r, yellow at r + 1, red at r + 2 and so on, wrapping around.

const NAMES = ['Alice', 'Bob', 'Cara'];

async function start(seat: SeatFixture, players = 2) {
  const table = await seat('azul', NAMES.slice(0, players));
  return { table, pages: table.pages, alice: table.pages[0], bob: table.pages[1] };
}

type BoardSpec = { lines?: Record<number, [Color, number]>; wall?: [number, number][]; floor?: FloorItem[]; score?: number };

function boardOf({ lines = {}, wall = [], floor = [], score = 0 }: BoardSpec = {}): PlayerBoard {
  return {
    patternLines: Array.from({ length: 5 }, (_, line) => lines[line] ? { color: lines[line][0], count: lines[line][1] } : { color: null, count: 0 }),
    wall: Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => wall.some(([r, c]) => r === row && c === col))),
    floor,
    score
  };
}

// `count` factories, the first ones as given and the rest empty
const factoriesOf = (count: number, ...given: Color[][]) => Array.from({ length: count }, (_, index) => given[index] ?? []);

const factory = (page: Page, index: number) => page.locator('.factories .factory').nth(index);
const center = (page: Page) => page.locator('.table .center');
const take = (source: Locator, color: Color) => source.getByRole('button', { name: `Take ${color}` }).first().click();
const tilesOf = (source: Locator, color: Color) => source.getByRole('button', { name: `Take ${color}` });
const boardOfPlayer = (page: Page, name: string) => page.locator('.player-board').filter({ has: page.locator('.board-name', { hasText: name }) });
const mine = (page: Page) => page.locator('.board-mine');
const line = (board: Locator, number: number) => board.getByRole('button', { name: `Pattern line ${number}` });
const floorLine = (board: Locator) => board.getByRole('button', { name: 'Floor line' });
const wallTiles = (board: Locator) => board.locator('.wall .tile:not(.tile-faded)');
const turnMessage = (page: Page) => page.locator('.turn-message');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Round scoring' });

test.describe('Azul rules', () => {
  test('picking takes every tile of one color from a factory or the center, and the first from the center takes the marker', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({
      factories: factoriesOf(5, ['blue', 'blue', 'red', 'yellow'], ['black', 'black', 'black', 'black']),
      center: ['red']
    });
    await take(factory(alice, 0), 'blue');
    await line(mine(alice), 2).click();
    await expect(line(mine(alice), 2).locator('.tile-blue')).toHaveCount(2);
    await expect(factory(bob, 0).locator('.tile')).toHaveCount(0);
    await expect(tilesOf(center(bob), 'red')).toHaveCount(2); // the factory's other tiles moved to the center
    await expect(tilesOf(center(bob), 'yellow')).toHaveCount(1);
    await expect(center(bob).locator('.tile-first')).toHaveCount(1);

    await take(center(bob), 'red');
    await line(mine(bob), 3).click();
    await expect(line(mine(bob), 3).locator('.tile-red')).toHaveCount(2);
    await expect(floorLine(mine(bob)).locator('.tile-first')).toHaveCount(1);
    await expect(center(alice).locator('.tile-first')).toHaveCount(0);
    await expect(tilesOf(center(alice), 'red')).toHaveCount(0);

    // Alice takes from the center too, but the marker is gone
    await take(center(alice), 'yellow');
    await line(mine(alice), 1).click();
    await expect(floorLine(mine(alice)).locator('.tile')).toHaveCount(0);
  });

  test('placing: one color per line, line n holds n tiles, not a color already in that wall row, extras or all to the floor', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({
      factories: factoriesOf(5, ['blue', 'blue', 'blue', 'blue'], ['yellow', 'yellow', 'yellow', 'red'], ['black']),
      boards: { 1: boardOf({ wall: [[0, 0]], lines: { 1: ['red', 1] } }), 2: boardOf() }
    });
    await take(factory(alice, 0), 'blue');
    const board = mine(alice);
    await expect(line(board, 1)).toBeDisabled(); // wall row 1 already has blue
    await expect(line(board, 2)).toBeDisabled(); // line 2 holds red
    for (const number of [3, 4, 5]) await expect(line(board, number)).toHaveClass(/legal/);
    await expect(floorLine(board)).toHaveClass(/legal/);
    await line(board, 3).click();
    await expect(line(board, 3).locator('.tile-blue')).toHaveCount(3); // line 3 holds three
    await expect(floorLine(board).locator('.tile-blue')).toHaveCount(1); // the fourth did not fit

    await take(factory(bob, 1), 'yellow');
    await floorLine(mine(bob)).click(); // all of them on the floor line
    await expect(floorLine(mine(bob)).locator('.tile-yellow')).toHaveCount(3);
    await expect(mine(bob).locator('.pattern-line .tile')).toHaveCount(0);
  });

  test('end of round: full lines tile the wall and score, others stay, the floor costs points, never below zero, then everyone continues', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({
      factories: factoriesOf(5, ['red']),
      center: [],
      centerHasMarker: false,
      boards: {
        // Line 3's red goes to row 3, column 5, joining a row of 2 and a column of 2. Line 1's blue lands alone.
        1: boardOf({ score: 10, lines: { 0: ['blue', 1], 2: ['red', 2], 3: ['yellow', 2] }, wall: [[2, 3], [1, 4]], floor: ['black', 'black', 'black'] }),
        2: boardOf({ score: 1, floor: ['cyan', 'cyan', 'cyan', 'cyan', 'cyan', 'cyan', 'cyan'] })
      }
    });
    await take(factory(alice, 0), 'red');
    await line(mine(alice), 3).click();

    const dialog = scoring(alice);
    await expect(dialog.getByRole('heading')).toHaveText('Round 1 scoring');
    const aliceSummary = dialog.locator('.summary-seat', { hasText: 'Alice' });
    await expect(aliceSummary.locator('header')).toContainText('10 → 11 pts');
    await expect(aliceSummary.locator('li', { hasText: 'row of 2 + column of 2' })).toContainText('+4');
    await expect(aliceSummary.locator('li', { hasText: 'no neighbors' })).toContainText('+1');
    await expect(aliceSummary.locator('li', { hasText: 'floor line' })).toContainText('-4'); // 1 + 1 + 2
    const bobSummary = dialog.locator('.summary-seat', { hasText: 'Bob' });
    await expect(bobSummary.locator('header')).toContainText('1 → 0 pts');
    await expect(bobSummary.locator('li', { hasText: 'floor line' })).toContainText('(a score cannot drop below 0)');
    await expect(bobSummary.locator('li', { hasText: 'floor line' })).toContainText('-14'); // 1 + 1 + 2 + 2 + 2 + 3 + 3

    const board = boardOfPlayer(bob, 'Alice');
    await expect(wallTiles(board)).toHaveCount(4);
    await expect(line(board, 4).locator('.tile-yellow')).toHaveCount(2); // a line that is not full stays
    await expect(line(board, 3).locator('.tile')).toHaveCount(0);
    await expect(board.locator('.board-score')).toHaveText('11 pts');

    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog).toContainText('Waiting for Bob');
    await expect(turnMessage(alice)).toHaveText('Round 1 is over');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(turnMessage(alice)).toHaveText(/^Round 2: /);
    await expect(alice.locator('.factories .factory .tile')).toHaveCount(20);
  });

  test('whoever holds the first-player marker starts the next round', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({ factories: factoriesOf(5, ['red', 'blue']), center: [], centerHasMarker: true });
    await take(factory(alice, 0), 'red');
    await line(mine(alice), 1).click();
    await take(center(bob), 'blue'); // Bob takes the marker, and the table is empty
    await line(mine(bob), 1).click();
    for (const page of [alice, bob]) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(turnMessage(alice)).toHaveText("Round 2: Bob's turn");
    await expect(center(alice).locator('.tile-first')).toHaveCount(1);
  });

  test('the game ends after a round that completes a wall row, with row, column and color bonuses', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Row 1 lacks only its blue; column 1 and every blue but row 1's are already placed
    const wall: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
    await table.patch({ factories: factoriesOf(5, ['blue']), centerHasMarker: false, boards: { 1: boardOf({ wall }), 2: boardOf() } });
    await take(factory(alice, 0), 'blue');
    await line(mine(alice), 1).click();

    const dialog = scoring(bob);
    await expect(dialog.getByRole('heading')).toHaveText('Final scoring');
    await expect(dialog.locator('.summary-result')).toHaveText('Alice wins with 29 points!'); // 10 for the tile, 2 + 7 + 10 bonus
    const summary = dialog.locator('.summary-seat', { hasText: 'Alice' });
    await expect(summary.locator('li', { hasText: '1 complete row' })).toContainText('+2');
    await expect(summary.locator('li', { hasText: '1 complete column' })).toContainText('+7');
    await expect(summary.locator('li', { hasText: '1 complete color' })).toContainText('+10');
    await expect(turnMessage(bob)).toHaveText('Game over');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(boardOfPlayer(bob, 'Alice').locator('.board-name')).toContainText('★');
  });

  test('the highest score wins, and a tie goes to the player with more complete rows', async ({ seat }) => {
    const row: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4]]; // Alice's last blue completes row 1 for 5 + 2 points

    const higher = await start(seat);
    await higher.table.patch({ factories: factoriesOf(5, ['blue']), centerHasMarker: false, boards: { 1: boardOf({ wall: row }), 2: boardOf({ score: 20 }) } });
    await take(factory(higher.alice, 0), 'blue');
    await line(mine(higher.alice), 1).click();
    await expect(scoring(higher.alice).locator('.summary-result')).toHaveText('Bob wins with 20 points!');

    const tie = await start(seat);
    await tie.table.patch({ factories: factoriesOf(5, ['blue']), centerHasMarker: false, boards: { 1: boardOf({ wall: row }), 2: boardOf({ score: 7 }) } });
    await take(factory(tie.alice, 0), 'blue');
    await line(mine(tie.alice), 1).click();
    const dialog = scoring(tie.bob);
    await expect(dialog.locator('.summary-seat', { hasText: 'Bob' }).locator('header')).toContainText('7 → 7 pts');
    await expect(dialog.locator('.summary-result')).toHaveText('Alice wins with 7 points!');
  });

  test('a player who leaves keeps their board and has their turns skipped; the last player left wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await table.patch({ factories: factoriesOf(7, ['blue', 'blue'], ['red', 'red'], ['yellow', 'yellow'], ['black', 'black']) });
    await take(factory(alice, 0), 'blue');
    await line(mine(alice), 2).click();
    await take(factory(bob, 1), 'red');
    await line(mine(bob), 2).click();
    await expect(turnMessage(cara)).toHaveText("Round 1: Cara's turn");

    await leave(bob);
    await dismiss('Bob', alice, cara);
    const bobsBoard = boardOfPlayer(alice, 'Bob');
    await expect(bobsBoard).toHaveClass(/board-left/);
    await expect(bobsBoard.locator('.board-name')).toContainText('(left)');
    await expect(line(bobsBoard, 2).locator('.tile-red')).toHaveCount(2);

    await take(factory(cara, 2), 'yellow');
    await line(mine(cara), 2).click();
    await expect(turnMessage(alice)).toHaveText("Round 1: Alice's turn"); // Bob is skipped

    await leave(cara);
    await dismiss('Cara', alice);
    await expect(alice.locator('.game-status')).toHaveText('Alice wins! Everyone else left.');
  });

  test('any player can ask to undo, and it is undone only if every player still in the game approves', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    const before = await factory(alice, 0).locator('.tile').count();
    const color = (await factory(alice, 0).locator('.tile').first().getAttribute('title')) as Color;
    await take(factory(alice, 0), color);
    await line(mine(alice), 5).click();
    await expect(factory(cara, 0).locator('.tile')).toHaveCount(0);

    await bob.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Approve' }).click();
    await cara.getByRole('button', { name: 'Decline' }).click();
    await expect(bob.locator('.undo-vote')).toHaveCount(0);
    await expect(factory(bob, 0).locator('.tile')).toHaveCount(0);

    await undo(bob, alice, cara);
    await expect(factory(bob, 0).locator('.tile')).toHaveCount(before);
    await expect(mine(alice).locator('.pattern-line .tile')).toHaveCount(0);
    await expect(turnMessage(bob)).toContainText('Alice');
  });
});

test.describe('Azul controls', () => {
  test('clicking a tile picks up every tile of that color there, and clicking it again puts them back', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch({ factories: factoriesOf(5, ['red', 'blue', 'red', 'red'], ['black']) });
    await take(factory(alice, 0), 'red');
    await expect(factory(alice, 0).locator('.tile-selected')).toHaveCount(3);
    await expect(alice.locator('.hint')).toHaveText('Place the red tiles on a highlighted line, or on the floor');
    await tilesOf(factory(alice, 0), 'red').nth(1).click();
    await expect(alice.locator('.tile-selected')).toHaveCount(0);
    await expect(alice.locator('.hint')).toHaveText('Your turn: pick tiles from a factory or the center');
    await expect(mine(alice).locator('.legal')).toHaveCount(0);
  });

  test('your legal pattern lines and floor line are outlined, and clicking one places the tiles', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch({ factories: factoriesOf(5, ['red', 'red'], ['black']), boards: { 1: boardOf({ lines: { 0: ['blue', 1] } }), 2: boardOf() } });
    await take(factory(alice, 0), 'red');
    const board = mine(alice);
    await expect(line(board, 1)).not.toHaveClass(/legal/); // full already
    await expect(line(board, 2)).toHaveClass(/legal/);
    await expect(line(board, 2)).toHaveCSS('outline-style', 'solid');
    await expect(floorLine(board)).toHaveCSS('outline-style', 'solid');
    await expect(line(board, 1)).toHaveCSS('outline-style', 'none');
    await line(board, 2).click();
    await expect(line(board, 2).locator('.tile-red')).toHaveCount(2);
    await expect(board.locator('.legal')).toHaveCount(0);
  });

  test('the table is dimmed when it is not your turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.table')).not.toHaveClass(/table-waiting/);
    await expect(bob.locator('.table')).toHaveClass(/table-waiting/);
    await expect(bob.locator('.table')).toHaveCSS('opacity', '0.75');
    await expect(bob.locator('.tile-button').first()).toBeDisabled();
  });

  test('the source of the last move is outlined', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({ factories: factoriesOf(5, ['red', 'blue'], ['black']) });
    await expect(bob.locator('.last-source')).toHaveCount(0);
    await take(factory(alice, 1), 'black');
    await line(mine(alice), 1).click();
    await expect(factory(bob, 1)).toHaveClass(/last-source/);
    await expect(bob.locator('.last-source')).toHaveCount(1);
    await take(factory(bob, 0), 'red');
    await line(mine(bob), 1).click();
    await expect(factory(alice, 0)).toHaveClass(/last-source/);
    await expect(factory(alice, 1)).not.toHaveClass(/last-source/);
  });

  test('boards are shown in turn order starting with yours, so play passes to the board on the right', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    const order = (page: Page) => page.locator('.player-board .board-name');
    await expect(order(alice)).toHaveText(['Alice (you)', 'Bob', 'Cara']);
    await expect(order(bob)).toHaveText(['Bob (you)', 'Cara', 'Alice']);
    await expect(order(cara)).toHaveText(['Cara (you)', 'Alice', 'Bob']);
    await expect(alice.locator('.board-current .board-name')).toHaveText('Alice (you)');

    await take(factory(alice, 0), (await factory(alice, 0).locator('.tile').first().getAttribute('title')) as Color);
    await floorLine(mine(alice)).click();
    // The next player is the board just right of Alice's on her screen
    await expect(alice.locator('.player-board').nth(1)).toHaveClass(/board-current/);
    const [mineBox, nextBox] = [await mine(alice).boundingBox(), await alice.locator('.player-board').nth(1).boundingBox()];
    expect(nextBox!.x + nextBox!.width / 2).toBeGreaterThan(mineBox!.x + mineBox!.width / 2);
  });

  test('in the center, each color stays together on one row', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch({ center: ['red', 'blue', 'red', 'cyan', 'blue', 'red', 'red', 'yellow', 'blue'] });
    const groups = center(alice).locator('.center-group');
    await expect(groups).toHaveCount(4);
    for (const group of await groups.all()) {
      const colors = await group.locator('.tile').evaluateAll(tiles => tiles.map(tile => tile.getAttribute('title')));
      expect(new Set(colors).size).toBe(1);
      const tops = await group.locator('.tile').evaluateAll(tiles => tiles.map(tile => Math.round(tile.getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
    }
  });

  test('clicking Undo asks everyone to approve undoing the last turn', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    await take(factory(alice, 0), (await factory(alice, 0).locator('.tile').first().getAttribute('title')) as Color);
    await floorLine(mine(alice)).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(cara.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('after each round the scoring screen waits for everyone to click Continue', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({ factories: factoriesOf(5, ['red']), centerHasMarker: false });
    await take(factory(alice, 0), 'red');
    await line(mine(alice), 1).click();
    await expect(scoring(bob).locator('.summary-seat', { hasText: 'Alice' })).toContainText('no neighbors');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(bob)).toContainText('Waiting for Alice');
    await expect(scoring(alice).getByRole('button', { name: 'Continue' })).toBeVisible();
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(bob)).toHaveCount(0);
    await expect(turnMessage(bob)).toHaveText("Round 2: Alice's turn");
  });

  test('FAQ at the top of the page gives a short guide to the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How do I take tiles?');
    await expect(faq).toContainText('How is a wall tile scored?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
