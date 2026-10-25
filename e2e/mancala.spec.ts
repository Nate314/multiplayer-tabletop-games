import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Seat, type Table } from './fixtures.ts';
import type { HouseRuleValues } from '../shared/houseRules.ts';
import type { Board } from '../games/mancala/types.ts';

// One test per rule and control in games/mancala/README.md. Seat 1 (Alice) owns pits 0-5 and bank 6, seat 2 (Bob)
// pits 7-12 and bank 13. Each player sees their own row along the bottom, left to right.

// A board from 14 stone counts; a hole's stones are colored by the side the hole is on
function boardOf(counts: number[]): Board {
  return counts.map((count, hole) => Array(count).fill(hole <= 6 ? 1 : 2));
}

// The pit `index` (0-5) along the bottom row of `page`
const myPit = (page: Page, index: number) => page.locator('.pit-bottom').nth(index);
// The opponent's pit `index` (0-5) in their own order, counter-clockwise from their first pit
const theirPit = (page: Page, index: number) => page.locator('.pit-top').nth(5 - index);
const myBank = (page: Page) => page.locator('.bank-right');
const theirBank = (page: Page) => page.locator('.bank-left');
const count = (hole: ReturnType<typeof myPit>) => hole.locator('.count');

const OTHER_SIDE_OFF = { otherSide: false };

async function start(seat: Seat, motion = false, houseRules?: HouseRuleValues) {
  const table = await seat('mancala', ['Alice', 'Bob'], { motion, houseRules });
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

test.describe('Mancala rules', () => {
  test('the board has six pits per player and a bank at each end, every pit starting with four stones', async ({ seat }) => {
    const { alice } = await start(seat);
    await expect(alice.locator('.pit')).toHaveCount(12);
    await expect(alice.locator('.bank')).toHaveCount(2);
    for (const pit of await alice.locator('.pit .count').all()) await expect(pit).toHaveText('4');
    for (const bank of await alice.locator('.bank .count').all()) await expect(bank).toHaveText('0');
  });

  test('stones go one per hole counter-clockwise into your own bank, skipping the opponent\'s bank', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Alice's last pit holds 9: one to her bank, six around Bob's row, Bob's bank skipped, two into her row
    await table.patch({ board: boardOf([0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0]) });
    await myPit(alice, 5).click();
    await expect(count(myBank(alice))).toHaveText('1');
    for (let index = 0; index < 6; index++) await expect(count(theirPit(alice, index))).toHaveText('1');
    await expect(count(theirBank(alice))).toHaveText('0');
    await expect(count(myPit(alice, 0))).toHaveText('1');
    await expect(count(myPit(alice, 1))).toHaveText('1');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
  });

  test('a last stone in a pit that had stones picks them all up and keeps going', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // Pit 0's 2 stones end in pit 2, which had 1: those 2 go on to pits 3 and 4, and pit 4 was empty
    await table.patch({ board: boardOf([2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0]) });
    await myPit(alice, 0).click();
    await expect(alice.locator('.game-status')).toHaveText('Alice picked up 2 stones and kept going once, ending in an empty pit');
    for (const [index, stones] of [[0, '0'], [1, '1'], [2, '0'], [3, '1'], [4, '1']] as const) {
      await expect(count(myPit(alice, index))).toHaveText(stones);
    }
  });

  test('a last stone in your own bank gives you another turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await myPit(alice, 2).click(); // 4 stones from pit 2 end in bank 6
    await expect(count(myBank(alice))).toHaveText('1');
    await expect(alice.locator('.turn-message')).toHaveText('Your turn');
    await expect(bob.locator('.turn-message')).toHaveText("Alice's turn");
  });

  test('a last stone in an empty pit ends the turn, with no capture', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({ board: boardOf([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 0]) });
    await myPit(alice, 0).click();
    await expect(count(myPit(alice, 1))).toHaveText('1');
    await expect(count(theirPit(alice, 4))).toHaveText('5'); // the pit opposite keeps its stones
    await expect(count(myBank(alice))).toHaveText('0');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
  });

  test('once a row is empty after a turn, each side is swept into its own bank and the game ends', async ({ seat }) => {
    const { table, alice } = await start(seat, false, OTHER_SIDE_OFF);
    await table.patch({ board: boardOf([0, 0, 0, 0, 0, 1, 10, 2, 3, 0, 0, 0, 0, 5]) });
    await myPit(alice, 5).click();
    await expect(alice.locator('.turn-message')).toHaveText('Game over');
    await expect(count(myBank(alice))).toHaveText('11');
    await expect(count(theirBank(alice))).toHaveText('10');
    for (const pit of await alice.locator('.pit .count').all()) await expect(pit).toHaveText('0');
  });

  test('the most stones in the bank wins, and equal banks are a draw', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, false, OTHER_SIDE_OFF);
    await table.patch({ board: boardOf([0, 0, 0, 0, 0, 1, 10, 2, 3, 0, 0, 0, 0, 5]) });
    await myPit(alice, 5).click();
    await expect(bob.locator('.game-status')).toContainText('Alice wins');

    const draw = await seat('mancala', ['Cara', 'Dan'], { houseRules: OTHER_SIDE_OFF });
    await draw.patch({ board: boardOf([0, 0, 0, 0, 0, 1, 9, 2, 3, 0, 0, 0, 0, 5]) });
    await myPit(draw.pages[0], 5).click();
    await expect(draw.pages[1].locator('.game-status')).toContainText(/draw/i);
  });

  test('if a player leaves mid-game, the other player wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await myPit(alice, 0).click();
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(alice.locator('.game-status')).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo needs the other player\'s approval', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await myPit(alice, 2).click(); // into her bank, so it stays her turn
    await expect(count(myPit(alice, 2))).toHaveText('0');

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(count(myPit(alice, 2))).toHaveText('0');

    await undo(alice, bob);
    await expect(count(myPit(alice, 2))).toHaveText('4');
    await expect(alice.locator('.turn-message')).toHaveText('Your turn');
  });
});

test.describe('Mancala controls', () => {
  test('your row is along the bottom with your bank on the right, the opponent\'s on top and on the left', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await table.patch({ board: boardOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) });
    await expect(count(myPit(alice, 0))).toHaveText('1');
    await expect(count(myBank(alice))).toHaveText('7');
    await expect(count(theirBank(alice))).toHaveText('14');
    await expect(count(myPit(bob, 0))).toHaveText('8');
    await expect(count(myBank(bob))).toHaveText('14');
    await expect(count(theirPit(bob, 0))).toHaveText('1');
  });

  test('with Color-blind symbols on, each stone, bank and bank label shows a shape for its seat: Alice blue squares, Bob red circles', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch({ board: boardOf([2, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 1]) });
    await expect(count(myBank(alice))).toHaveText('3');
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    await expect(myPit(alice, 0).locator('.stone .color-symbol-square')).toHaveCount(2);
    await expect(myBank(alice).locator('.stone .color-symbol-square')).toHaveCount(3);
    await expect(myBank(alice).locator('.bank-symbol.color-symbol-square')).toHaveCount(1);
    await expect(theirBank(alice).locator('.stone .color-symbol-circle')).toHaveCount(1);
    await expect(theirBank(alice).locator('.bank-symbol.color-symbol-circle')).toHaveCount(1);
    await expect(alice.locator('.bank-label-right .color-symbol-square')).toHaveCount(1);
    await expect(alice.locator('.bank-label-left .color-symbol-circle')).toHaveCount(1);
    await setPreference(alice, 'Color-blind symbols', false);
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
  });

  test('arrows around the board show the counter-clockwise direction', async ({ seat }) => {
    const { alice } = await start(seat);
    await expect(alice.locator('.board-loop .arrow')).toHaveCount(6);
    await expect(alice.locator('.board-loop')).toHaveAttribute('title', 'Stones move counter-clockwise');
  });

  test('each bank is tinted in its owner\'s color and labeled with their name, or Your bank', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.bank-label-right')).toHaveText('Your bank');
    await expect(alice.locator('.bank-label-left')).toHaveText("Bob's bank");
    await expect(myBank(alice)).toHaveClass(/seat-1/);
    await expect(myBank(bob)).toHaveClass(/seat-2/);
  });

  test('the first player\'s stones are blue and the second\'s red, and stones keep their color as they move', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // Both rows keep stones after the move, so nothing is swept
    await table.patch({ board: boardOf([1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 3, 0]) });
    await myPit(alice, 5).click();
    const moved = theirPit(alice, 0).locator('.stone');
    await expect(moved).toHaveClass(/seat-1/); // Alice's stone now on Bob's side
    // A stone's color is its --seat, as #rrggbb
    const rgb = async (locator: typeof moved) => {
      const hex = (await locator.first().evaluate(element => getComputedStyle(element).getPropertyValue('--seat'))).trim();
      return [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
    };
    const blue = await rgb(moved);
    const red = await rgb(theirPit(alice, 5).locator('.stone'));
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(red[0]).toBeGreaterThan(red[2]);
    expect(await rgb(myBank(alice).locator('.stone'))).toEqual(blue);
  });

  test('a pit draws up to 18 stones, a bank all of them, and the counts are exact; bank totals show under the board', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch({ board: boardOf([25, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0, 0, 0, 0]) });
    await expect(myPit(alice, 0).locator('.stone')).toHaveCount(18);
    await expect(count(myPit(alice, 0))).toHaveText('25');
    await expect(myBank(alice).locator('.stone')).toHaveCount(30);
    await expect(alice.getByText('Banks: Alice 30 · Bob 0')).toBeVisible();
  });

  test('on your turn, clicking one of your outlined pits plays it', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.pit-bottom.playable')).toHaveCount(6);
    await expect(alice.locator('.pit-top.playable')).toHaveCount(0);
    await expect(bob.locator('.pit.playable')).toHaveCount(0);
    await myPit(alice, 2).click();
    await expect(count(myPit(alice, 2))).toHaveText('0');
  });

  test('a move animates the stones, and nothing animates with reduced motion', async ({ seat }) => {
    const animated = await start(seat, true);
    await myPit(animated.alice, 0).click();
    await expect.poll(() => animated.bob.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);

    const still = await start(seat);
    await myPit(still.alice, 2).click();
    await expect(count(theirPit(still.bob, 2))).toHaveText('0'); // Alice's move has reached Bob
    expect(await still.bob.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('the pit the last move started from has a dashed outline and the end of its chain a solid one', async ({ seat }) => {
    const { alice } = await start(seat);
    await myPit(alice, 0).click();
    await expect(myPit(alice, 0)).toHaveClass(/last-move-from/);
    await expect(myPit(alice, 4)).toHaveClass(/last-move-to/);
    const styles = await alice.evaluate(() => [
      getComputedStyle(document.querySelector('.last-move-from')!).outlineStyle,
      getComputedStyle(document.querySelector('.last-move-to')!).outlineStyle
    ]);
    expect(styles).toEqual(['dashed', 'solid']);
  });

  test('the board is dimmed when it is not your turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.board')).not.toHaveClass(/not-your-turn/);
    await expect(bob.locator('.board')).toHaveClass(/not-your-turn/);
  });

  test('the status describes the last turn and shows the final score', async ({ seat }) => {
    const { table, alice } = await start(seat, false, OTHER_SIDE_OFF);
    await myPit(alice, 0).click();
    await expect(alice.locator('.game-status')).toHaveText(/^Alice picked up 4 stones/);
    await table.patch({ board: boardOf([0, 0, 0, 0, 0, 1, 10, 2, 3, 0, 0, 0, 0, 5]), currentPlayer: 1 });
    await myPit(alice, 5).click();
    await expect(alice.locator('.game-status')).toContainText('11');
    await expect(alice.locator('.game-status')).toContainText('10');
  });

  test('clicking Undo asks the other player to undo the last turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await myPit(alice, 0).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('counter-clockwise');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Mancala house rules', () => {
  test('playing from the other side when yours is empty', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Alice's row is empty, so only Bob's non-empty pits are outlined for her: pit 12 holds 1 stone, which skips Bob's bank
    await table.patch({ board: boardOf([0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 1, 4]) });
    await expect(alice.locator('.pit-bottom.playable')).toHaveCount(0);
    await expect(alice.locator('.pit-top.playable')).toHaveCount(1);
    await theirPit(alice, 5).click();
    await expect(count(myPit(alice, 0))).toHaveText('1');
    await expect(count(theirBank(alice))).toHaveText('4');
    await expect(alice.locator('.game-status')).toHaveText("Alice picked up 1 stone from Bob's side, ending in an empty pit");
    // The game goes on: Bob's row is empty too, so he plays Alice's stone from her side
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
    await expect(bob.locator('.pit-top.playable')).toHaveCount(1);
    await expect(bob.locator('.pit-bottom.playable')).toHaveCount(0);
  });

  test('a Kalah capture', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, false, { avalanche: false });
    // Pit 0's one stone lands in empty pit 1, opposite Bob's pit 11 with 4 stones
    await table.patch({ board: boardOf([1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 3, 4, 0, 0]) });
    await myPit(alice, 0).click();
    await expect(count(myBank(alice))).toHaveText('5');
    await expect(count(myPit(alice, 1))).toHaveText('0');
    await expect(count(theirPit(alice, 4))).toHaveText('0');
    await expect(count(theirPit(alice, 3))).toHaveText('3');
    await expect(alice.locator('.game-status')).toHaveText('Alice picked up 1 stone, ending in an empty pit and capturing 5 stones');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
  });

  test('Kalah has no relays', async ({ seat }) => {
    const { table, alice } = await start(seat, false, { avalanche: false });
    await table.patch({ board: boardOf([2, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0]) });
    await myPit(alice, 0).click();
    await expect(count(myPit(alice, 2))).toHaveText('2');
    await expect(alice.locator('.game-status')).toHaveText('Alice picked up 2 stones, ending in a pit with stones');
  });

  test('with play from the other side on the game ends only when every pit is empty', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await table.patch({ board: boardOf([0, 0, 0, 0, 0, 1, 10, 2, 3, 0, 0, 0, 0, 5]) });
    await myPit(alice, 5).click(); // into her bank: her row is empty but Bob's is not
    await expect(alice.locator('.turn-message')).toHaveText('Your turn');
    await expect(alice.locator('.pit-top.playable')).toHaveCount(2);
  });

  test('the host can turn the rules off, and the FAQ explains them', async ({ seat }) => {
    const { alice } = await start(seat, false, { otherSide: false, avalanche: false });
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Can the rules be changed?');
    await expect(faq).toContainText('Kalah');
  });
});
