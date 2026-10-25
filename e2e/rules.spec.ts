import { expect, newPlayer, test } from './fixtures.ts';

async function chessJoinDialog(browser: Parameters<typeof newPlayer>[0], server: Parameters<typeof newPlayer>[1]) {
  const page = await newPlayer(browser, server);
  await page.goto('/');
  await page.locator('.lobby-game').filter({ has: page.locator('.lobby-game-name', { hasText: /^Chess$/ }) }).click();
  return page;
}

test('Rules in the join dialog shows the README, and switches to the FAQ and back', async ({ browser, server }) => {
  const page = await chessJoinDialog(browser, server);
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Chess rules' });
  await expect(dialog.getByRole('heading', { name: 'Differences from Wikipedia' })).toBeVisible();
  // The README's own title is dropped, since the dialog's title says it
  await expect(dialog.getByRole('heading', { name: 'Chess', exact: true })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'FAQ', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'FAQ', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByText('How do I join a game?')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Differences from Wikipedia' })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Differences from Wikipedia' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  // Escape closed only the rules, not the join dialog behind them
  await expect(page.getByRole('dialog', { name: 'Join Chess' })).toBeVisible();
});

test('links open on the web or on GitHub in a new tab, anchors and other schemes are text, and HTML stays text', async ({ browser, server }) => {
  const page = await chessJoinDialog(browser, server);
  await page.route('**/api/rules/chess', route => route.fulfill({
    contentType: 'text/markdown; charset=utf-8',
    body: '# Chess\n\nSee [the web](https://example.com/a_(b)), [the map](map.ts), [Catan](../catan/README.md) and [below](#rules), [bad](javascript:void(0)).\n\n<script>window.hacked = 1</script> <b>bold?</b>'
  }));
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Chess rules' });
  const web = dialog.getByRole('link', { name: 'the web' });
  await expect(web).toHaveAttribute('href', 'https://example.com/a_(b)');
  await expect(web).toHaveAttribute('target', '_blank');
  await expect(web).toHaveAttribute('rel', 'noreferrer');
  await expect(dialog.getByRole('link', { name: 'the map' }))
    .toHaveAttribute('href', 'https://github.com/Nate314/multiplayer-tabletop-games/blob/master/games/chess/map.ts');
  await expect(dialog.getByRole('link', { name: 'Catan' }))
    .toHaveAttribute('href', 'https://github.com/Nate314/multiplayer-tabletop-games/blob/master/games/catan/README.md');
  await expect(dialog.getByRole('link', { name: 'below' })).toHaveCount(0);
  await expect(dialog.getByText('below')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'bad' })).toHaveCount(0);
  await expect(dialog.getByText('<script>window.hacked = 1</script> <b>bold?</b>')).toBeVisible();
  expect(await page.evaluate(() => 'hacked' in window)).toBe(false);
});

test('when the README cannot load, Retry tries again and the FAQ still works', async ({ browser, server }) => {
  const page = await chessJoinDialog(browser, server);
  let fail = true;
  await page.route('**/api/rules/chess', route => (fail ? route.abort() : route.continue()));
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Chess rules' });
  await expect(dialog.getByText('Could not load the rules')).toBeVisible();

  await dialog.getByRole('button', { name: 'FAQ', exact: true }).click();
  await expect(dialog.getByText('How do I join a game?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Rules', exact: true }).click();

  fail = false;
  await dialog.getByRole('button', { name: 'Retry' }).click();
  await expect(dialog.getByRole('heading', { name: 'Differences from Wikipedia' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
});

test('the game header has Rules and no FAQ button', async ({ seat }) => {
  const { pages: [alice] } = await seat('chess', ['Alice', 'Bob']);
  const header = alice.locator('.game-header');
  await expect(header.getByRole('button', { name: 'FAQ' })).toHaveCount(0);
  await header.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(alice.getByRole('dialog', { name: 'Chess rules' }).getByRole('heading', { name: 'Controls' })).toBeVisible();
});
