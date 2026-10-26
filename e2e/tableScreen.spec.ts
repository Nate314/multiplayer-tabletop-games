import type { Browser, Page } from '@playwright/test';
import { expect, newPlayer, nameOf, test } from './fixtures.ts';

// A table screen joins as a spectator that only ever sees the table

async function showTable(browser: Browser, server: Parameters<typeof newPlayer>[1], gameType: string, gameId: string): Promise<Page> {
  const tv = await newPlayer(browser, server);
  await tv.goto('/');
  await tv.locator('.lobby-game', { hasText: nameOf(gameType) }).click();
  await tv.getByRole('button', { name: 'Table screen' }).click();
  await expect(tv.getByLabel('Your name')).toHaveCount(0);
  await tv.getByLabel('Game ID').fill(gameId);
  await tv.getByRole('button', { name: 'Show table', exact: true }).click();
  await expect(tv.getByRole('button', { name: 'Back to games' })).toBeVisible();
  return tv;
}

test('a table screen shows the QR code and link in the lobby', async ({ seat, browser, server }) => {
  const table = await seat('hearts', ['Alice']);
  const tv = await showTable(browser, server, 'hearts', table.gameId);
  await expect(tv.locator('.table-screen-qr svg')).toBeVisible();
  await expect(tv.locator('.table-screen-players li')).toHaveText(['Alice']);
  await expect(tv.locator('.table-screen-link')).toHaveText(new RegExp(`/join/hearts/${table.gameId}$`));
  await expect(table.pages[0].locator('.presence-watching')).toHaveText('Watching: Table screen');
});

test('the table screen shows the table and never a hand', async ({ seat, browser, server }) => {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan'], { agree: true });
  const tv = await showTable(browser, server, 'hearts', table.gameId);
  await table.patch({ started: true }); // Hearts starts at the first pass
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await expect(tv.locator('.hand')).toHaveCount(0);
  await expect(tv.locator('.spectator-seats')).toHaveCount(0);
  await expect(tv.getByRole('button', { name: /^Ask to see/ })).toHaveCount(0);
});

test('the table screen rejoins after a refresh', async ({ seat, browser, server }) => {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan'], { agree: true });
  const tv = await showTable(browser, server, 'hearts', table.gameId);
  await table.patch({ started: true });
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await tv.reload();
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await expect(tv.locator('.hand')).toHaveCount(0);
});

test('game over on the table screen has no Rematch', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  const tv = await showTable(browser, server, 'connectfour', table.gameId);
  await table.patch({ isGameOver: true, currentPlayer: null, winners: [1], gameStatus: 'Alice wins!' });
  const dialog = tv.getByRole('dialog', { name: 'Game over' });
  await expect(dialog.getByRole('button', { name: 'History', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Rematch' })).toHaveCount(0);
});
