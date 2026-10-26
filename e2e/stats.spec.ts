import type { Page } from '@playwright/test';
import { expect, seeTable, test, type Seat } from './fixtures.ts';

// Each browser context is one device. Alice and Bob finish a Connect Four game; Cara finishes one with a stranger.

// The first named player wins by four discs down column 1
async function finishConnectFour(seat: Seat, names: [string, string]) {
  const { pages: [first, second] } = await seat('connectfour', names);
  for (let turn = 0; turn < 3; turn++) {
    await first.getByRole('button', { name: 'Drop in column 1' }).click();
    await second.getByRole('button', { name: 'Drop in column 2' }).click();
  }
  await first.getByRole('button', { name: 'Drop in column 1' }).click();
  await expect(first.getByRole('dialog', { name: 'Game over' })).toBeVisible();
  await expect(second.getByRole('dialog', { name: 'Game over' })).toBeVisible();
  return [first, second];
}

const recentGames = (page: Page) => page.locator('.stats-recent li');
const deviceIdOf = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('deviceId') ?? 'null') as string);

async function openStats(page: Page) {
  await page.goto('/stats');
  await expect(page.locator('.stats-page')).toBeVisible();
}

test('stats show only games this device played', async ({ seat }) => {
  const [alice] = await finishConnectFour(seat, ['Alice', 'Bob']);
  await finishConnectFour(seat, ['Cara', 'Stranger']);
  await seeTable(alice);
  await alice.getByRole('button', { name: 'Back to games' }).click();
  await alice.locator('.lobby-actions').getByRole('link', { name: 'Stats' }).click();
  await expect(alice).toHaveURL(/\/stats$/);
  await expect(recentGames(alice)).toHaveCount(1);
  await expect(recentGames(alice)).toContainText('Connect Four');
  await expect(recentGames(alice)).toContainText('Alice');
  await expect(recentGames(alice)).toContainText('Bob');
  await expect(alice.locator('.stats-page')).not.toContainText('Stranger');
});

test('no stats request or page carries an ID', async ({ seat }) => {
  const [alice, bob] = await finishConnectFour(seat, ['Alice', 'Bob']);
  const [cara] = await finishConnectFour(seat, ['Cara', 'Stranger']);
  const ids = [await deviceIdOf(alice), await deviceIdOf(bob), await deviceIdOf(cara)];
  expect(ids.every(id => /^[0-9a-f]{32}$/.test(id))).toBe(true);
  const seen: { url: string; body: Promise<string> }[] = [];
  for (const page of [alice, cara]) {
    page.on('response', response => {
      if (new URL(response.url()).pathname.startsWith('/api/stats')) seen.push({ url: response.url(), body: response.text() });
    });
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/link/')) seen.push({ url: request.url(), body: Promise.resolve('') });
    });
  }
  await openStats(alice);
  await alice.getByRole('button', { name: 'Link another device' }).click();
  const code = await alice.locator('.stats-link-code').innerText();
  await cara.goto(`/link/${code}`);
  await cara.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(recentGames(cara)).toHaveCount(2);
  await alice.getByRole('button', { name: 'Clear my data' }).click();
  await alice.locator('.stats-clear').getByRole('button', { name: 'Clear my data' }).click();
  await expect(alice.getByText('No games yet')).toBeVisible();
  // stats, link-code, the link page, link, stats again, clear
  expect(seen.length).toBeGreaterThanOrEqual(6);
  for (const { url, body } of seen) {
    for (const id of ids) {
      expect(url).not.toContain(id);
      expect(await body).not.toContain(id);
    }
  }
});

test('clear replaces the ID and shows Former player to the other player', async ({ seat }) => {
  const [alice, bob] = await finishConnectFour(seat, ['Alice', 'Bob']);
  const before = await deviceIdOf(alice);
  await openStats(alice);
  await expect(recentGames(alice)).toHaveCount(1);
  await alice.getByRole('button', { name: 'Clear my data' }).click();
  const panel = alice.locator('.stats-clear');
  await expect(panel).toContainText('This removes you from 1 games on 1 devices. It cannot be undone.');
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(panel).toHaveCount(0);
  await alice.getByRole('button', { name: 'Clear my data' }).click();
  await panel.getByRole('button', { name: 'Clear my data' }).click();
  await expect(alice.getByText('No games yet')).toBeVisible();
  const after = await deviceIdOf(alice);
  expect(after).toMatch(/^[0-9a-f]{32}$/);
  expect(after).not.toBe(before);
  await alice.reload();
  await expect(alice.getByText('No games yet')).toBeVisible();
  await openStats(bob);
  await expect(recentGames(bob)).toContainText('Former player');
  await expect(recentGames(bob)).not.toContainText('Alice');
});

test('a link code merges a device', async ({ seat }) => {
  const [alice] = await finishConnectFour(seat, ['Alice', 'Bob']);
  const [cara] = await finishConnectFour(seat, ['Cara', 'Stranger']);
  await openStats(alice);
  await alice.getByRole('button', { name: 'Link another device' }).click();
  const panel = alice.locator('.stats-link');
  await expect(panel).toContainText('Open this link or enter the code on the other device. It works once, for 10 minutes.');
  const code = await panel.locator('.stats-link-code').innerText();
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
  await expect(panel.locator('.stats-link-url')).toHaveText(new RegExp(`/link/${code}$`));
  await expect(panel.locator('.stats-link-qr svg')).toBeVisible();
  await expect(panel.locator('.stats-link-countdown')).toContainText(/\d+:\d\d/);
  await cara.goto(`/link/${code}`);
  await expect(cara.getByText('Link this device?')).toBeVisible();
  await expect(cara.locator('.stats-page')).toContainText(code);
  await cara.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(recentGames(cara)).toHaveCount(2);
  await expect(recentGames(cara).filter({ hasText: 'Alice' })).toHaveCount(1);
  await cara.goto(`/link/${code}`);
  await cara.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(cara.getByText('That code has expired or was already used')).toBeVisible();
});

test('the recent game opens its History', async ({ seat }) => {
  const [alice] = await finishConnectFour(seat, ['Alice', 'Bob']);
  await openStats(alice);
  await recentGames(alice).getByRole('button', { name: 'History' }).click();
  const dialog = alice.getByRole('dialog', { name: 'History' });
  await expect(dialog.locator('.history-move')).toHaveText('Move 7 of 7: Alice dropped a disc in column 1');
  await dialog.getByRole('slider', { name: 'Step' }).fill('0');
  await expect(dialog.locator('.history-move')).toHaveText('Start of the game');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
});
