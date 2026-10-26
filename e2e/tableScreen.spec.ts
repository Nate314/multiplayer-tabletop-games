import { expect, tableScreen, test } from './fixtures.ts';

// A table screen joins as a spectator that only ever sees the table

test('a table screen shows the QR code and link in the lobby', async ({ seat }) => {
  const table = await seat('hearts', ['Alice']);
  const tv = await tableScreen(table);
  await expect(tv.locator('.table-screen-qr svg')).toBeVisible();
  await expect(tv.locator('.table-screen-players li')).toHaveText(['Alice']);
  await expect(tv.locator('.table-screen-link')).toHaveText(new RegExp(`/join/hearts/${table.gameId}$`));
  await expect(table.pages[0].locator('.presence-watching')).toHaveText('Watching: Table screen');
});

test('the table screen shows the table and never a hand', async ({ seat }) => {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan'], { agree: true });
  const tv = await tableScreen(table);
  await table.patch({ started: true }); // Hearts starts at the first pass
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await expect(tv.locator('.hand')).toHaveCount(0);
  await expect(tv.locator('.spectator-seats')).toHaveCount(0);
  await expect(tv.getByRole('button', { name: /^Ask to see/ })).toHaveCount(0);
});

test('the table screen rejoins after a refresh', async ({ seat }) => {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan'], { agree: true });
  const tv = await tableScreen(table);
  await table.patch({ started: true });
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await tv.reload();
  await expect(tv.locator('.table-screen-board')).toBeVisible();
  await expect(tv.locator('.hand')).toHaveCount(0);
});

test('game over on the table screen has no Rematch', async ({ seat }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  const tv = await tableScreen(table);
  await table.patch({ isGameOver: true, currentPlayer: null, winners: [1], gameStatus: 'Alice wins!' });
  const dialog = tv.getByRole('dialog', { name: 'Game over' });
  await expect(dialog.getByRole('button', { name: 'History', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Rematch' })).toHaveCount(0);
});

test('phones get the switch only while a table screen is connected', async ({ seat }) => {
  const table = await seat('hearts', ['Alice']);
  const phone = table.pages[0];
  await expect(phone.locator('.layout-switch')).toHaveCount(0);
  await expect(phone.locator('.game-root[data-hand-only]')).toHaveCount(0);
  const tv = await tableScreen(table);
  await expect(phone.getByRole('button', { name: 'Hand only' })).toHaveAttribute('aria-pressed', 'true');
  await expect(phone.locator('.game-root[data-hand-only]')).toHaveCount(1);
  await tv.context().close();
  await expect(phone.locator('.layout-switch')).toHaveCount(0);
  await expect(phone.locator('.game-root[data-hand-only]')).toHaveCount(0);
});

test('the choice is remembered', async ({ seat }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const phone = table.pages[0];
  await phone.getByRole('button', { name: 'Drop in column 1' }).click(); // a refresh rejoins only once the game started
  await tableScreen(table);
  await phone.getByRole('button', { name: 'Board and hand' }).click();
  await expect(phone.locator('.game-root[data-hand-only]')).toHaveCount(0);
  await phone.reload();
  await expect(phone.getByRole('button', { name: 'Board and hand' })).toHaveAttribute('aria-pressed', 'true');
});
