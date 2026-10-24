import { test, expect, newPlayer } from './fixtures.ts';

test('a join link opens the join dialog with the game ID and the last used name filled in', async ({ seat, browser, server }) => {
  const { gameId } = await seat('connectfour', ['Alice'], { gameId: 'Fri day #1' });
  const visitor = await newPlayer(browser, server);
  await visitor.goto('/');
  await visitor.evaluate(() => localStorage.setItem('joinForm', JSON.stringify({ playerName: 'Bob', gameId: 'other' })));
  await visitor.goto(`/join/connectfour/${encodeURIComponent(gameId)}`);
  const dialog = visitor.getByRole('dialog', { name: 'Join Connect Four' });
  await expect(dialog.getByLabel('Game ID')).toHaveValue('Fri day #1');
  await expect(dialog.getByLabel('Your name')).toHaveValue('Bob');
  await expect(visitor).toHaveURL(`${server.url}/`);
  await dialog.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(visitor.getByRole('button', { name: 'Back to games' })).toBeVisible();
});

test('a join link with an unknown game opens the landing page with no dialog', async ({ browser, server }) => {
  const visitor = await newPlayer(browser, server);
  await visitor.goto('/join/nope/abc');
  await expect(visitor.locator('.lobby-game')).toHaveCount(31);
  await expect(visitor.getByRole('dialog')).toHaveCount(0);
  await expect(visitor).toHaveURL(`${server.url}/`);
});

test('a join link to a started game still opens the dialog and a new name gets the server error', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  const visitor = await newPlayer(browser, server);
  await visitor.goto(`/join/connectfour/${encodeURIComponent(table.gameId)}`);
  const dialog = visitor.getByRole('dialog', { name: 'Join Connect Four' });
  await dialog.getByLabel('Your name').fill('Cara');
  await dialog.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(dialog.getByText('Game already in progress', { exact: true })).toBeVisible();
});

test('a link to another game wins over the automatic rejoin', async ({ seat }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  await alice.getByRole('button', { name: 'Drop in column 1' }).click();
  await bob.getByRole('button', { name: 'Drop in column 2' }).click();
  await bob.goto('/join/chess/xyz');
  const dialog = bob.getByRole('dialog', { name: 'Join Chess' });
  await expect(dialog.getByLabel('Game ID')).toHaveValue('xyz');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(bob.getByRole('button', { name: `Back to Connect Four (${table.gameId})` })).toBeVisible();
  await expect(alice.locator('.presence-player', { hasText: 'Bob' })).toBeVisible();
});
