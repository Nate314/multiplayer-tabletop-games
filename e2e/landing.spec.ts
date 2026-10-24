import { test, expect, newPlayer } from './fixtures.ts';

async function landing(browser: Parameters<typeof newPlayer>[0], server: Parameters<typeof newPlayer>[1]) {
  const page = await newPlayer(browser, server);
  await page.goto('/');
  return { page, cards: page.locator('.lobby-game-name') };
}

test('search finds games by name or description', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  await page.getByLabel('Search games').fill('meeples');
  await expect(cards).toHaveText(['Carcassonne']);
  await page.getByLabel('Search games').fill('CONNECT FOUR');
  await expect(cards).toHaveText(['Connect Four']);
});

test('A to Z lists every game in one list without category headings', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  await page.getByLabel('Sort').selectOption('A to Z');
  await expect(page.locator('.lobby-category-heading')).toHaveCount(0);
  await expect(cards).toHaveCount(31);
  await expect(cards.first()).toHaveText('Azul');
  await expect(cards.last()).toHaveText('Yahtzee');
});

test('category chips show only the picked categories', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  const dice = page.getByRole('button', { name: 'Dice games' });
  await dice.click();
  await expect(cards).toHaveText(['Farkle', 'Yahtzee']);
  await expect(dice).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Tile games' }).click();
  await expect(cards).toHaveCount(7);
  await dice.click();
  await expect(cards).toHaveCount(5);
});

test('the players filter shows games that seat that many', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  await page.getByLabel('Players').fill('7');
  await expect(cards).toHaveCount(5);
  expect((await cards.allTextContents()).sort()).toEqual(['Farkle', 'Monopoly', "Texas Hold'em", 'UNO', 'Yahtzee']);
  await page.getByLabel('Players').fill('');
  await expect(cards).toHaveCount(31);
});

test('filters are remembered after a reload and Clear filters shows every game again', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  const search = page.getByLabel('Search games');
  await search.fill('zzz');
  await expect(page.getByText('No games match these filters')).toBeVisible();
  await page.reload();
  await expect(search).toHaveValue('zzz');
  await expect(page.getByText('No games match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(cards).toHaveCount(31);
  await expect(search).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
});

test('a join link opens its dialog even when a remembered search hides that game', async ({ browser, server }) => {
  const { page } = await landing(browser, server);
  await page.getByLabel('Search games').fill('zzz');
  await page.goto('/join/connectfour/abc');
  await expect(page.getByRole('dialog', { name: 'Join Connect Four' })).toBeVisible();
  await expect(page.getByText('No games match these filters')).toBeVisible();
});

test('wide windows show cards side by side and phones keep one column', async ({ browser, server }) => {
  const { page } = await landing(browser, server);
  const games = page.locator('.lobby-game');
  await page.setViewportSize({ width: 1280, height: 800 });
  const [first, second] = [await games.nth(0).boundingBox(), await games.nth(1).boundingBox()];
  expect(first!.y).toBe(second!.y);
  await page.setViewportSize({ width: 375, height: 667 });
  const list = await page.locator('.lobby-games').first().boundingBox();
  const cards = page.locator('.lobby-category').first().locator('.lobby-game');
  const ys = new Set<number>();
  for (let i = 0; i < await cards.count(); i++) {
    const box = (await cards.nth(i).boundingBox())!;
    ys.add(box.y);
    expect(Math.abs(box.width - list!.width)).toBeLessThanOrEqual(1);
  }
  expect(ys.size).toBe(await cards.count());
});
