import type { Page } from '@playwright/test';
import { expect, headerButton, inHouseRules, openFaq, test, undo, type Seat, type SeatOptions } from './fixtures.ts';
import { PARTS } from '../games/steadyhand/board.ts';
import type { GameState, Point } from '../games/steadyhand/types.ts';

// One test per rule, control and difference in games/steadyhand/README.md. Seat 1 is Alice, 2 Bob.
// Drags walk the pointer through board points (viewBox 0 0 1000 640) mapped to the screen by the bay's own matrix.

const BOLT = PARTS[0].path; // rest (50, 250), exit (150, 24); Normal leaves 18 units each side of the line
const GEAR = PARTS[1].path;
// Straight across the Bolt's first bend: 50 units from the line halfway
const BOLT_CUT: Point[] = [BOLT[0], BOLT[2]];
// 15 units off the Bolt's line, more than Hard's 11 and less than Easy's 26, then back on and out
const BOLT_WOBBLE: Point[] = [BOLT[0], [65, 200], BOLT[1], BOLT[2], BOLT[3]];

async function start(seat: Seat, names = ['Alice', 'Bob'], options?: SeatOptions) {
  const table = await seat('steadyhand', names, options);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

const bay = (page: Page) => page.getByRole('img', { name: 'Repair bay' });
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.sh-turn');
const seatRow = (page: Page, name: string) => page.locator('.sh-seat', { hasText: name });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
// The first part drawn in the bay, the Bolt while it is in its slot
const bolt = (page: Page) => bay(page).locator('.sh-part').first();

// Board point to screen point through the bay's current matrix
async function toScreen(page: Page): Promise<(p: Point) => { x: number; y: number }> {
  await bay(page).scrollIntoViewIfNeeded();
  const [a, b, c, d, e, f] = await bay(page).evaluate(svg => {
    const m = (svg as SVGSVGElement).getScreenCTM()!;
    return [m.a, m.b, m.c, m.d, m.e, m.f];
  });
  return ([x, y]) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
}

// The route split into steps of at most 4 board units, first point excluded
function steps(route: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < route.length; i++) {
    const [[ax, ay], [bx, by]] = [route[i - 1], route[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}

// Moves the pressed mouse along the route, from where it is
async function moveAlong(page: Page, route: Point[]): Promise<void> {
  const screen = await toScreen(page);
  for (const point of steps(route)) {
    const { x, y } = screen(point);
    await page.mouse.move(x, y);
  }
}

// Presses the mouse on the route's first point and moves it along; `release: false` keeps holding
async function drag(page: Page, route: Point[], release = true): Promise<void> {
  const { x, y } = (await toScreen(page))(route[0]);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await moveAlong(page, route);
  if (release) await page.mouse.up();
}

// One finger along the route through Chrome's touch input
async function fingerDrag(page: Page, route: Point[]): Promise<void> {
  const screen = await toScreen(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [screen(point)] : [] });
  await touch('touchStart', route[0]);
  for (const point of steps(route)) await touch('touchMove', point);
  await touch('touchEnd');
  await cdp.detach();
}

// Where a page draws the Bolt, read from its inline transform (the computed one glides between streamed positions)
const drawnAt = (page: Page) => bolt(page).evaluate(g => {
  const [, x, y] = (g as SVGGElement).style.transform.match(/translate\(([^,]+)px, ([^)]+)px\)/)!;
  return [parseFloat(x), parseFloat(y)];
});
// Within half a board unit, since the drag went through the screen matrix and back
const near = ([x, y]: Point) => [expect.closeTo(x, 0), expect.closeTo(y, 0)];

test.describe('Steady Hand house rules', () => {
  for (const names of [['Alice'], ['Alice', 'Bob']]) {
    test(`Buzzes allowed is 3 with ${names.length} player${names.length > 1 ? 's' : ''}, and Wall tolerance Normal`, async ({ seat }) => {
      const { alice } = await start(seat, names);
      await inHouseRules(alice, async dialog => {
        const buzzes = dialog.getByLabel('Buzzes allowed', { exact: true });
        await expect(buzzes.locator('option')).toHaveText(['Unlimited', '1', '3', '5']);
        await expect(buzzes).toHaveValue('3');
        await expect(dialog.getByLabel('Wall tolerance', { exact: true })).toHaveValue('normal');
      });
      await expect(seatRow(alice, 'Alice')).toContainText('3 buzzes left');
    });
  }
});

test.describe('Steady Hand turns', () => {
  test('dragging a part along its slot brings it out, scores it and passes the turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(turn(alice)).toHaveText('Your turn: drag a part out along its slot without touching the walls');
    await expect(turn(bob)).toHaveText("Alice's turn");
    await drag(alice, BOLT);
    for (const page of [alice, bob]) {
      await expect(status(page)).toHaveText('Alice brought out the Bolt for 8 points');
      await expect(seatRow(page, 'Alice')).toContainText('8 points');
      await expect(page.locator('.sh-tray-part')).toHaveText(['Bolt, 8 points, Alice']);
      await expect(bay(page).locator('.sh-part')).toHaveCount(9);
    }
    await expect(turn(bob)).toHaveText('Your turn: drag a part out along its slot without touching the walls');
  });

  test('leaving the slot buzzes, puts the part back and passes the turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await drag(alice, BOLT_CUT);
    for (const page of [alice, bob]) {
      await expect(status(page)).toHaveText('Alice buzzed on the Bolt');
      await expect(seatRow(page, 'Alice')).toContainText('2 buzzes left');
      await expect.poll(() => drawnAt(page)).toEqual(near(BOLT[0]));
    }
    await expect(turn(alice)).toHaveText("Bob's turn");
    const state = await table.state<GameState>();
    expect(state.outBy).toEqual({});
    expect(state.live).toBeNull();
  });

  test('letting go mid-slot puts the part back with no buzz, and it is still your turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await drag(alice, [BOLT[0], [50, 180]]);
    await expect.poll(async () => (await table.state<GameState>()).live).toBeNull();
    for (const page of [alice, bob]) await expect.poll(() => drawnAt(page)).toEqual(near(BOLT[0]));
    await expect(seatRow(alice, 'Alice')).toContainText('3 buzzes left');
    await expect(turn(alice)).toHaveText('Your turn: drag a part out along its slot without touching the walls');
    // The same part can be tried again at once
    await drag(alice, BOLT);
    await expect(status(bob)).toHaveText('Alice brought out the Bolt for 8 points');
  });

  test('Bob watches the part move during the drag, and History holds only the finished turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await drag(alice, [BOLT[0], [50, 200]], false);
    await expect.poll(() => drawnAt(bob)).toEqual(near([50, 200]));
    await expect(bolt(bob)).toHaveClass(/sh-part-watched/);
    await moveAlong(alice, [[50, 200], [50, 160]]);
    await expect.poll(() => drawnAt(bob)).toEqual(near([50, 160]));
    await moveAlong(alice, [[50, 160], ...BOLT.slice(1)]);
    await alice.mouse.up();
    await expect(status(bob)).toHaveText('Alice brought out the Bolt for 8 points');
    await (await headerButton(bob, 'History')).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-move')).toHaveText('Move 1 of 1: Alice brought out the Bolt for 8 points');
  });

  test('with 1 buzz allowed, a player out of buzzes is skipped and the game ends when nobody has any', async ({ seat }) => {
    const { alice, bob } = await start(seat, ['Alice', 'Bob'], { houseRules: { buzzes: 1 } });
    await drag(alice, BOLT_CUT);
    await expect(seatRow(bob, 'Alice')).toContainText('0 buzzes left');
    await drag(bob, BOLT);
    await expect(status(alice)).toHaveText('Bob brought out the Bolt for 8 points');
    await expect(turn(bob)).toHaveText('Your turn: drag a part out along its slot without touching the walls');
    await expect(turn(alice)).toHaveText("Bob's turn");
    await drag(bob, [GEAR[0], GEAR[2]]);
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toBeVisible();
      await expect(status(page)).toHaveText('Bob wins with 8 points');
    }
  });

  test('any part in a slot can be picked: the Gear comes out for 15 points', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await drag(alice, GEAR);
    await expect(status(bob)).toHaveText('Alice brought out the Gear for 15 points');
    await expect(seatRow(bob, 'Alice')).toContainText('15 points');
    await expect(bob.locator('.sh-tray-part')).toHaveText(['Gear, 15 points, Alice']);
  });

  test('History shows a buzz with its spot marked', async ({ seat }) => {
    const { bob, alice } = await start(seat);
    await drag(alice, BOLT_CUT);
    await expect(status(bob)).toHaveText('Alice buzzed on the Bolt');
    await (await headerButton(bob, 'History')).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-move')).toHaveText('Move 1 of 1: Alice buzzed on the Bolt');
    await expect(history.locator('.sh-buzz-mark')).toHaveCount(1);
  });

  test('Undo by vote after a buzz gives the buzz and the turn back', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await drag(alice, BOLT_CUT);
    await expect(turn(alice)).toHaveText("Bob's turn");
    await undo(alice, bob);
    await expect(turn(alice)).toHaveText('Your turn: drag a part out along its slot without touching the walls');
    for (const page of [alice, bob]) await expect(seatRow(page, 'Alice')).toContainText('3 buzzes left');
  });
});

test.describe('Steady Hand solo and tolerance', () => {
  test('clearing the bay alone adds 10 points for each buzz left', async ({ seat }) => {
    const { table, alice } = await start(seat, ['Alice']);
    await table.patch({ outBy: Object.fromEntries(PARTS.slice(1).map(p => [p.id, 1])) });
    await expect(bay(alice).locator('.sh-part')).toHaveCount(1);
    await drag(alice, BOLT_CUT);
    await expect(seatRow(alice, 'Alice')).toContainText('2 buzzes left');
    await drag(alice, BOLT);
    await expect(gameOver(alice)).toBeVisible();
    await expect(status(alice)).toHaveText('Alice wins with 28 points'); // the Bolt's 8 and 2 buzzes left
  });

  test('Hard walls buzz on a wobble that Easy walls allow', async ({ seat }) => {
    const { alice: hard } = await start(seat, ['Alice'], { houseRules: { tolerance: 'hard' } });
    await drag(hard, BOLT_WOBBLE);
    await expect(status(hard)).toHaveText('Alice buzzed on the Bolt');
    const { alice: easy } = await start(seat, ['Alice'], { houseRules: { tolerance: 'easy' } });
    await drag(easy, BOLT_WOBBLE);
    await expect(status(easy)).toHaveText('Alice brought out the Bolt for 8 points');
  });

  test('a finger drag brings a part out on a phone', async ({ seat }) => {
    const { alice } = await start(seat, ['Alice'], { touch: true });
    await fingerDrag(alice, BOLT);
    await expect(status(alice)).toHaveText('Alice brought out the Bolt for 8 points');
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await start(seat, ['Alice']);
    const dialog = await openFaq(alice);
    await expect(dialog.getByText('How do I take a turn?')).toBeVisible();
    await expect(dialog.getByText('What happens if I touch a wall?')).toBeVisible();
  });
});
