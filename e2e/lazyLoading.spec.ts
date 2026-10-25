import type { Page } from '@playwright/test';
import { connectfour } from '../games/connectfour/index.ts';
import { buildGameFile } from '../shared/gameFile.ts';
import { test, expect, joinGame, newPlayer, openFaq } from './fixtures.ts';

// Each game's code is its own chunk, named after the game (vite.config.ts), downloaded only when that game is opened

// The JS and CSS files the page has asked for so far
function scriptsAndStyles(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', request => {
    const { pathname } = new URL(request.url());
    if (/\.(js|css)$/.test(pathname)) urls.push(pathname);
  });
  return urls;
}

const openDialog = (page: Page, name: string) =>
  page.locator('.lobby-game', { has: page.locator('.lobby-game-name', { hasText: new RegExp(`^${name}$`) }) }).click();

test('the landing page and a chess game download only chess, and opening Catan downloads Catan', async ({ browser, server }) => {
  const page = await newPlayer(browser, server);
  const urls = scriptsAndStyles(page);
  await joinGame(page, 'chess', 'lazy', 'Alice');
  expect(urls.some(url => url.includes('/chess-'))).toBe(true);
  expect(urls.filter(url => url.includes('catan'))).toEqual([]);
  await page.getByRole('button', { name: 'Back to games' }).click();
  await openDialog(page, 'Catan');
  await expect(page.getByRole('button', { name: 'FAQ' })).toBeVisible();
  expect(urls.some(url => /\/catan-.*\.js$/.test(url))).toBe(true);
  expect(urls.some(url => /\/catan-.*\.css$/.test(url))).toBe(true);
});

test('a failed download shows Could not load with Retry, and Retry loads the game', async ({ browser, server }) => {
  // page.route never sees what the service worker fetches, so this page runs without it
  const context = await browser.newContext({ baseURL: server.url, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  let failures = 0;
  await page.route(/\/assets\/connectfour-.*\.js$/, route => {
    if (failures++ === 0) return route.abort();
    return route.continue();
  });
  await page.goto('/');
  await openDialog(page, 'Connect Four');
  const dialog = page.getByRole('dialog', { name: 'Join Connect Four' });
  await expect(dialog.getByRole('alert')).toHaveText(/Could not load Connect Four/);
  await expect(dialog.getByRole('button', { name: 'FAQ' })).toHaveCount(0);
  await page.getByLabel('Your name').fill('Alice');
  await page.getByLabel('Game ID').fill('retry');
  // A fresh page, with the same dialog and form
  await dialog.getByRole('button', { name: 'Retry' }).click();
  await expect(dialog.getByRole('button', { name: 'FAQ' })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Your name')).toHaveValue('Alice');
  await expect(page.getByLabel('Game ID')).toHaveValue('retry');
  const faq = await openFaq(page);
  await expect(faq).toBeVisible();
  await faq.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to games' })).toBeVisible();
  await expect(page.locator('[data-game="connectfour"]').first()).toBeVisible();
});

test('a saved game opened on the landing page downloads its game first', async ({ browser, server }) => {
  const page = await newPlayer(browser, server);
  const urls = scriptsAndStyles(page);
  await page.goto('/');
  const start = { ...connectfour.toPublicState(connectfour.createGameState('saved'), false, null), moveCount: 0, historyStep: 'start' as const };
  const file = buildGameFile('connectfour', 'saved', [start], new Date());
  await page.locator('input[type="file"]').setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  const history = page.getByRole('dialog', { name: 'History' });
  await expect(history.getByRole('heading', { name: 'Saved game: saved' })).toBeVisible();
  await expect(history.getByText('Start of the game')).toBeVisible();
  expect(urls.some(url => url.includes('/connectfour-'))).toBe(true);
});

test('a refresh in the middle of a game downloads the game and shows it again', async ({ seat }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
  await alice.getByRole('button', { name: 'Drop in column 3' }).click();
  await expect(alice.locator('.turn-message')).toHaveText(/Bob/);
  await alice.reload();
  await expect(alice.getByRole('button', { name: 'Back to games' })).toBeVisible();
  await expect(alice.locator('.turn-message')).toHaveText(/Bob/);
});
