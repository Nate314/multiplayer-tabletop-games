import type { Page } from '@playwright/test';
import { expect, newPlayer, nameOf, test, type Seat } from './fixtures.ts';

// The rematch vote on the game-over screen, and the fresh lobby at the same game ID that follows it.

const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const vote = (page: Page) => page.locator('.rematch-vote');
const lobbyNames = (page: Page) => page.locator('.presence-player');
const ended = { isGameOver: true, currentPlayer: null, winners: [1], gameStatus: 'Alice wins!' };

async function finished(seat: Seat, gameType: string, names: string[]) {
  const table = await seat(gameType, names);
  await table.patch(ended);
  for (const page of table.pages) await expect(gameOver(page)).toBeVisible();
  return table;
}

test('Rematch opens a vote and everyone joining starts a new lobby at the same link', async ({ seat }) => {
  const table = await finished(seat, 'connectfour', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  await gameOver(alice).getByRole('button', { name: 'Rematch' }).click();
  await expect(gameOver(bob).locator('.rematch-vote')).toContainText('Alice wants a rematch');
  await expect(gameOver(bob).getByRole('button', { name: 'Rematch' })).toHaveCount(0);
  // The vote sits inside the dialog, so nothing covers its buttons (a trial click fails on a covered target)
  for (const width of [1280, 390, 320]) {
    await bob.setViewportSize({ width, height: 700 });
    for (const name of ['History', 'See the table', 'Back to games', 'Join']) {
      await gameOver(bob).getByRole('button', { name, exact: true }).click({ trial: true });
    }
  }
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  for (const page of [alice, bob]) {
    await expect(gameOver(page)).toHaveCount(0);
    await expect(vote(page)).toHaveCount(0);
    await expect(lobbyNames(page)).toContainText(['Alice', 'Bob']);
  }
  expect((await table.state<{ gameId: string; started: boolean }>())).toMatchObject({ gameId: table.gameId, started: false });
  // Like any lobby, the new one is not remembered for a rejoin, so a refresh goes quietly to the list
  await expect.poll(() => alice.evaluate(() => sessionStorage.getItem('multiplayer-tabletop-games:inGame'))).toBeNull();
  await alice.reload();
  await expect(alice.locator('.lobby-game').first()).toBeVisible();
  await expect(alice.locator('.lobby-error')).toHaveCount(0);
});

test('a player who drops goes back to the game list', async ({ seat }) => {
  const table = await finished(seat, 'yahtzee', ['Alice', 'Bob', 'Cara']);
  const [alice, bob, cara] = table.pages;
  await gameOver(alice).getByRole('button', { name: 'Rematch' }).click();
  await cara.getByRole('button', { name: 'Drop' }).click();
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(cara.locator('.lobby-game').first()).toBeVisible();
  await expect(cara.getByRole('button', { name: /Rejoin|Back to/ })).toHaveCount(0);
  for (const page of [alice, bob]) await expect(lobbyNames(page)).toHaveCount(2);
});

test('a player who does not answer can be removed', async ({ seat }) => {
  const table = await finished(seat, 'yahtzee', ['Alice', 'Bob', 'Cara']);
  const [alice, bob, cara] = table.pages;
  await gameOver(alice).getByRole('button', { name: 'Rematch' }).click();
  await gameOver(bob).getByRole('button', { name: 'Join', exact: true }).click();
  await alice.locator('.rematch-vote li', { hasText: 'Cara' }).getByRole('button', { name: 'Remove' }).click();
  // The target answers the rematch instead of voting on their own dismissal, and is not listed as a voter
  await expect(gameOver(cara).getByRole('button', { name: 'Join', exact: true })).toBeVisible();
  await expect(gameOver(cara).getByRole('button', { name: 'Drop' })).toBeVisible();
  await expect(cara.locator('.dismiss-vote')).toHaveCount(0);
  await expect(bob.locator('.dismiss-vote li')).toHaveCount(2);
  await expect(bob.locator('.dismiss-vote li', { hasText: 'Cara' })).toHaveCount(0);
  await bob.locator('.dismiss-vote').getByRole('button', { name: 'Approve' }).click(); // the lobby opens once the last seat answered
  await expect(cara.getByText('You left after the game')).toBeVisible();
  await expect(cara.getByRole('button', { name: /Rejoin/ })).toHaveCount(0);
  for (const page of [alice, bob]) {
    await expect(lobbyNames(page)).toHaveCount(2);
    await expect(lobbyNames(page).filter({ hasText: 'Cara' })).toHaveCount(0);
  }
});

test('a silent player cannot hold up a Remove, and can be removed too', async ({ seat }) => {
  const table = await finished(seat, 'yahtzee', ['Alice', 'Bob', 'Cara']);
  const [alice, bob, cara] = table.pages;
  await gameOver(cara).getByRole('button', { name: 'Rematch' }).click();
  // Bob is connected but has not answered, so Cara's Remove decides it at once
  await cara.locator('.rematch-vote li', { hasText: 'Alice' }).getByRole('button', { name: 'Remove' }).click();
  await expect(cara.locator('.rematch-vote li', { hasText: 'Alice' }).getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await expect(bob.locator('.dismiss-vote')).toHaveCount(0);
  await cara.locator('.rematch-vote li', { hasText: 'Bob' }).getByRole('button', { name: 'Remove' }).click();
  for (const page of [alice, bob]) await expect(page.getByText('You left after the game')).toBeVisible();
  // Cara alone is seated in the fresh lobby, where the house rules panel waits for players
  await expect(gameOver(cara)).toHaveCount(0);
  await expect(cara.locator('.house-rules-panel')).toBeVisible();
});

test('a spectator keeps watching and cannot vote', async ({ seat, browser, server }) => {
  const table = await finished(seat, 'connectfour', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  const dana = await newPlayer(browser, server);
  await dana.goto('/');
  await dana.locator('.lobby-game', { hasText: nameOf('connectfour') }).click();
  await dana.getByRole('button', { name: 'Spectator' }).click();
  await dana.getByLabel('Your name').fill('Dana');
  await dana.getByLabel('Game ID').fill(table.gameId);
  await dana.getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(gameOver(dana)).toBeVisible();
  await expect(gameOver(dana).getByRole('button', { name: 'Rematch' })).toHaveCount(0);
  await gameOver(alice).getByRole('button', { name: 'Rematch' }).click();
  await expect(vote(dana)).toContainText('Alice wants a rematch');
  await expect(vote(dana).getByRole('button')).toHaveCount(0);
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(vote(dana)).toHaveCount(0);
  await expect(dana.locator('.spectator-status')).toBeVisible();
  await expect(dana.getByRole('button', { name: 'Back to games' })).toBeVisible();
});

test('house rules carry over', async ({ seat }) => {
  const table = await seat('chess', ['Alice', 'Bob'], { houseRules: { clockMinutes: 5 } });
  const [alice, bob] = table.pages;
  await table.patch(ended);
  await gameOver(alice).getByRole('button', { name: 'Rematch' }).click();
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(alice.getByLabel('Clock', { exact: true })).toHaveValue('5');
  await expect(bob.getByLabel('Clock', { exact: true })).toHaveValue('5');
  await expect(bob.getByRole('button', { name: 'Agree', exact: true })).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Agree', exact: true })).toBeVisible();
});
