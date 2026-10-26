import type { Page } from '@playwright/test';
import { dismiss, drag, expect, leave, openFaq, seeTable, test, undo, type Seat, type Table } from './fixtures.ts';
import { POINT_COUNT, diceToPlay, pointIndex } from '../games/backgammon/rules.ts';
import type { PointStack, Position, Seat as SeatNumber } from '../games/backgammon/types.ts';

// One test per rule and control in games/backgammon/README.md. Seat 1 (Alice) plays white and seat 2 (Bob) red.
// Each player sees their own side: their points 1 to 6 along the bottom right, their bar and tray in the bottom row.

type Server = { url: string };

// Checkers per point number as that seat counts them, plus the bar and borne off
type Layout = { points?: Record<number, number>; bar?: number; off?: number };

function position(layouts: Record<SeatNumber, Layout>): Position {
  const points: (PointStack | null)[] = Array(POINT_COUNT).fill(null);
  const bar: Record<SeatNumber, number> = {};
  const borneOff: Record<SeatNumber, number> = {};
  for (const [key, layout] of Object.entries(layouts)) {
    const seat = Number(key);
    for (const [number, count] of Object.entries(layout.points ?? {})) {
      points[pointIndex(seat, Number(number))] = { seat, count };
    }
    bar[seat] = layout.bar ?? 0;
    borneOff[seat] = layout.off ?? 0;
  }
  return { points, bar, borneOff };
}

// Queues die faces before anyone joins, so the opening roll made when the second player sits down is known
async function queueDice(server: Server, ...faces: number[]): Promise<void> {
  const response = await fetch(`${server.url}/api/e2e/random`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values: faces.map(face => (face - 0.5) / 6) })
  });
  if (!response.ok) throw new Error(await response.text());
}

// By default Alice opens with a 5 against Bob's 3, so she moves first with 5 and 3
async function start(seat: Seat, server: Server, opening = [5, 3], names = ['Alice', 'Bob']) {
  await queueDice(server, ...opening);
  const table = await seat('backgammon', names);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

// A started game in this position with `currentPlayer` to play `remaining`, or to roll or double when it is empty
// Waits until every player's page shows it: the checkers drawn, the trays and the dice
async function craft(table: Table, layouts: Record<SeatNumber, Layout>, remaining: number[], extra: object = {}) {
  const crafted = position(layouts);
  const dice = remaining.slice(0, 2);
  await table.patch({
    ...crafted, dice, remaining, currentPlayer: 1, started: true,
    cube: 1, cubeOwner: null, doubleOffer: null, lastMove: null, ...extra
  });
  const drawn = [...crafted.points.map(stack => stack?.count ?? 0), ...Object.values(crafted.bar)]
    .reduce((sum, count) => sum + Math.min(count, 5), 0);
  const trays = Object.values(crafted.borneOff).reverse().map(count => `${count}/15`);
  const faces = remaining.length ? diceToPlay(dice).map(String) : [];
  for (const page of table.pages) {
    await expect(page.locator('.bg-checker')).toHaveCount(drawn);
    await expect.poll(async () => (await page.locator('.bg-tray > .bg-point-label').allTextContents()).sort()).toEqual([...trays].sort());
    await expect.poll(() => diceLabels(page)).toEqual(faces);
  }
}

// The point numbered `number` from the viewer's side
const point = (page: Page, number: number) => page.locator(`.bg-point:has(> .bg-point-label:text-is("${number}"))`);
const checkers = (page: Page, number: number, color: 'white' | 'red') => point(page, number).locator(`.bg-checker.${color}`);
const myBar = (page: Page) => page.locator('.bg-half-bottom .bg-bar');
const theirBar = (page: Page) => page.locator('.bg-half-top .bg-bar');
const myTray = (page: Page) => page.locator('.bg-half-bottom .bg-tray');
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.bg-turn');
const cube = (page: Page) => page.locator('.bg-cube');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const diceLabels = (page: Page) => page.locator('.bg-die').evaluateAll(dice => dice.map(die => die.getAttribute('aria-label')));
const labels = (page: Page, half: 'top' | 'bottom') =>
  page.locator(`.bg-half-${half} .bg-point > .bg-point-label`).allTextContents();

// Both players' checkers far apart in their home boards, so any roll can be played
const RACE: Record<SeatNumber, Layout> = { 1: { points: { 6: 15 } }, 2: { points: { 6: 15 } } };

test.describe('Backgammon rules', () => {
  test('a single money game is played for the stake on the doubling cube', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await expect(cube(alice)).toHaveText('Cube: 1, in the middle');
    // Alice bears off her last checker with the cube at 2, and Bob has borne one off, so it is a single game
    await craft(table, { 1: { points: { 1: 1 }, off: 14 }, 2: { points: { 6: 14 }, off: 1 } }, [3], { cube: 2, cubeOwner: 2 });
    await point(alice, 1).click();
    await myTray(alice).click();
    await expect(status(bob)).toHaveText('Alice bore off from 1. Alice wins: 2 points!');
    await expect(cube(bob)).toHaveText('Alice won 2 points');
  });

  test('both players start with fifteen checkers in the standard layout', async ({ seat, server }) => {
    const { alice, bob } = await start(seat, server);
    for (const page of [alice, bob]) {
      const [mine, theirs] = page === alice ? ['white', 'red'] as const : ['red', 'white'] as const;
      await expect(checkers(page, 24, mine)).toHaveCount(2);
      await expect(checkers(page, 13, mine)).toHaveCount(5);
      await expect(checkers(page, 8, mine)).toHaveCount(3);
      await expect(checkers(page, 6, mine)).toHaveCount(5);
      // The opponent's 24, 13, 8 and 6 are this player's 1, 12, 17 and 19
      await expect(checkers(page, 1, theirs)).toHaveCount(2);
      await expect(checkers(page, 12, theirs)).toHaveCount(5);
      await expect(checkers(page, 17, theirs)).toHaveCount(3);
      await expect(checkers(page, 19, theirs)).toHaveCount(5);
      await expect(page.locator(`.bg-checker.${mine}`)).toHaveCount(15);
      await expect(page.locator(`.bg-checker.${theirs}`)).toHaveCount(15);
      await expect(myTray(page).locator('.bg-point-label')).toHaveText('0/15');
    }
  });

  test('the opening roll: each rolls one die, again on a tie, and the higher roller moves first with both numbers', async ({ seat, server }) => {
    // A tie of 4 and 4 is rolled again; then Alice rolls 2 and Bob 5
    const { alice, bob } = await start(seat, server, [4, 4, 2, 5]);
    await expect(status(alice)).toContainText('Alice rolled 2 and Bob rolled 5, so Bob moves first');
    await expect(turn(bob)).toHaveText('You move first');
    await expect(turn(alice)).toHaveText('Bob moves first');
    await expect.poll(() => diceLabels(bob)).toEqual(['5', '2']);
    // Bob plays both numbers at once, so he neither rolls nor doubles first
    await expect(button(bob, 'Roll')).toHaveCount(0);
    await expect(bob.getByRole('button', { name: /^Double/ })).toHaveCount(0);
  });

  test('later turns start with Roll or a double offer, each die moves one checker, and doubles are played four times', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, RACE, []);
    await expect(button(alice, 'Roll')).toBeVisible();
    await expect(button(alice, 'Double to 2')).toBeVisible();
    await table.dice(2, 2);
    await button(alice, 'Roll').click();
    await expect.poll(() => diceLabels(alice)).toEqual(['2', '2', '2', '2']);
    for (let moved = 1; moved <= 4; moved++) {
      await point(alice, 6).click();
      await point(alice, 4).click();
      await expect(checkers(alice, 4, 'white')).toHaveCount(moved);
    }
    await expect(point(alice, 6).locator('.bg-checker')).toHaveText(['', '', '', '', '11']);
    await expect(button(bob, 'Roll')).toBeVisible();
  });

  test('a checker lands on an empty point, its own point or a blot, which is hit to the bar; two or more block it', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    // Bob has a blot on Alice's 10 point and two checkers on her 11 point
    await craft(table, { 1: { points: { 13: 1, 6: 2, 4: 1 } }, 2: { points: { 15: 1, 14: 2 } } }, [3, 2]);
    await point(alice, 6).click();
    await expect(point(alice, 3)).toHaveClass(/target/); // empty
    await expect(point(alice, 4)).toHaveClass(/target/); // her own
    await point(alice, 13).click();
    await expect(point(alice, 10)).toHaveClass(/target/); // the blot
    await expect(point(alice, 11)).not.toHaveClass(/target/); // blocked
    await point(alice, 10).click();
    await expect(status(alice)).toHaveText('Alice moved 13 to 10 and hit');
    await expect(checkers(alice, 10, 'white')).toHaveCount(1);
    await expect(theirBar(alice).locator('.bg-checker.red')).toHaveCount(1);
    await expect(myBar(bob).locator('.bg-checker.red')).toHaveCount(1);
  });

  test('a checker on the bar must enter in the opponent\'s home board before anything else moves', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: { points: { 13: 2 }, bar: 1 }, 2: { points: { 1: 2 } } }, [3, 5]);
    await expect(alice.locator('.bg-hint')).toHaveText('Enter from the bar first: click your checker on the bar, then a highlighted point');
    await expect(point(alice, 13)).not.toHaveClass(/movable/);
    await point(alice, 13).click();
    await expect(alice.locator('.bg-point.selected')).toHaveCount(0);
    await myBar(alice).click();
    await expect(myBar(alice)).toHaveClass(/selected/);
    await expect(alice.locator('.bg-point.target')).toHaveCount(2);
    await expect(point(alice, 22)).toHaveClass(/target/);
    await expect(point(alice, 20)).toHaveClass(/target/);
    await point(alice, 22).click();
    await expect(checkers(alice, 22, 'white')).toHaveCount(1);
    await expect(myBar(alice).locator('.bg-checker')).toHaveCount(0);
  });

  test('both dice must be used if possible, else the higher one, and an unusable roll is forfeited', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    // Bob blocks Alice's 17 and 16 points: 24 to 19 would leave the 3 unplayable
    await craft(table, { 1: { points: { 24: 1, 20: 1 } }, 2: { points: { 8: 2, 9: 2 } } }, [3, 5]);
    await point(alice, 24).click();
    await expect(alice.locator('.bg-point.target')).toHaveCount(1);
    await expect(point(alice, 21)).toHaveClass(/target/);
    await point(alice, 24).click(); // drops the selection before the next position
    await expect(alice.locator('.selected')).toHaveCount(0);

    // Only one die can be played from 24 with 16 blocked, so it must be the 6
    await craft(table, { 1: { points: { 24: 1 } }, 2: { points: { 9: 2 } } }, [6, 2]);
    await point(alice, 24).click();
    await expect(alice.locator('.bg-point.target')).toHaveCount(1);
    await expect(point(alice, 18)).toHaveClass(/target/);

    // On the bar against Bob's closed home board, no roll can be used
    const closed = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 };
    await craft(table, { 1: { points: { 13: 1 }, bar: 1 }, 2: { points: closed } }, []);
    await table.dice(4, 3);
    await button(alice, 'Roll').click();
    await expect(status(alice)).toHaveText('Alice rolled 4 and 3 and could not move');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(button(bob, 'Roll')).toBeVisible();
  });

  test('bearing off needs every checker home, a higher die bears off the highest checker, and you choose between two dice', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    // A checker on the 7 point keeps the others from bearing off
    await craft(table, { 1: { points: { 3: 2, 7: 1 } }, 2: { points: { 24: 2 } } }, [3]);
    await expect(point(alice, 3)).not.toHaveClass(/movable/);
    await point(alice, 7).click();
    await expect(myTray(alice)).not.toHaveClass(/target/);

    // All home: a 3 bears off from the 3 point
    await craft(table, { 1: { points: { 3: 2, 6: 1 } }, 2: { points: { 24: 2 } } }, [3]);
    await point(alice, 3).click();
    await expect(myTray(alice)).toHaveClass(/target/);

    // A 6 bears off only from the highest point, 4, not from 2
    await craft(table, { 1: { points: { 2: 1, 4: 1 } }, 2: { points: { 24: 2 } } }, [6]);
    await expect(point(alice, 2)).not.toHaveClass(/movable/);
    await point(alice, 4).click();
    await myTray(alice).click();
    await expect(myTray(alice).locator('.bg-point-label')).toHaveText('1/15');

    // A 5 or a 6 bears off from the 5 point, so Alice picks the die
    await craft(table, { 1: { points: { 5: 1, 2: 1, 1: 2 } }, 2: { points: { 6: 2 } } }, [5, 6]);
    await point(alice, 5).click();
    await myTray(alice).click();
    await expect(alice.locator('.bg-die-choice')).toContainText('Bear off with which die?');
    await alice.locator('.bg-die-choice').getByRole('button', { name: '6', exact: true }).click();
    await expect(myTray(alice).locator('.bg-point-label')).toHaveText('1/15');
    await expect.poll(() => diceLabels(alice)).toEqual(['5', '6 (used)']);
  });

  test('the cube starts at 1 in the middle; a take doubles it and passes ownership, a drop concedes at the old value', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, RACE, []);
    await expect(cube(alice)).toHaveText('Cube: 1, in the middle');
    await button(alice, 'Double to 2').click();
    await expect(turn(bob)).toHaveText('Take or drop the double');
    await expect(bob.locator('.bg-hint')).toHaveText('Take to play on for 2 points, or drop to concede 1 point');
    await button(bob, 'Take').click();
    await expect(cube(bob)).toHaveText('Cube: 2, yours');
    await expect(cube(alice)).toHaveText("Cube: 2, Bob's");
    // Only Bob may redouble now
    await expect(button(alice, 'Roll')).toBeVisible();
    await expect(alice.getByRole('button', { name: /^Double/ })).toHaveCount(0);

    await table.patch({ currentPlayer: 2 });
    await button(bob, 'Double to 4').click();
    await button(alice, 'Take').click();
    await expect(cube(alice)).toHaveText('Cube: 4, yours');

    // No limit on redoubles; Bob drops this one and concedes the 4 on the cube
    await table.patch({ currentPlayer: 1 });
    await button(alice, 'Double to 8').click();
    await button(bob, 'Drop').click();
    await expect(status(alice)).toHaveText('Bob dropped the double. Alice wins: 4 points!');
    await expect(cube(alice)).toHaveText('Alice won 4 points');
  });

  test('bearing off all fifteen wins the cube once, twice for a gammon and three times for a backgammon', async ({ seat, server }) => {
    const cases: { names: string[]; loser: Layout; cube: number; text: string }[] = [
      { names: ['Alice', 'Bob'], loser: { points: { 6: 14 }, off: 1 }, cube: 1, text: 'Alice wins: 1 point!' },
      { names: ['Cara', 'Dan'], loser: { points: { 6: 15 } }, cube: 2, text: 'Cara wins with a gammon: 4 points!' },
      // Dan's 20 point is in Eve's home board
      { names: ['Eve', 'Finn'], loser: { points: { 6: 14, 20: 1 } }, cube: 4, text: 'Eve wins with a backgammon: 12 points!' },
      { names: ['Gus', 'Hal'], loser: { points: { 6: 14 }, bar: 1 }, cube: 1, text: 'Gus wins with a backgammon: 3 points!' }
    ];
    for (const { names, loser, cube: value, text } of cases) {
      const { table, alice, bob } = await start(seat, server, [5, 3], names);
      await craft(table, { 1: { points: { 1: 1 }, off: 14 }, 2: loser }, [3], { cube: value, cubeOwner: value > 1 ? 2 : null });
      await point(alice, 1).click();
      await myTray(alice).click();
      await expect(status(bob)).toContainText(text);
      await expect(turn(bob)).toHaveText('Game Over');
    }
  });

  test('if a player leaves mid-game, the other player wins', async ({ seat, server }) => {
    const { alice, bob } = await start(seat, server);
    await point(alice, 8).click();
    await point(alice, 3).click();
    await expect(checkers(alice, 3, 'white')).toHaveCount(1);
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('a roll, a checker move, a double, a take or a drop is undone only if the other player approves', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, { 1: { points: { 8: 3, 6: 12 } }, 2: { points: { 6: 15 } } }, []);

    // A roll: declined, then approved
    await table.dice(3, 1);
    await button(alice, 'Roll').click();
    await expect.poll(() => diceLabels(alice)).toEqual(['3', '1']);
    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect.poll(() => diceLabels(alice)).toEqual(['3', '1']);
    // A checker move
    await point(alice, 8).click();
    await point(alice, 5).click();
    await expect(checkers(alice, 8, 'white')).toHaveCount(2);
    await undo(alice, bob);
    await expect(checkers(alice, 8, 'white')).toHaveCount(3);
    await expect(status(alice)).toHaveText('Last turn undone');
    await undo(alice, bob);
    await expect(button(alice, 'Roll')).toBeVisible();
    await expect(alice.locator('.bg-die')).toHaveCount(0);

    // A double
    await button(alice, 'Double to 2').click();
    await expect(button(bob, 'Take')).toBeVisible();
    await undo(bob, alice);
    await expect(button(alice, 'Double to 2')).toBeVisible();
    // A take
    await button(alice, 'Double to 2').click();
    await button(bob, 'Take').click();
    await expect(cube(bob)).toHaveText('Cube: 2, yours');
    await undo(bob, alice);
    await expect(button(bob, 'Take')).toBeVisible();
    await expect(cube(bob)).toHaveText('Cube: 1, in the middle');
    // A drop
    await button(bob, 'Drop').click();
    await expect(turn(bob)).toHaveText('Game Over');
    await seeTable(alice);
    await seeTable(bob);
    await undo(bob, alice);
    await expect(button(bob, 'Drop')).toBeVisible();
    await expect(turn(bob)).toHaveText('Take or drop the double');
  });
});

test.describe('Backgammon controls', () => {
  test('each player sees the board from their own side, home board bottom right, points 1 to 24 from that side', async ({ seat, server }) => {
    const { alice, bob } = await start(seat, server);
    for (const page of [alice, bob]) {
      expect(await labels(page, 'bottom')).toEqual(['12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1']);
      expect(await labels(page, 'top')).toEqual(['13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24']);
    }
    // Each player's own back checkers are on their own 24 point, top right
    await expect(checkers(alice, 24, 'white')).toHaveCount(2);
    await expect(checkers(bob, 24, 'red')).toHaveCount(2);
    await expect(checkers(bob, 6, 'red')).toHaveCount(5);
  });

  test('start a turn with Roll, or Double to offer a double first; the opponent answers with Take or Drop', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, RACE, []);
    await expect(button(alice, 'Roll')).toBeVisible();
    await expect(button(bob, 'Roll')).toHaveCount(0);
    await button(alice, 'Double to 2').click();
    await expect(button(bob, 'Take')).toBeVisible();
    await expect(button(bob, 'Drop')).toBeVisible();
    await expect(button(alice, 'Take')).toHaveCount(0);
    await expect(turn(alice)).toHaveText('Bob is deciding on your double');
  });

  test('after rolling, movable checkers are ringed; click one, then a highlighted point or your tray to bear off', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    // The opening 5 and 3: every one of Alice's points can move
    for (const number of [24, 13, 8, 6]) await expect(point(alice, number)).toHaveClass(/movable/);
    await expect(alice.locator('.bg-point.movable')).toHaveCount(4);
    const ring = await point(alice, 8).locator('.bg-checker').last().evaluate(element => getComputedStyle(element).outlineStyle);
    expect(ring).toBe('solid');
    await point(alice, 8).click();
    await expect(point(alice, 8)).toHaveClass(/selected/);
    await expect(point(alice, 3)).toHaveClass(/target/);
    await expect(point(alice, 5)).toHaveClass(/target/);
    await point(alice, 3).click();
    await expect(checkers(alice, 3, 'white')).toHaveCount(1);

    await craft(table, { 1: { points: { 1: 1, 3: 1 } }, 2: { points: { 6: 2 } } }, [1, 3]);
    await point(alice, 1).click();
    await expect(myTray(alice)).toHaveClass(/target/);
    await myTray(alice).click();
    await expect(myTray(alice).locator('.bg-point-label')).toHaveText('1/15');
    await expect(myTray(alice).locator('.bg-slab.white')).toHaveCount(1);
  });

  test('when either die could bear off the checker, buttons ask which die, and Cancel picks a different checker', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: { points: { 5: 1, 2: 1, 1: 2 } }, 2: { points: { 6: 2 } } }, [5, 6]);
    await point(alice, 5).click();
    await myTray(alice).click();
    const choice = alice.locator('.bg-die-choice');
    await expect(choice.getByRole('button')).toHaveText(['5', '6', 'Cancel']);
    await choice.getByRole('button', { name: 'Cancel' }).click();
    await expect(choice).toHaveCount(0);
    await expect(alice.locator('.selected')).toHaveCount(0);
    await expect(checkers(alice, 5, 'white')).toHaveCount(1);
    await expect(myTray(alice).locator('.bg-point-label')).toHaveText('0/15');
    await point(alice, 5).click();
    await expect(point(alice, 5)).toHaveClass(/selected/);
  });

  test('clicking the selected checker again, or anywhere else, lets you pick a different one', async ({ seat, server }) => {
    const { alice } = await start(seat, server);
    await point(alice, 8).click();
    await expect(point(alice, 8)).toHaveClass(/selected/);
    await point(alice, 8).click();
    await expect(alice.locator('.selected')).toHaveCount(0);
    await expect(point(alice, 8)).toHaveClass(/movable/);
    await point(alice, 8).click();
    await point(alice, 20).click(); // an empty point that is not a destination
    await expect(alice.locator('.selected')).toHaveCount(0);
    await point(alice, 13).click();
    await expect(point(alice, 13)).toHaveClass(/selected/);
  });

  test('each click moves one checker by one die, and used dice are faded', async ({ seat, server }) => {
    const { alice, bob } = await start(seat, server);
    await expect.poll(() => diceLabels(alice)).toEqual(['5', '3']);
    await point(alice, 8).click();
    await point(alice, 5).click();
    await expect(checkers(alice, 8, 'white')).toHaveCount(2);
    await expect(checkers(alice, 5, 'white')).toHaveCount(1);
    await expect.poll(() => diceLabels(alice)).toEqual(['5', '3 (used)']);
    await expect.poll(() => diceLabels(bob)).toEqual(['5', '3 (used)']);
    const opacity = await alice.locator('.bg-die.used').evaluate(element => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBeLessThan(1);
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('the cube\'s value and owner are shown beside the board, and the points won once the game is over', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await expect(cube(alice)).toHaveText('Cube: 1, in the middle');
    await craft(table, { 1: { points: { 1: 1 }, off: 14 }, 2: { points: { 6: 14 }, off: 1 } }, [3], { cube: 4, cubeOwner: 1 });
    await expect(cube(alice)).toHaveText('Cube: 4, yours');
    await expect(cube(bob)).toHaveText("Cube: 4, Alice's");
    await point(alice, 1).click();
    await myTray(alice).click();
    await expect(cube(bob)).toHaveText('Alice won 4 points');
  });

  test('the board is dimmed when it is not your turn, and the last checker move is outlined', async ({ seat, server }) => {
    const { alice, bob } = await start(seat, server);
    await expect(alice.locator('.bg-board')).not.toHaveClass(/not-your-turn/);
    await expect(bob.locator('.bg-board')).toHaveClass(/not-your-turn/);
    await point(alice, 8).click();
    await point(alice, 3).click();
    for (const page of [alice, bob]) {
      // Bob sees Alice's 8 and 3 as his 17 and 22
      const [from, to] = page === alice ? [8, 3] : [17, 22];
      await expect(point(page, from)).toHaveClass(/last-from/);
      await expect(point(page, to)).toHaveClass(/last-to/);
    }
    const styles = await alice.evaluate(() => [
      getComputedStyle(document.querySelector('.last-from')!).outlineStyle,
      getComputedStyle(document.querySelector('.last-to')!).outlineStyle
    ]);
    expect(styles).toEqual(['dashed', 'solid']);
  });

  test('clicking Undo asks the opponent to undo the last move', async ({ seat, server }) => {
    const { alice, bob } = await start(seat, server);
    await point(alice, 8).click();
    await point(alice, 3).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.locator('.undo-vote-title')).toHaveText('Alice wants to undo the last turn');
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat, server }) => {
    const { alice } = await start(seat, server);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('doubling cube');
    await expect(faq).toContainText('bear off');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Backgammon differences from Wikipedia', () => {
  test('a tied opening roll is rolled again without an automatic double', async ({ seat, server }) => {
    const { alice } = await start(seat, server, [6, 6, 5, 3]);
    await expect(status(alice)).toContainText('Alice rolled 5 and Bob rolled 3, so Alice moves first');
    await expect(cube(alice)).toHaveText('Cube: 1, in the middle');
  });

  test('no beavers or raccoons: the taker cannot redouble while answering a double', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, RACE, []);
    await button(alice, 'Double to 2').click();
    await expect(bob.locator('.bg-actions').getByRole('button')).toHaveText(['Take', 'Drop']);
    await button(bob, 'Take').click();
    await expect(cube(bob)).toHaveText('Cube: 2, yours');
    await expect(button(alice, 'Roll')).toBeVisible(); // the doubler rolls next, the cube stays at 2
  });

  test('no Jacoby rule: a gammon counts double even with the cube never turned', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, { 1: { points: { 1: 1 }, off: 14 }, 2: { points: { 6: 15 } } }, [3]);
    await point(alice, 1).click();
    await myTray(alice).click();
    await expect(status(bob)).toContainText('Alice wins with a gammon: 2 points!');
  });

  test('no match play: one game is played and ends with its points', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, RACE, []);
    await button(alice, 'Double to 2').click();
    await button(bob, 'Drop').click();
    for (const page of [alice, bob]) {
      await expect(turn(page)).toHaveText('Game Over');
      await expect(cube(page)).toHaveText('Alice won 1 point');
      await expect(page.locator('.bg-actions')).toHaveCount(0);
    }
  });
});

test.describe('Backgammon drag and drop', () => {
  const lifted = (page: Page, number: number) => point(page, number).locator('[data-drag]');

  test('a checker dragged to a highlighted point moves there', async ({ seat, server }) => {
    const { table, alice, bob } = await start(seat, server);
    await craft(table, { 1: { points: { 6: 2 } }, 2: { points: { 6: 2 } } }, [3, 2]);
    await drag(alice, lifted(alice, 6), point(alice, 3));
    await expect(checkers(bob, 22, 'white')).toHaveCount(1); // Alice's 3 point is Bob's 22
    await expect(checkers(alice, 3, 'white')).toHaveCount(1);
    await expect(checkers(alice, 6, 'white')).toHaveCount(1);
    await expect(alice.locator('.drag-ghost')).toHaveCount(0);
    await expect(alice.locator('.selected')).toHaveCount(0);
  });

  test('a checker dragged from the bar enters', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: { points: { 13: 2 }, bar: 1 }, 2: { points: { 1: 2 } } }, [3, 5]);
    await drag(alice, myBar(alice).locator('[data-drag]'), point(alice, 22));
    await expect(checkers(alice, 22, 'white')).toHaveCount(1);
    await expect(myBar(alice).locator('.bg-checker')).toHaveCount(0);
  });

  test('a checker dragged to the tray bears off, and two dice that both reach it still ask which die', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: { points: { 5: 1, 2: 1, 1: 2 } }, 2: { points: { 6: 2 } } }, [5, 6]);
    await drag(alice, lifted(alice, 5), myTray(alice));
    const choice = alice.locator('.bg-die-choice');
    await expect(choice.getByRole('button')).toHaveText(['5', '6', 'Cancel']);
    await choice.getByRole('button', { name: '6', exact: true }).click();
    await expect(myTray(alice).locator('.bg-point-label')).toHaveText('1/15');

    await craft(table, { 1: { points: { 1: 2 } }, 2: { points: { 6: 2 } } }, [3]);
    await drag(alice, lifted(alice, 1), myTray(alice));
    await expect(myTray(alice).locator('.bg-point-label')).toHaveText('1/15');
    await expect(alice.locator('.bg-die-choice')).toHaveCount(0);
  });

  test('a checker dropped on a point it cannot reach goes back, and nothing stays selected', async ({ seat, server }) => {
    const { table, alice } = await start(seat, server);
    await craft(table, { 1: { points: { 6: 2 } }, 2: { points: { 6: 2 } } }, [3, 2]);
    const before = await table.state();
    await drag(alice, lifted(alice, 6), point(alice, 5));
    await expect(checkers(alice, 6, 'white')).toHaveCount(2);
    await expect(alice.locator('.selected')).toHaveCount(0);
    await expect(alice.locator('.drag-ghost')).toHaveCount(0);
    expect(await table.state()).toEqual(before);
    // Its own point, at an offset so the pointer moves enough to lift
    await drag(alice, lifted(alice, 6), point(alice, 6), { x: 5, y: 60 });
    await expect(alice.locator('.selected')).toHaveCount(0);
    expect(await table.state()).toEqual(before);
  });
});
