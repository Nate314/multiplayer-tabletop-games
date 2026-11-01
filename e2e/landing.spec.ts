import { test, expect, newPlayer, openJoinDialog } from './fixtures.ts';

async function landing(browser: Parameters<typeof newPlayer>[0], server: Parameters<typeof newPlayer>[1]) {
  const page = await newPlayer(browser, server);
  await page.goto('/');
  return { page, cards: page.locator('.lobby-game-name') };
}

// Sort, category chips and Players live in the panel the Filter button opens
const openFilters = (page: Awaited<ReturnType<typeof newPlayer>>) => page.getByRole('button', { name: /^Filter/ }).click();

// A game's card on the landing page, by its exact name
const card = (page: Awaited<ReturnType<typeof newPlayer>>, name: string) =>
  page.locator('.lobby-game', { has: page.locator('.lobby-game-name', { hasText: new RegExp(`^${name}$`) }) });

test('search finds games by name or description', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  await page.getByLabel('Search games').fill('meeples');
  await expect(cards).toHaveText(['Carcassonne']);
  await page.getByLabel('Search games').fill('CONNECT FOUR');
  await expect(cards).toHaveText(['Connect Four']);
});

test('A to Z lists every game in one list without category headings', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  await openFilters(page);
  await page.getByLabel('Sort').selectOption('A to Z');
  await expect(page.locator('.lobby-category-heading')).toHaveCount(0);
  await expect(cards).toHaveCount(38);
  await expect(cards.first()).toHaveText('Azul');
  await expect(cards.last()).toHaveText('Yahtzee');
});

test('category chips show only the picked categories', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  await openFilters(page);
  const dice = page.getByRole('button', { name: 'Dice games' });
  await dice.click();
  await expect(cards).toHaveText(['Farkle', 'Yahtzee']);
  await expect(dice).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Tile games' }).click();
  await expect(cards).toHaveCount(7);
  await dice.click();
  await expect(cards).toHaveCount(5);
});

test('the players filter shows games that seat that many, marking those that need a house rule', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  await openFilters(page);
  await page.getByLabel('Players').fill('7');
  await expect(cards).toHaveCount(10);
  expect((await cards.allTextContents()).sort()).toEqual(['Farkle', 'Jenga', 'Monopoly', 'Phase 10', 'Pictionary', 'Rook', 'Sudoku', "Texas Hold'em", 'UNO', 'Yahtzee']);
  const marked = page.locator('.lobby-game', { has: page.locator('.lobby-game-house-rule') }).locator('.lobby-game-name');
  expect((await marked.allTextContents()).sort()).toEqual(['Phase 10', 'Rook']);
  await expect(card(page, 'Rook').locator('.lobby-game-house-rule')).toHaveText('7 with a house rule');
  await page.getByLabel('Players').fill('2');
  await expect(card(page, 'Catan').locator('.lobby-game-house-rule')).toHaveText('2 with a house rule');
  await page.getByLabel('Players').fill('');
  await expect(cards).toHaveCount(38);
});

test('typing a third digit or a zero in the players filter keeps the previous value', async ({ browser, server }) => {
  const { page } = await landing(browser, server);
  await openFilters(page);
  const players = page.getByLabel('Players');
  await players.pressSequentially('12');
  await players.press('3');
  await expect(players).toHaveValue('12');
  await players.fill('');
  await players.press('0');
  await expect(players).toHaveValue('');
  await players.press('5');
  await players.press('0');
  await expect(players).toHaveValue('50');
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
  await expect(cards).toHaveCount(38);
  await expect(search).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
});

test('the Filter button hides sort, chips and Players, and counts the filters it holds', async ({ browser, server }) => {
  const { page, cards } = await landing(browser, server);
  const filter = page.getByRole('button', { name: /^Filter/ });
  await expect(page.getByLabel('Sort')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dice games' })).toHaveCount(0);
  await expect(page.getByLabel('Players')).toHaveCount(0);
  await expect(filter).toHaveText('Filter');
  await expect(filter).toHaveAttribute('aria-expanded', 'false');
  await filter.click();
  await expect(filter).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Sort')).toBeFocused();
  await expect(page.getByLabel('Players')).toBeVisible();
  await page.getByRole('button', { name: 'Dice games' }).click();
  await expect(filter).toHaveText('Filter (1)');
  await expect(page.getByLabel('Sort')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Sort')).toHaveCount(0);
  await expect(filter).toBeFocused();
  await expect(filter).toHaveText('Filter (1)');
  await page.reload();
  await expect(filter).toHaveText('Filter (1)');
  await expect(cards).toHaveText(['Farkle', 'Yahtzee']);
  await page.getByLabel('Search games').fill('catan');
  await expect(page.getByText('No games match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(filter).toHaveText('Filter');
  await expect(cards).toHaveCount(38);
});

test('a press outside the Filter panel closes it', async ({ browser, server }) => {
  const { page } = await landing(browser, server);
  await openFilters(page);
  await expect(page.getByLabel('Sort')).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(page.getByLabel('Sort')).toHaveCount(0);
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

test('games happening now is absent without SHOW_OPEN_GAMES', async ({ browser, server, seat }) => {
  await seat('connectfour', ['Alice']);
  const page = await newPlayer(browser, server);
  await page.goto('/');
  await expect(page.locator('.lobby-game').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Games happening now' })).toHaveCount(0);
});

test('the lobby accent follows the OS accent color where the browser supports AccentColor', async ({ browser, server }) => {
  const { page } = await landing(browser, server);
  // Finds the @supports rule in the loaded stylesheets and reads the tokens it sets per selector
  const rules = await page.evaluate(() => {
    const found: Record<string, Record<string, string>> = {};
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSSupportsRule) || !rule.conditionText.includes('AccentColor')) continue;
        for (const inner of Array.from(rule.cssRules)) {
          if (!(inner instanceof CSSStyleRule)) continue;
          found[inner.selectorText] = Object.fromEntries(['--lobby-accent', '--lobby-accent-hover', '--lobby-accent-text']
            .map(name => [name, inner.style.getPropertyValue(name).trim()]));
        }
      }
    }
    return found;
  });
  expect(rules[':root']).toEqual({
    '--lobby-accent': 'AccentColor',
    '--lobby-accent-hover': 'color-mix(in srgb, AccentColor 80%, black)',
    '--lobby-accent-text': 'AccentColorText'
  });
  expect(rules[':root[data-theme="dark"]']).toEqual({
    '--lobby-accent': 'AccentColor',
    '--lobby-accent-hover': 'color-mix(in srgb, AccentColor 85%, white)',
    '--lobby-accent-text': 'AccentColorText'
  });
});

test('browsers without AccentColor keep the green accent in both themes', async ({ browser, server }) => {
  const { page } = await landing(browser, server);
  // A canary: Playwright's Chromium lacks AccentColor today; when an upgrade adds it, run this check in a browser that still lacks it
  expect(await page.evaluate(() => CSS.supports('color', 'AccentColor'))).toBe(false);
  await card(page, 'Connect Four').click();
  const join = page.locator('.lobby-button-primary');
  await expect(join).toHaveCSS('background-color', 'rgb(45, 106, 79)');
  await expect(join).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(join).toHaveCSS('background-color', 'rgb(63, 143, 107)');
  await expect(join).toHaveCSS('color', 'rgb(255, 255, 255)');
});

async function rowsOf(page: Awaited<ReturnType<typeof newPlayer>>): Promise<{ rows: number; widths: number[]; heights: number[] }> {
  const boxes = await page.getByRole('group', { name: 'Join as' }).getByRole('button').evaluateAll(
    (buttons) => buttons.map((b) => {
      const r = b.getBoundingClientRect();
      return { y: r.y, width: r.width, height: r.height };
    }),
  );
  return {
    rows: new Set(boxes.map((b) => Math.round(b.y))).size,
    widths: boxes.map((b) => b.width),
    heights: boxes.map((b) => b.height),
  };
}

test('the join choices sit in one row, two per row or one per row', async ({ browser, server }) => {
  const { page } = await landing(browser, server);
  const sizes = [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 700 }];
  for (const [game, rowCounts] of [['hearts', [1, 2, 4]], ['pictionary', [1, 2, 3]]] as const) {
    await page.setViewportSize(sizes[0]);
    await openJoinDialog(page, game);
    for (const [i, size] of sizes.entries()) {
      await page.setViewportSize(size);
      const { rows, widths, heights } = await rowsOf(page);
      expect(rows, `${game} rows at ${size.width}`).toBe(rowCounts[i]);
      for (const w of widths) expect(Math.abs(w - widths[0])).toBeLessThanOrEqual(1);
      for (const h of heights) expect(Math.abs(h - heights[0])).toBeLessThanOrEqual(1);
    }
  }
});
