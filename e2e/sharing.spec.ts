import { test, expect, newPlayer } from './fixtures.ts';

test('a join link opens the join dialog with the game ID and the last used name filled in', async ({ seat, browser, server }) => {
  const { gameId } = await seat('connectfour', ['Alice'], { gameId: 'Fri day #1' });
  const visitor = await newPlayer(browser, server);
  await visitor.goto('/');
  await visitor.evaluate(() => localStorage.setItem('multiplayer-tabletop-games:joinForm', JSON.stringify({ playerName: 'Bob', gameId: 'other' })));
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
  await expect(visitor.locator('.lobby-game')).toHaveCount(41);
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
  await expect(alice.locator('.presence-player[data-disconnected]', { hasText: 'Bob' })).toBeVisible();
});

test('share copies the join link and says so when there is no share sheet', async ({ seat, server }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice'], { gameId: 'Fri day #1' });
  await alice.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await alice.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await alice.getByRole('button', { name: 'Share' }).click();
  await expect(alice.getByRole('status')).toHaveText('Link copied');
  expect(await alice.evaluate(() => navigator.clipboard.readText())).toBe(`${server.url}/join/connectfour/Fri%20day%20%231`);
});

test('share opens the share sheet when there is one', async ({ seat, server }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice'], { gameId: 'Fri day #1' });
  await alice.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      value: async (data: ShareData) => { (window as unknown as { shared: ShareData }).shared = data; },
      configurable: true,
    });
  });
  await alice.getByRole('button', { name: 'Share' }).click();
  await expect.poll(() => alice.evaluate(() => (window as unknown as { shared?: ShareData }).shared?.url)).toBe(`${server.url}/join/connectfour/Fri%20day%20%231`);
  expect(await alice.evaluate(() => (window as unknown as { shared: ShareData }).shared.title)).toBe('Join Connect Four');
  await expect(alice.getByText('Link copied')).toHaveCount(0);
});

test('share falls back to a link to copy by hand when the clipboard fails', async ({ seat, server }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice'], { gameId: 'Fri day #1' });
  await alice.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
  });
  await alice.getByRole('button', { name: 'Share' }).click();
  await expect(alice.getByRole('textbox', { name: 'Game link' })).toHaveValue(`${server.url}/join/connectfour/Fri%20day%20%231`);
});

async function openManualPanel(seat: Parameters<Parameters<typeof test>[2]>[0]['seat']) {
  const { pages: [alice] } = await seat('connectfour', ['Alice'], { gameId: 'Fri day #1' });
  await alice.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
  });
  await alice.getByRole('button', { name: 'Share' }).click();
  const link = alice.getByRole('textbox', { name: 'Game link' });
  await expect(link).toBeVisible();
  return { alice, link };
}

test('the copy-by-hand panel closes when Share is pressed again', async ({ seat }) => {
  const { alice, link } = await openManualPanel(seat);
  await alice.getByRole('button', { name: 'Share' }).click();
  await expect(link).toHaveCount(0);
});

test('the copy-by-hand panel closes on a press outside it', async ({ seat }) => {
  const { alice, link } = await openManualPanel(seat);
  await link.click();
  await expect(link).toBeVisible();
  await alice.locator('.game-header h1').click();
  await expect(link).toHaveCount(0);
});

test('the copy-by-hand panel closes on Escape', async ({ seat }) => {
  const { alice, link } = await openManualPanel(seat);
  await alice.keyboard.press('Escape');
  await expect(link).toHaveCount(0);
});
