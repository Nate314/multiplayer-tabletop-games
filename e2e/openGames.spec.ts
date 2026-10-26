import { test, expect, newPlayer } from './fixtures.ts';

test.use({ serverEnv: { SHOW_OPEN_GAMES: 'true' } });

const heading = (page: Awaited<ReturnType<typeof newPlayer>>) => page.getByRole('heading', { name: 'Games happening now' });

test('games happening now lists lobbies and games in progress', async ({ browser, server, seat }) => {
  const table = await seat('connectfour', ['Alice']);
  const page = await newPlayer(browser, server);
  await page.goto('/');
  await expect(heading(page)).toBeVisible();
  const entry = page.locator('.open-game', { hasText: `ID ${table.gameId}` });
  await expect(entry).toContainText('Alice in the lobby');
  const bob = await table.join('Bob');
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  await expect(entry).toContainText('Alice, Bob currently playing Connect Four', { timeout: 10_000 });
  await expect(bob.locator('.game-header')).toBeVisible();
});

test('tapping a game fills the join dialog', async ({ browser, server, seat }) => {
  const table = await seat('connectfour', ['Alice']);
  const page = await newPlayer(browser, server);
  await page.goto('/');
  await page.locator('.open-game', { hasText: `ID ${table.gameId}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Join Connect Four' });
  await expect(dialog.getByLabel('Game ID')).toHaveValue(table.gameId);
  await dialog.getByLabel('Your name').fill('Carol');
  await dialog.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to games' })).toBeVisible();
});

test('a finished game drops off the list', async ({ browser, server, seat }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const page = await newPlayer(browser, server);
  await page.goto('/');
  const entry = page.locator('.open-game', { hasText: `ID ${table.gameId}` });
  await expect(entry).toBeVisible();
  await table.patch({ isGameOver: true });
  await expect(entry).toHaveCount(0, { timeout: 10_000 });
  await expect(heading(page)).toHaveCount(0);
});

test('a long name wraps instead of scrolling sideways at 320 px', async ({ browser, server, seat }) => {
  await seat('connectfour', ['A'.repeat(20)]);
  const page = await newPlayer(browser, server);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.locator('.open-game').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('tapping a game in progress opens the dialog with Spectator picked', async ({ browser, server, seat }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  const page = await newPlayer(browser, server);
  await page.goto('/');
  await page.locator('.open-game', { hasText: `ID ${table.gameId}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Join Connect Four' });
  await expect(dialog.getByRole('button', { name: 'Spectator' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByLabel('Your name').fill('Cara');
  await dialog.getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(page.getByText('Watching: Cara')).toBeVisible();
});
