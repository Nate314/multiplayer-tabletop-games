import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat } from './fixtures.ts';

// One test per rule, control and difference in games/farkle/README.md. Seat 1 is Alice, 2 Bob and 3 Cara.

async function start(seat: Seat, names = ['Alice', 'Bob']) {
  const table = await seat('farkle', names);
  // Crafts the roll in front of the player to move; the turn total and dice set aside are given too
  const rolled = (dice: number[], fields: object = {}) => table.patch({
    dice, setAside: [], turnTotal: 0, started: true, ...fields
  });
  return { table, pages: table.pages, rolled };
}

const status = (page: Page) => page.locator('.game-status');
const turnMessage = (page: Page) => page.locator('.turn-message');
const rollButton = (page: Page, name = 'Roll') => page.getByRole('button', { name, exact: true });
const bankButton = (page: Page) => page.getByRole('button', { name: 'Bank', exact: true });
const die = (page: Page, index: number, value: number) => page.getByRole('button', { name: `die ${index + 1}: ${value}` });
const pick = async (page: Page, ...dice: [number, number][]) => {
  for (const [index, value] of dice) await die(page, index, value).click();
};
const score = (page: Page, name: string) => page.locator('.farkle-score', { hasText: name }).locator('.farkle-score-points');
const aside = (page: Page) => page.locator('.farkle-aside .dice-die');
const rollOf = (page: Page) => page.locator('.farkle-dice .dice-die');

test.describe('Farkle rules', () => {
  test('everyone starts on zero and the first player rolls six dice', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await expect(score(alice, 'Alice')).toHaveText('0');
    await expect(score(alice, 'Bob')).toHaveText('0');
    await expect(rollButton(alice)).toBeEnabled();
    await expect(rollButton(bob)).toBeDisabled();
    await expect(bankButton(alice)).toBeDisabled();
    await expect(turnMessage(bob)).toHaveText('Alice rolls first. Joining closes after the first roll.');
    await table.dice(1, 5, 2, 3, 4, 6);
    await rollButton(alice).click();
    await expect(rollOf(bob)).toHaveCount(6);
    await expect(die(alice, 0, 1)).toBeVisible();
    await expect(die(bob, 0, 1)).toHaveCount(0); // the other player's dice are not buttons
    await expect(status(bob)).toHaveText('Alice rolled 1, 5, 2, 3, 4, 6');
  });

  test('single 1s are 100 and single 5s 50, and the selection shows what banking would give', async ({ seat }) => {
    const { pages: [alice], rolled } = await start(seat);
    await rolled([1, 5, 2, 3, 4, 6]);
    await pick(alice, [0, 1]);
    await expect(alice.locator('.farkle-selection')).toHaveText('Banking now gives 100 points');
    await pick(alice, [1, 5]);
    await expect(alice.locator('.farkle-selection')).toHaveText('Banking now gives 150 points');
  });

  test('a selection with a non-scoring die is refused: the buttons stay off', async ({ seat }) => {
    const { pages: [alice], rolled } = await start(seat);
    await rolled([1, 2, 5, 3, 4, 6]);
    await expect(rollButton(alice, 'Roll again')).toBeDisabled();
    await pick(alice, [0, 1], [1, 2]);
    await expect(alice.locator('.farkle-selection')).toHaveText('Every die you set aside must score');
    await expect(rollButton(alice, 'Roll again')).toBeDisabled();
    await expect(bankButton(alice)).toBeDisabled();
    await pick(alice, [1, 2]);
    await expect(bankButton(alice)).toBeEnabled();
  });

  test('three of a kind, four, five and six of a kind, three pair and a run score from the table', async ({ seat }) => {
    const { pages: [alice], rolled } = await start(seat);
    // Dice, the ones to set aside and what they score
    const cases: [number[], number[], string][] = [
      [[2, 2, 2, 3, 4, 6], [0, 1, 2], '200'], [[1, 1, 1, 3, 4, 6], [0, 1, 2], '1,000'], [[3, 3, 3, 3, 4, 6], [0, 1, 2, 3], '1,000'],
      [[4, 4, 4, 4, 4, 6], [0, 1, 2, 3, 4], '2,000'], [[6, 6, 6, 6, 6, 6], [0, 1, 2, 3, 4, 5], '3,000'],
      [[2, 2, 3, 3, 4, 4], [0, 1, 2, 3, 4, 5], '1,500'], [[3, 1, 2, 5, 4, 6], [0, 1, 2, 3, 4, 5], '2,500']
    ];
    for (const [dice, indexes, expected] of cases) {
      await rolled(dice);
      const buttons = alice.locator('.farkle-dice button.dice-die');
      await expect(buttons).toHaveCount(6);
      for (const index of indexes) await buttons.nth(index).click();
      await expect(alice.locator('.farkle-selection')).toHaveText(`Banking now gives ${expected} points`);
      // A patched state does not clear the selection as a move does
      for (const index of indexes) await buttons.nth(index).click();
    }
  });

  test('a roll sets aside the chosen dice and throws the rest', async ({ seat }) => {
    const { table, pages: [alice, bob], rolled } = await start(seat);
    await rolled([1, 2, 5, 3, 4, 6]);
    await table.dice(2, 3, 4, 1);
    await pick(alice, [0, 1], [2, 5]);
    await rollButton(alice, 'Roll again').click();
    await expect(aside(bob)).toHaveCount(2);
    await expect(rollOf(bob)).toHaveCount(4);
    await expect(bob.locator('.farkle-turn-total')).toHaveText('Turn total: 150');
    await expect(status(bob)).toHaveText('Alice set aside 1, 5 for 150 points and rolled 2, 3, 4, 1');
  });

  test('a roll with nothing scoring farkles and ends the turn with zero', async ({ seat }) => {
    const { table, pages: [alice, bob], rolled } = await start(seat);
    await rolled([1, 2, 3, 4, 6, 6], { turnTotal: 300, setAside: [5, 5, 5] });
    await table.dice(2, 3, 4, 6, 6);
    await pick(alice, [0, 1]);
    await rollButton(alice, 'Roll again').click();
    await expect(status(bob)).toHaveText('Alice set aside 1 for 100 points and rolled 2, 3, 4, 6, 6: Farkle! Alice loses 400 points');
    await expect(bob.locator('.farkle-farkle')).toHaveText('Farkle!');
    await expect(score(bob, 'Alice')).toHaveText('0');
    await expect(rollButton(bob)).toBeEnabled();
    await expect(rollButton(alice)).toBeDisabled();
    await expect(bob.locator('.farkle-turn-total')).toHaveText('Turn total: 0');
  });

  test('setting aside all six gives hot dice and a fresh six', async ({ seat }) => {
    const { table, pages: [alice, bob], rolled } = await start(seat);
    await rolled([1, 1, 1, 5, 5, 5]);
    await table.dice(2, 2, 3, 4, 6, 1);
    await pick(alice, [0, 1], [1, 1], [2, 1], [3, 5], [4, 5], [5, 5]);
    await rollButton(alice, 'Roll six new dice').click();
    await expect(rollOf(bob)).toHaveCount(6);
    await expect(aside(bob)).toHaveCount(0);
    await expect(bob.locator('.farkle-turn-total')).toHaveText('Turn total: 1,500');
    await expect(status(bob)).toContainText('has hot dice and rolled 2, 2, 3, 4, 6, 1');
  });

  test('banking adds the turn total and the dice set aside to the score and passes the turn', async ({ seat }) => {
    const { pages: [alice, bob], rolled } = await start(seat);
    await rolled([1, 2, 3, 4, 6, 6], { turnTotal: 250, scores: { 1: 500, 2: 0 } });
    await pick(alice, [0, 1]);
    await expect(alice.locator('.farkle-selection')).toHaveText('Banking now gives 350 points');
    await bankButton(alice).click();
    await expect(score(bob, 'Alice')).toHaveText('850');
    await expect(status(bob)).toHaveText('Alice banked 350 points');
    await expect(rollButton(bob)).toBeEnabled();
    await expect(bob.locator('.farkle-turn-total')).toHaveText('Turn total: 0');
  });

  test('there is no minimum to get on the board', async ({ seat }) => {
    const { pages: [alice, bob], rolled } = await start(seat);
    await rolled([5, 2, 3, 4, 6, 6]);
    await pick(alice, [0, 5]);
    await bankButton(alice).click();
    await expect(score(bob, 'Alice')).toHaveText('50');
  });

  test('reaching 10,000 gives everyone else one more turn and the highest total wins', async ({ seat }) => {
    const { pages: [alice, bob, cara], rolled } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await rolled([1, 1, 1, 3, 4, 6], { scores: { 1: 9500, 2: 9000, 3: 9900 } });
    await pick(alice, [0, 1], [1, 1], [2, 1]);
    await bankButton(alice).click();
    await expect(score(bob, 'Alice')).toHaveText('10,500');
    await expect(bob.locator('.farkle-score', { hasText: 'Alice' })).toContainText('Reached 10,000');
    await expect(bob.locator('.farkle-score', { hasText: 'Cara' })).toContainText('Last turn to come');
    await expect(turnMessage(bob)).toContainText('This is your last turn');
    // Bob banks 10,000, which does not give anyone another turn, then Cara passes the leader
    await rolled([1, 1, 1, 3, 4, 6], { currentPlayer: 2 });
    await pick(bob, [0, 1], [1, 1], [2, 1]);
    await bankButton(bob).click();
    await expect(score(cara, 'Bob')).toHaveText('10,000');
    await expect(turnMessage(cara)).toContainText('This is your last turn');
    await rolled([1, 3, 4, 6, 6, 6], { currentPlayer: 3 });
    await pick(cara, [0, 1], [3, 6], [4, 6], [5, 6]);
    await bankButton(cara).click();
    await expect(score(alice, 'Cara')).toHaveText('10,600');
    await expect(turnMessage(alice)).toHaveText('Game over: Cara won');
    await expect(alice.locator('.farkle-score-winner')).toHaveCount(1);
    await expect(alice.locator('.farkle-score', { hasText: 'Cara' })).toContainText('Winner');
  });

  test('a game to 5,000 ends at 5,000', async ({ seat }) => {
    const table = await seat('farkle', ['Alice', 'Bob'], { houseRules: { targetScore: 5000 } });
    const [alice, bob] = table.pages;
    await table.patch({ dice: [1, 1, 1, 3, 4, 6], setAside: [], turnTotal: 0, started: true, scores: { 1: 4500, 2: 4000 } });
    await pick(alice, [0, 1], [1, 1], [2, 1]);
    await bankButton(alice).click();
    await expect(score(bob, 'Alice')).toHaveText('5,500');
    await expect(bob.locator('.farkle-score', { hasText: 'Alice' })).toContainText('Reached 5,000');
    await expect(turnMessage(bob)).toContainText('someone reached 5,000');
    await table.patch({ dice: [1, 3, 4, 6, 6, 2], setAside: [], turnTotal: 0, currentPlayer: 2 });
    await pick(bob, [0, 1]);
    await bankButton(bob).click();
    await expect(turnMessage(alice)).toHaveText('Game over: Alice won');
  });
});

test.describe('Farkle controls', () => {
  test('Undo takes back a roll when everyone approves', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await table.dice(1, 5, 2, 3, 4, 6);
    await rollButton(alice).click();
    await expect(rollOf(bob)).toHaveCount(6);
    await undo(bob, alice);
    await expect(rollOf(bob)).toHaveCount(0);
    await expect(rollButton(alice)).toBeEnabled();
  });

  test('a refresh in the middle of a turn shows the same set-aside dice and turn total', async ({ seat }) => {
    const { table, pages: [alice], rolled } = await start(seat);
    await rolled([1, 2, 5, 3, 4, 6]);
    await table.dice(2, 3, 4, 1);
    await pick(alice, [0, 1], [2, 5]);
    await rollButton(alice, 'Roll again').click();
    await expect(aside(alice)).toHaveCount(2);
    await alice.reload();
    await expect(aside(alice)).toHaveCount(2);
    await expect(rollOf(alice)).toHaveCount(4);
    await expect(alice.locator('.farkle-turn-total')).toHaveText('Turn total: 150');
  });

  test('a dismissed player mid-turn drops out and the turn passes on', async ({ seat }) => {
    const { pages: [alice, bob, cara], rolled } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await rolled([1, 2, 5, 3, 4, 6], { turnTotal: 300, setAside: [5, 5, 5], currentPlayer: 2, lastMove: {
      type: 'roll', playerNumber: 2, kept: [5], points: 50, dice: [1, 2, 5, 3, 4, 6], hot: false, farkle: false, lost: 0
    } });
    await expect(rollOf(cara)).toHaveCount(6);
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(status(alice)).toHaveText('Bob was dismissed');
    await expect(turnMessage(cara)).toHaveText('Your turn: roll the dice.');
    await expect(cara.locator('.farkle-turn-total')).toHaveText('Turn total: 0');
    await expect(cara.locator('.farkle-score')).toHaveCount(2);
  });

  test('FAQ explains the scoring', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Each 1 is 100 and each 5 is 50');
    await expect(faq).toContainText('hot dice');
  });
});
