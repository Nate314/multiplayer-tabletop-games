import type { Page } from '@playwright/test';
import { expect, seeTable, test, type Seat } from './fixtures.ts';

// The platform's game-over screen, the same in every game. Games are ended by crafting the finished state.

const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const rows = (page: Page) => gameOver(page).locator('.game-over-standings li');

// Connect Four after two discs, ended with `winners`
async function finishedConnectFour(seat: Seat, winners: number[]) {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  await alice.getByRole('button', { name: 'Drop in column 1' }).click();
  await bob.getByRole('button', { name: 'Drop in column 2' }).click();
  await table.patch({ isGameOver: true, currentPlayer: null, winners, gameStatus: winners.length ? 'Alice wins!' : 'Draw' });
  return { table, alice, bob };
}

test('the game-over screen names the winner, the game, its ID and length, and the standings', async ({ seat }) => {
  const { table, alice } = await finishedConnectFour(seat, [1]);
  const dialog = gameOver(alice);
  await expect(dialog.getByRole('heading')).toHaveText('Alice wins');
  const meta = dialog.locator('.game-over-meta');
  await expect(meta).toContainText('Connect Four');
  await expect(meta).toContainText(table.gameId);
  await expect(meta).toContainText('moves');
  await expect(rows(alice)).toHaveText(['1st Alice (you)', '2nd Bob']);
  for (const name of ['History', 'See the table', 'Back to games']) {
    await expect(dialog.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(dialog.getByRole('button', { name: 'Rematch' })).toBeVisible();
});

test('a draw says Draw', async ({ seat }) => {
  const { alice } = await finishedConnectFour(seat, []);
  await expect(gameOver(alice).getByRole('heading')).toHaveText('Draw');
  await expect(rows(alice)).toHaveText(['1st Alice (you)', '1st Bob']);
});

test("scores show in the game's own terms", async ({ seat }) => {
  const table = await seat('yahtzee', ['Alice', 'Bob']);
  const [alice] = table.pages;
  await table.patch({
    sheets: { 1: { chance: 30 }, 2: { chance: 20 } }, isGameOver: true, currentPlayer: null, winners: [1], gameStatus: 'Alice wins!'
  });
  await expect(rows(alice).locator('.standing-score')).toHaveText(['30 points', '20 points']);
});

test('See the table closes it and Game summary opens it again', async ({ seat }) => {
  const { alice } = await finishedConnectFour(seat, [1]);
  await gameOver(alice).getByRole('button', { name: 'See the table' }).click();
  await expect(gameOver(alice)).toHaveCount(0);
  await alice.getByRole('button', { name: 'Game summary' }).click();
  await expect(gameOver(alice)).toBeVisible();
  await alice.keyboard.press('Escape');
  await expect(gameOver(alice)).toHaveCount(0);
});

test('History opens above it and closing History returns to it', async ({ seat }) => {
  const { alice } = await finishedConnectFour(seat, [1]);
  await gameOver(alice).getByRole('button', { name: 'History' }).click();
  const history = alice.getByRole('dialog', { name: 'History' });
  await expect(history.locator('.history-slider')).toBeVisible();
  await history.getByRole('button', { name: 'Close' }).click(); // clickable, so History is on top
  await expect(history).toHaveCount(0);
  await expect(gameOver(alice)).toBeVisible();
  // Escape closes only History too
  await gameOver(alice).getByRole('button', { name: 'History' }).click();
  await expect(history.locator('.history-slider')).toBeVisible();
  await alice.keyboard.press('Escape');
  await expect(history).toHaveCount(0);
  await expect(gameOver(alice)).toBeVisible();
});

test('Back to games goes to the game list', async ({ seat }) => {
  const { alice } = await finishedConnectFour(seat, [1]);
  await gameOver(alice).getByRole('button', { name: 'Back to games' }).click();
  await expect(alice.locator('.lobby-game').first()).toBeVisible();
});

test('a game that ends again shows the screen again, not the Game summary button', async ({ seat }) => {
  const { table, alice } = await finishedConnectFour(seat, [1]);
  await gameOver(alice).getByRole('button', { name: 'See the table' }).click();
  await expect(alice.getByRole('button', { name: 'Game summary' })).toBeVisible();
  await table.patch({ isGameOver: false, currentPlayer: 1, winners: [], gameStatus: '' });
  await expect(alice.getByRole('button', { name: 'Game summary' })).toHaveCount(0);
  await table.patch({ isGameOver: true, currentPlayer: null, winners: [2], gameStatus: 'Bob wins!' });
  await expect(gameOver(alice)).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Game summary' })).toHaveCount(0);
});

test('every player sees it', async ({ seat }) => {
  const { bob } = await finishedConnectFour(seat, [1]);
  await expect(gameOver(bob).getByRole('heading')).toHaveText('Alice wins');
  await expect(rows(bob)).toHaveText(['1st Alice', '2nd Bob (you)']);
});

test('it steps aside while an undo vote runs, so the other player can answer, and returns after a decline', async ({ seat }) => {
  const { alice, bob } = await finishedConnectFour(seat, [1]);
  await seeTable(alice);
  await alice.getByRole('button', { name: 'Undo' }).click();
  await expect(bob.locator('.undo-vote')).toBeVisible();
  await expect(gameOver(bob)).toHaveCount(0);
  await expect(bob.getByRole('button', { name: 'Game summary' })).toHaveCount(0);
  await bob.getByRole('button', { name: 'Decline' }).click();
  await expect(gameOver(bob)).toBeVisible();
});
