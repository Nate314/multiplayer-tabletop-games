import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat } from './fixtures.ts';
import { CATEGORIES } from '../games/yahtzee/rules.ts';
import type { Sheet } from '../games/yahtzee/types.ts';

// One test per rule, control and difference in games/yahtzee/README.md. Seat 1 is Alice and seat 2 is Bob.

const NONE = [false, false, false, false, false];

async function start(seat: Seat, names = ['Alice', 'Bob'], motion = false) {
  const table = await seat('yahtzee', names, { motion });
  const [alice, bob] = table.pages;
  // Crafts the dice on the table, as if the player to move had already rolled
  const rolled = (dice: number[], rollsLeft = 2) => table.patch({ dice, held: NONE, rollsLeft, lastMove: null });
  const sheets = (...all: Sheet[]) => table.patch({ sheets: Object.fromEntries(all.map((sheet, index) => [index + 1, sheet])) });
  return { table, alice, bob, rolled, sheets };
}

const rollButton = (page: Page) => page.getByRole('button', { name: /^Roll/ });
const die = (page: Page, index: number) => page.getByRole('button', { name: new RegExp(`^die ${index + 1}: `) });
const option = (page: Page, points: number, label: string) => page.getByRole('button', { name: `Score ${points} in ${label}`, exact: true });
const status = (page: Page) => page.locator('.game-status');
const rolls = (page: Page) => page.locator('.yz-rolls');
const totalRow = (page: Page) => page.locator('.yz-total td');
const faces = (page: Page) => page.locator('.yz-turn .dice-die').evaluateAll(
  elements => elements.map(element => Number(element.getAttribute('aria-label')?.split(': ')[1]))
);

// A sheet with every box filled but the given ones
const sheetWithout = (points: number, ...open: string[]): Sheet =>
  Object.fromEntries(CATEGORIES.filter(category => !open.includes(category)).map(category => [category, points]));

test.describe('Yahtzee rules', () => {
  test('a turn is up to three rolls, then a score', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await expect(rolls(alice)).toHaveText('3 of 3 rolls left');
    await expect(rollButton(bob)).toBeDisabled();
    for (const left of [2, 1, 0]) {
      await table.dice(1, 2, 3, 4, 5);
      await rollButton(alice).click();
      await expect(rolls(bob)).toHaveText(`${left} of 3 rolls left`);
    }
    await expect(rollButton(alice)).toBeDisabled();
    await expect(die(alice, 0)).toHaveCount(0); // no rolls left, so the dice cannot be held
    await expect(alice.locator('.turn-message')).toContainText('Your turn: score a box');
  });

  test('held dice stay and only the others are rolled again', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.dice(1, 2, 3, 4, 5);
    await rollButton(alice).click();
    await expect(rolls(alice)).toHaveText('2 of 3 rolls left');
    await die(alice, 0).click();
    await die(alice, 4).click();
    await expect(die(alice, 0)).toHaveAttribute('aria-pressed', 'true');
    await table.dice(6, 6, 6);
    await rollButton(alice).click();
    await expect(status(bob)).toHaveText('Alice rolled 1 6 6 6 5, 1 roll left');
    // The server kept which dice were held, and Bob sees the dice outlined but cannot change them
    await expect(bob.getByRole('img', { name: 'die 1: 1' })).toHaveClass(/dice-die-selected/);
    await expect(bob.getByRole('img', { name: 'die 2: 6' })).not.toHaveClass(/dice-die-selected/);
  });

  test('holding every die cannot be rolled', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.dice(1, 2, 3, 4, 5);
    await rollButton(alice).click();
    for (let index = 0; index < 5; index++) await die(alice, index).click();
    await expect(rollButton(alice)).toBeDisabled();
    await die(alice, 2).click();
    await expect(rollButton(alice)).toBeEnabled();
  });

  test('each category shows what the dice score there and writes it in when clicked', async ({ seat }) => {
    const { alice, bob, rolled } = await start(seat);
    await rolled([2, 2, 5, 5, 5]);
    for (const [points, label] of [[0, 'Ones'], [4, 'Twos'], [15, 'Fives'], [19, 'Three of a kind'], [0, 'Four of a kind'], [25, 'Full house'],
      [0, 'Small straight'], [0, 'Large straight'], [0, 'Yahtzee'], [19, 'Chance']] as const) {
      await expect(option(alice, points, label)).toBeVisible();
    }
    // Only the player to move is offered the boxes
    await expect(bob.locator('.yz-option')).toHaveCount(0);
    await option(alice, 25, 'Full house').click();
    await expect(status(bob)).toHaveText('Alice scored 25 points in Full house');
    await expect(totalRow(bob).first()).toHaveText('25');
    await expect(alice.locator('.turn-message')).toContainText("Bob's turn");
    await expect(alice.locator('.yz-option')).toHaveCount(0);
  });

  test('straights score 30 and 40 and Yahtzee 50', async ({ seat }) => {
    const { alice, rolled } = await start(seat);
    await rolled([2, 3, 4, 5, 6]);
    await expect(option(alice, 30, 'Small straight')).toBeVisible();
    await expect(option(alice, 40, 'Large straight')).toBeVisible();
    await rolled([3, 3, 3, 3, 3]);
    await expect(option(alice, 50, 'Yahtzee')).toBeVisible();
  });

  test('the upper bonus is 35 at 63 or more', async ({ seat }) => {
    const { alice, bob, rolled, sheets } = await start(seat);
    await sheets({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15 }, { ones: 3, twos: 6, threes: 9, fours: 12, fives: 10 });
    await rolled([6, 6, 6, 1, 2]);
    await option(alice, 18, 'Sixes').click();
    await expect(alice.locator('tr', { hasText: 'Bonus (63+)' }).locator('td').first()).toHaveText('35');
    await expect(totalRow(alice).first()).toHaveText('98');
    // Bob is short of 63 and gets no bonus
    await expect(alice.locator('tr', { hasText: 'Bonus (63+)' }).locator('td').nth(1)).toHaveText('0');
    await expect(totalRow(bob).nth(1)).toHaveText('40');
  });

  test('a second Yahtzee gives 100 and follows the Joker rule', async ({ seat }) => {
    const { alice, bob, rolled, sheets } = await start(seat);
    await sheets({ yahtzee: 50 }, {});
    await rolled([6, 6, 6, 6, 6]);
    // The matching upper box is the only one open to click
    await expect(alice.locator('.yz-option:enabled')).toHaveCount(1);
    await expect(option(alice, 30, 'Sixes')).toBeEnabled();
    await expect(option(alice, 30, 'Chance')).toBeDisabled();
    await option(alice, 30, 'Sixes').click();
    await expect(status(bob)).toHaveText('Alice scored 30 points in Sixes and a 100 point Yahtzee bonus');
    await expect(alice.locator('tr', { hasText: 'Yahtzee bonus' }).locator('td').first()).toHaveText('100');
    await expect(totalRow(alice).first()).toHaveText('180');
  });

  test('with the matching upper box full the Joker goes in a lower box at full value', async ({ seat }) => {
    const { alice, rolled, sheets } = await start(seat);
    await sheets({ yahtzee: 50, sixes: 12 }, {});
    await rolled([6, 6, 6, 6, 6]);
    await expect(option(alice, 25, 'Full house')).toBeEnabled();
    await expect(option(alice, 30, 'Small straight')).toBeEnabled();
    await expect(option(alice, 40, 'Large straight')).toBeEnabled();
    await expect(option(alice, 0, 'Ones')).toBeDisabled();
    await option(alice, 40, 'Large straight').click();
    await expect(totalRow(alice).first()).toHaveText('202');
  });

  test('with the lower section full the Joker scores zero in an upper box', async ({ seat }) => {
    const { alice, rolled, sheets } = await start(seat);
    await sheets({ yahtzee: 50, sixes: 12, threeKind: 1, fourKind: 1, fullHouse: 1, smallStraight: 1, largeStraight: 1, chance: 1 }, {});
    await rolled([6, 6, 6, 6, 6]);
    await expect(alice.locator('.yz-option:enabled')).toHaveCount(5);
    await option(alice, 0, 'Ones').click();
    await expect(status(alice)).toHaveText('Alice scored 0 points in Ones and a 100 point Yahtzee bonus');
  });

  test('a scratched Yahtzee box pays no bonus', async ({ seat }) => {
    const { alice, rolled, sheets } = await start(seat);
    await sheets({ yahtzee: 0 }, {});
    await rolled([4, 4, 4, 4, 4]);
    await option(alice, 20, 'Fours').click();
    await expect(status(alice)).toHaveText('Alice scored 20 points in Fours');
  });

  test('a category can be scored only once, and a zero is allowed', async ({ seat }) => {
    const { alice, rolled, sheets } = await start(seat);
    await sheets({ chance: 20 }, {});
    await rolled([1, 2, 3, 5, 6]);
    await expect(alice.locator('.yz-option', { hasText: /./ })).not.toHaveCount(0);
    await expect(alice.getByRole('button', { name: /in Chance$/ })).toHaveCount(0);
    await option(alice, 0, 'Yahtzee').click();
    await expect(status(alice)).toHaveText('Alice scored 0 points in Yahtzee');
    await expect(totalRow(alice).first()).toHaveText('20');
  });

  test('the game ends after 13 rounds and the highest total wins', async ({ seat }) => {
    const { alice, bob, rolled, sheets } = await start(seat);
    await sheets(sheetWithout(0, 'chance'), sheetWithout(0, 'chance'));
    await rolled([1, 1, 1, 1, 6]);
    await option(alice, 10, 'Chance').click();
    await expect(bob.locator('.turn-message')).toContainText('Round 13 of 13');
    await rolled([1, 1, 1, 1, 2]);
    await option(bob, 6, 'Chance').click();
    for (const page of [alice, bob]) {
      await expect(page.locator('.turn-message')).toHaveText('Game over: Alice won');
      await expect(rollButton(page)).toHaveCount(0);
    }
    await expect(alice.locator('.yz-player-winner')).toHaveText('Alice (you)');
    await expect(bob.locator('.yz-player-winner')).toHaveCount(1);
  });

  test('equal totals share the win', async ({ seat }) => {
    const { alice, bob, rolled, sheets } = await start(seat);
    await sheets(sheetWithout(0, 'chance'), sheetWithout(0, 'chance'));
    await rolled([2, 2, 2, 2, 2]);
    await option(alice, 10, 'Chance').click();
    await rolled([2, 2, 2, 2, 2]);
    await option(bob, 10, 'Chance').click();
    await expect(alice.locator('.turn-message')).toHaveText('Game over: Alice and Bob won');
    await expect(alice.locator('.yz-player-winner')).toHaveCount(2);
  });

  test('clicking Undo asks the other player to undo the last roll', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await rollButton(alice).click();
    await undo(alice, bob);
    await expect(rolls(alice)).toHaveText('3 of 3 rolls left');
    await expect(alice.getByRole('group', { name: "Alice's dice" })).toHaveCount(0);
  });

  test('a refresh mid-turn shows the same dice, held dice and rolls left', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.dice(1, 2, 3, 4, 5);
    await rollButton(alice).click();
    await die(alice, 1).click();
    await table.dice(6, 6, 6, 6);
    await rollButton(alice).click();
    await expect(rolls(bob)).toHaveText('1 of 3 rolls left');
    await alice.reload();
    await expect(alice.getByRole('button', { name: 'Back to games' })).toBeVisible();
    await expect(rolls(alice)).toHaveText('1 of 3 rolls left');
    await expect(die(alice, 1)).toHaveAttribute('aria-pressed', 'true');
    expect(await faces(alice)).toEqual([6, 2, 6, 6, 6]);
  });

  test('dice tumble and the score slides to its box, and nothing animates with reduced motion', async ({ seat }) => {
    const animated = await start(seat, ['Alice', 'Bob'], true);
    const running = (page: Page, key: string) => page.evaluate(
      key => document.querySelector(`[data-anim-key="${key}"]`)?.getAnimations().length ?? 0, key
    );
    await animated.table.dice(1, 2, 3, 4, 5);
    await rollButton(animated.alice).click();
    for (let index = 0; index < 5; index++) await expect.poll(() => running(animated.bob, `die-${index}`)).toBeGreaterThan(0);

    // A held die stays still while the other dice roll again
    await expect.poll(() => running(animated.bob, 'die-1')).toBe(0);
    await die(animated.alice, 0).click();
    await animated.table.dice(6, 6, 6, 6);
    await rollButton(animated.alice).click();
    await expect.poll(async () => (await running(animated.bob, 'die-1')) > 0 && (await running(animated.bob, 'die-0')) === 0).toBe(true);

    await option(animated.alice, 25, 'Chance').click();
    await expect.poll(() => animated.bob.locator('.yz-flying-points').count()).toBe(1);
    await expect(animated.bob.locator('.yz-flying-points')).toHaveText('25');
    await expect(animated.bob.locator('.yz-flying-points')).toHaveCount(0);
    await expect(animated.bob.locator('[data-anim-key="cell-1-chance"]')).toHaveText('25');

    const still = await start(seat);
    await still.table.dice(1, 2, 3, 4, 5);
    await rollButton(still.alice).click();
    await expect(still.bob.getByText('Alice rolled 1 2 3 4 5, 2 rolls left')).toBeVisible();
    await option(still.alice, 15, 'Chance').click();
    await expect(still.bob.getByText('Alice scored 15 points in Chance')).toBeVisible();
    expect(await still.bob.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('the score of the last box of the game still slides to its box', async ({ seat }) => {
    const { alice, bob, rolled, sheets } = await start(seat, ['Alice', 'Bob'], true);
    await sheets(sheetWithout(0, 'chance'), sheetWithout(0));
    await rolled([1, 1, 1, 1, 6]);
    await option(alice, 10, 'Chance').click();
    await expect.poll(() => bob.locator('.yz-flying-points').count()).toBe(1);
    await expect(bob.locator('.turn-message')).toHaveText('Game over: Alice won');
    await expect(bob.locator('.yz-flying-points')).toHaveCount(0);
    await expect(bob.locator('[data-anim-key="cell-1-chance"]')).toHaveText('10');
  });

  test('History steps through every move, and FAQ shows the rules', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.dice(1, 2, 3, 4, 5);
    await rollButton(alice).click();
    await option(alice, 15, 'Chance').click();
    await alice.getByRole('button', { name: 'History' }).click();
    const dialog = alice.getByRole('dialog', { name: 'History' });
    await expect(dialog.locator('.history-move')).toHaveText('Move 2 of 2: Alice scored 15 points in Chance');
    await expect(dialog.locator('.yz-cell-last')).toHaveText('15');
    await dialog.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(dialog.locator('.history-move')).toHaveText('Move 1 of 2: Alice rolled 1 2 3 4 5, 2 rolls left');
    await expect(dialog.getByRole('img', { name: 'die 5: 5' })).toBeVisible();
    await dialog.getByRole('slider', { name: 'Step' }).fill('0');
    await expect(dialog.locator('.history-move')).toHaveText('Start of the game');
    await dialog.getByRole('button', { name: 'Close' }).click();

    const faq = await openFaq(alice);
    await expect(faq).toContainText('Joker rule');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Yahtzee differences from Wikipedia', () => {
  test('a third player joins and gets a column of their own', async ({ seat }) => {
    const { table, alice } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await expect(alice.locator('.yz-player')).toHaveCount(3);
    expect(table.pages).toHaveLength(3);
  });

  test('a dismissed player on the move is skipped and their sheet is not counted', async ({ seat }) => {
    const { alice, bob, table } = await start(seat, ['Alice', 'Bob', 'Cara']);
    const cara = table.pages[2];
    await rollButton(alice).click();
    await option(alice, 0, 'Yahtzee').click();
    await rollButton(bob).click();
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(cara.locator('.turn-message')).toContainText('Your turn: roll the dice');
    await expect(rolls(cara)).toHaveText('3 of 3 rolls left');
    await expect(cara.locator('.yz-player')).toHaveCount(2);
  });

  test('dismissing the last player still to play ends the game', async ({ seat }) => {
    const { alice, bob, table, sheets } = await start(seat, ['Alice', 'Bob', 'Cara']);
    const cara = table.pages[2];
    await sheets(sheetWithout(1), sheetWithout(1, 'chance'), sheetWithout(2));
    await table.patch({ currentPlayer: 2, started: true });
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(alice.locator('.turn-message')).toHaveText('Game over: Cara won');
  });
});

test.describe('Yahtzee house rules', () => {
  test('10 players can join with the override', async ({ seat }) => {
    const names = Array.from({ length: 10 }, (_, index) => `Player${index + 1}`);
    const table = await seat('yahtzee', names, { maxPlayers: 10 });
    expect(table.pages).toHaveLength(10);
    expect((await table.state<{ activePlayers: number[] }>()).activePlayers).toHaveLength(10);
    for (const page of table.pages) await expect(page.getByText('Game is full')).toHaveCount(0);
  });
});
