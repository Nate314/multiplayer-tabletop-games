import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Table } from './fixtures.ts';
import { POINT_HOLES, holeKey } from '../games/chinesecheckers/board.ts';
import type { PointIndex, Seat as SeatNumber } from '../games/chinesecheckers/types.ts';

// One test per rule, control and difference in games/chinesecheckers/README.md. Seat 1 (Alice) is red and starts in
// point 0 at the bottom, seat 2 (Bob) blue. Holes are axial `q,r` keys: q to the right, r downward. The middle row
// r = 0 runs from -4,0 to 4,0, and point 3 (Alice's target) is the top point, r from -5 to -8.

type Holes = Record<string, SeatNumber>;

const hole = (page: Page, key: string) => page.locator(`[data-hole="${key}"]`);
const marbleAt = (page: Page, key: string) => page.locator(`[data-marble="${key}"]`);
const marbles = (page: Page, seat: SeatNumber) => page.locator(`.marble.player${seat}`);
const targets = (page: Page) => page.locator('.hole.target');
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const endMove = (page: Page) => page.getByRole('button', { name: 'End move' });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const keysOf = (point: PointIndex) => POINT_HOLES[point].map(holeKey);
const fill = (keys: string[], seat: SeatNumber): Holes => Object.fromEntries(keys.map(key => [key, seat]));

// A started game with these marbles and `current` to move. Waits until every open page draws them
async function craft(table: Table, holes: Holes, current: SeatNumber = 1) {
  await table.patch({ holes, currentPlayer: current, started: true, lastMove: null });
  for (const page of table.pages) {
    if (page.isClosed()) continue;
    await expect(page.locator('.marble')).toHaveCount(Object.keys(holes).length);
    for (const [key, seat] of Object.entries(holes)) await expect(marbleAt(page, key)).toHaveClass(new RegExp(`player${seat}`));
  }
}

// Clicks each hole in turn: the marble, then every landing
async function clickPath(page: Page, ...keys: string[]) {
  for (const key of keys) await hole(page, key).click();
}

async function expectStart(page: Page, starts: PointIndex[]) {
  for (const [index, point] of starts.entries()) {
    const seat = (index + 1) as SeatNumber;
    await expect(marbles(page, seat)).toHaveCount(10);
    for (const key of keysOf(point)) await expect(marbleAt(page, key)).toHaveClass(new RegExp(`player${seat}`));
  }
  await expect(page.locator('.marble')).toHaveCount(10 * starts.length);
}

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Fay'];

test.describe('Chinese Checkers seating', () => {
  test('two players start on opposite points', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    await expectStart(table.pages[0], [0, 3]);
    await expect(table.pages[0].locator('.hole')).toHaveCount(121);
  });

  test('three players start on alternating points', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 3));
    await expectStart(table.pages[0], [0, 2, 4]);
  });

  test('four players use two opposite pairs', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 4));
    await expectStart(table.pages[0], [0, 1, 3, 4]);
  });

  test('six players fill the star', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES);
    await expectStart(table.pages[0], [0, 1, 2, 3, 4, 5]);
  });

  test('five players cannot start', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 5));
    const [alice] = table.pages;
    await expect(status(alice)).toHaveText('Chinese Checkers needs 2, 3, 4 or 6 players');
    await expect(alice.locator('.marble')).toHaveCount(0);
    await hole(alice, '0,0').click();
    await expect(targets(alice)).toHaveCount(0);

    // Even with a marble placed, the first move is refused
    await table.patch({ holes: { '0,0': 1 }, currentPlayer: 1 });
    await expect(marbleAt(alice, '0,0')).toHaveCount(1);
    await clickPath(alice, '0,0', '1,0');
    await expect(status(alice)).toHaveText('Chinese Checkers needs 2, 3, 4 or 6 players');
    await expect(marbleAt(alice, '0,0')).toHaveCount(1);
    expect((await table.state<{ started: boolean }>()).started).toBe(false);
  });

  test('each player sees their own point at the bottom', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    for (const [index, page] of table.pages.entries()) {
      const board = (await page.locator('.board').boundingBox())!;
      const tops = await marbles(page, (index + 1) as SeatNumber).evaluateAll(list => list.map(marble => marble.getBoundingClientRect().top));
      expect(tops).toHaveLength(10);
      for (const top of tops) expect(top).toBeGreaterThan(board.y + board.height / 2);
    }
  });
});

test.describe('Chinese Checkers rules', () => {
  test('a marble steps to an adjacent hole', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    await craft(table, { '0,0': 1, '0,-4': 2 });
    await hole(alice, '0,0').click();
    await expect(targets(alice)).toHaveCount(6);
    await hole(alice, '1,0').click();
    for (const page of [alice, bob]) {
      await expect(marbleAt(page, '1,0')).toHaveClass(/player1/);
      await expect(marbleAt(page, '0,0')).toHaveCount(0);
      await expect(status(page)).toHaveText('Alice moved a marble');
    }
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(alice.locator('.board')).toHaveClass(/dimmed/);
    await expect(bob.locator('.board')).not.toHaveClass(/dimmed/);
    await expect(alice.locator('.last-move-line')).toHaveCount(1);
  });

  test('a hop goes over any one marble', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice] = table.pages;
    // Over Bob's marble, and over her own, but never over two in a row
    await craft(table, { '0,0': 1, '1,0': 2, '0,1': 1, '-1,0': 2, '-2,0': 2, '0,-4': 2 });
    await hole(alice, '0,0').click();
    await expect(hole(alice, '2,0')).toHaveClass(/target/);
    await expect(hole(alice, '0,2')).toHaveClass(/target/);
    await expect(hole(alice, '-3,0')).not.toHaveClass(/target/);
    await hole(alice, '0,2').click();
    await expect(status(alice)).toHaveText('Alice made 1 jump');
    await expect(marbleAt(alice, '0,2')).toHaveClass(/player1/);
  });

  test('a chain of hops ends with End move', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    await craft(table, { '-4,0': 1, '-3,0': 2, '-1,0': 2, '1,0': 2 });
    await clickPath(alice, '-4,0', '-2,0');
    await expect(endMove(alice)).toBeVisible();
    await hole(alice, '0,0').click();
    await expect(hole(alice, '2,0')).toHaveClass(/target/);
    await expect(targets(alice)).toHaveCount(1);
    await endMove(alice).click();
    for (const page of [alice, bob]) {
      await expect(marbleAt(page, '0,0')).toHaveClass(/player1/);
      await expect(status(page)).toHaveText('Alice made 2 jumps');
    }
    await expect(endMove(alice)).toHaveCount(0);
  });

  test('a chain stops by itself when no hop is left', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    await craft(table, { '-4,0': 1, '-3,0': 2, '-1,0': 2 });
    await clickPath(alice, '-4,0', '-2,0', '0,0');
    for (const page of [alice, bob]) {
      await expect(marbleAt(page, '0,0')).toHaveClass(/player1/);
      await expect(status(page)).toHaveText('Alice made 2 jumps');
    }
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('no marble is captured', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    await craft(table, { '-4,0': 1, '-3,0': 2, '-1,0': 2 });
    await clickPath(alice, '-4,0', '-2,0', '0,0');
    for (const page of [alice, bob]) {
      await expect(marbleAt(page, '0,0')).toHaveClass(/player1/);
      await expect(marbleAt(page, '-3,0')).toHaveClass(/player2/);
      await expect(marbleAt(page, '-1,0')).toHaveClass(/player2/);
      await expect(marbles(page, 2)).toHaveCount(2);
    }
  });

  test('a player with no move passes', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    // Bob's marble in the top tip is boxed in by Alice's: no step and no hop
    await craft(table, { '4,-8': 2, '3,-7': 1, '4,-7': 1, '2,-6': 1, '4,-6': 1, '0,0': 1 });
    await clickPath(alice, '0,0', '1,0');
    for (const page of [alice, bob]) await expect(status(page)).toHaveText('Alice moved a marble. Bob has no move and passes');
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('filling the opposite point wins and the rest are ranked by marbles home', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 3));
    const [alice, bob, cara] = table.pages;
    // Alice (point 0) fills point 3 but for 1,-5; Bob (point 2) has three marbles in point 5, Cara (point 4) one in point 1
    const top = keysOf(3).filter(key => key !== '1,-5');
    await craft(table, { ...fill(top, 1), '1,-4': 1, ...fill(keysOf(5).slice(0, 3), 2), [keysOf(1)[0]]: 3 });
    await clickPath(alice, '1,-4', '1,-5');
    for (const page of [alice, bob, cara]) {
      await expect(status(page)).toHaveText('Alice filled the far point and wins!');
      const standings = gameOver(page).locator('.game-over-standings li');
      await expect(standings).toHaveCount(3);
      await expect(standings.nth(0)).toContainText('Alice');
      await expect(standings.nth(0)).toContainText('10 of 10 marbles home');
      await expect(standings.nth(1)).toContainText('Bob');
      await expect(standings.nth(1)).toContainText('3 of 10 marbles home');
      await expect(standings.nth(2)).toContainText('Cara');
      await expect(standings.nth(2)).toContainText('1 of 10 marbles home');
    }
  });

  test('a player who leaves loses their marbles and play goes on', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 3));
    const [alice, bob, cara] = table.pages;
    await craft(table, { '-4,0': 1, '-3,0': 2, '-1,0': 2, '0,-4': 3 });
    // Alice is mid-chain over Bob's marbles when he leaves, so the chain is dropped
    await clickPath(alice, '-4,0', '-2,0');
    await expect(alice.locator('.path-line')).toHaveCount(1);
    await leave(bob);
    await dismiss('Bob', alice, cara);
    for (const page of [alice, cara]) {
      await expect(marbles(page, 2)).toHaveCount(0);
      await expect(page.locator('.player-list li', { hasText: 'Bob' })).toContainText('left');
    }
    await expect(alice.locator('.path-line')).toHaveCount(0);
    await expect(endMove(alice)).toHaveCount(0);

    // Bob's turn, next after Alice's, is skipped
    await clickPath(alice, '-4,0', '-3,0');
    await expect(marbleAt(cara, '-3,0')).toHaveClass(/player1/);
    await expect(turn(cara)).toHaveText('Your turn');

    await leave(cara);
    await dismiss('Cara', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('undo takes back a whole chain', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    await craft(table, { '-4,0': 1, '-3,0': 2, '-1,0': 2 });
    await clickPath(alice, '-4,0', '-2,0', '0,0');
    await expect(marbleAt(bob, '0,0')).toHaveClass(/player1/);
    await undo(alice, bob);
    for (const page of [alice, bob]) {
      await expect(marbleAt(page, '-4,0')).toHaveClass(/player1/);
      await expect(marbleAt(page, '0,0')).toHaveCount(0);
      await expect(marbleAt(page, '-2,0')).toHaveCount(0);
    }
    await expect(turn(alice)).toHaveText('Your turn');
  });
});

test.describe('Chinese Checkers controls', () => {
  test('clicking the marble again starts over', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice] = table.pages;
    await craft(table, { '-4,0': 1, '-3,0': 2, '-1,0': 2, '2,2': 1 });
    await expect(alice.locator('.marble.movable')).toHaveCount(2);
    await hole(alice, '-4,0').click();
    await expect(marbleAt(alice, '-4,0')).toHaveClass(/picked/);
    await hole(alice, '-4,0').click();
    await expect(alice.locator('.marble.picked')).toHaveCount(0);
    await expect(targets(alice)).toHaveCount(0);

    // Mid-chain, the picked marble starts the chain over
    await clickPath(alice, '-4,0', '-2,0');
    await expect(hole(alice, '0,0')).toHaveClass(/target/);
    await hole(alice, '-4,0').click();
    await expect(alice.locator('.path-line')).toHaveCount(0);
    await expect(marbleAt(alice, '-4,0')).toHaveClass(/picked/);
    await expect(hole(alice, '-2,0')).toHaveClass(/target/);

    // Another of her marbles is picked instead
    await hole(alice, '2,2').click();
    await expect(marbleAt(alice, '2,2')).toHaveClass(/picked/);
    await expect(marbleAt(alice, '-4,0')).not.toHaveClass(/picked/);
    await expect(targets(alice)).toHaveCount(6);
  });

  test('the path line follows the chain', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    await craft(table, { '-4,0': 1, '-3,0': 2, '-1,0': 2, '1,0': 2 });
    const points = async () => (await alice.locator('.path-line').getAttribute('points'))!.trim().split(/\s+/).length;
    await hole(alice, '-4,0').click();
    await expect(alice.locator('.path-line')).toHaveCount(0);
    await hole(alice, '-2,0').click();
    await expect.poll(points).toBe(2);
    await hole(alice, '0,0').click();
    await expect.poll(points).toBe(3);
    await endMove(alice).click();
    await expect(alice.locator('.path-line')).toHaveCount(0);
    for (const page of [alice, bob]) {
      await expect(page.locator('.last-move-line')).toHaveCount(1);
      expect((await page.locator('.last-move-line').getAttribute('points'))!.trim().split(/\s+/)).toHaveLength(3);
    }
  });

  test('History shows each move', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    await craft(table, { '0,0': 1, '4,-4': 2, '3,-4': 1, '1,-4': 1 });
    await clickPath(alice, '0,0', '1,0');
    await expect(turn(bob)).toHaveText('Your turn');
    await clickPath(bob, '4,-4', '2,-4', '0,-4');
    await expect(status(alice)).toContainText('Bob made 2 jumps');
    await alice.getByRole('button', { name: 'History' }).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-move')).toContainText('Bob made 2 jumps');
    await expect(history.locator('.last-move-line')).toHaveCount(1);
    await history.getByRole('slider', { name: 'Step' }).press('ArrowLeft');
    await expect(history.locator('.history-move')).toContainText('Alice moved a marble');
  });

  test('tapping works on a touch screen', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2), { touch: true });
    const [alice, bob] = table.pages;
    await craft(table, { '-4,0': 1, '-3,0': 2, '-1,0': 2, '1,0': 2 });
    await hole(alice, '-4,0').tap();
    await expect(marbleAt(alice, '-4,0')).toHaveClass(/picked/);
    await hole(alice, '-2,0').tap();
    await hole(alice, '0,0').tap();
    await endMove(alice).tap();
    await expect(marbleAt(bob, '0,0')).toHaveClass(/player1/);
    await expect(status(bob)).toHaveText('Alice made 2 jumps');
  });

  test('color-blind symbols show on marbles', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 3));
    const [alice] = table.pages;
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    await expect(marbles(alice, 1).locator('.color-symbol-circle')).toHaveCount(10);
    await expect(marbles(alice, 2).locator('.color-symbol-square')).toHaveCount(10);
    await expect(marbles(alice, 3).locator('.color-symbol-triangle')).toHaveCount(10);
    await expect(alice.locator('.player-dot.player1 .color-symbol-circle')).toHaveCount(1);
    await expect(alice.locator('.player-dot.player2 .color-symbol-square')).toHaveCount(1);
    await expect(alice.locator('.player-dot.player3 .color-symbol-triangle')).toHaveCount(1);
    await setPreference(alice, 'Color-blind symbols', false);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const faq = await openFaq(table.pages[0]);
    await expect(faq).toContainText('How do chains of hops and End move work?');
    await expect(faq).toContainText('Why can five players not start?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Chinese Checkers differences from Wikipedia', () => {
  test('a marble left in your target does not stop you winning', async ({ seat }) => {
    const table = await seat('chinesecheckers', NAMES.slice(0, 2));
    const [alice, bob] = table.pages;
    // Bob never moved one marble out of point 3, Alice's target; she fills the rest
    const [bobsMarble, ...rest] = keysOf(3).filter(key => key !== '1,-5');
    await craft(table, { [bobsMarble]: 2, ...fill(rest, 1), '1,-4': 1 });
    await clickPath(alice, '1,-4', '1,-5');
    for (const page of [alice, bob]) {
      await expect(status(page)).toHaveText('Alice filled the far point and wins!');
      await expect(gameOver(page).locator('.game-over-standings li').first()).toContainText('9 of 10 marbles home');
    }
  });
});
