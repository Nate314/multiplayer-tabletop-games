import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, joinPassAndPlay, nameOf, newPlayer, test, type Seat } from './fixtures.ts';

// Alice is seat 1 and Bob seat 2. Every pause needs the whole table to agree, and the paused screen offers each
// player their own file

const pauseButton = (page: Page) => page.locator('.game-header').getByRole('button', { name: 'Pause', exact: true });
const voteTitle = (page: Page) => page.locator('.pause-vote-title');
const paused = (page: Page) => page.getByRole('heading', { name: 'Game paused' });

async function started(seat: Seat) {
  const table = await seat('uno', ['Alice', 'Bob']);
  await table.patch({ started: true });
  return table;
}

async function pauseAll(alice: Page, bob: Page): Promise<void> {
  await pauseButton(alice).click();
  for (const page of [alice, bob]) await expect(voteTitle(page)).toHaveText('Alice wants to pause the game');
  await bob.getByRole('button', { name: 'Approve' }).click();
  for (const page of [alice, bob]) await expect(paused(page)).toBeVisible();
}

test('everyone agrees to pause, each downloads a file, and Resume continues', async ({ seat }) => {
  const table = await started(seat);
  const [alice, bob] = table.pages;
  await pauseAll(alice, bob);
  for (const page of [alice, bob]) {
    await expect(page.getByText('Everyone is here')).toBeVisible();
    await expect(page.locator('.game-screen')).toHaveCount(0);
  }
  await expect(alice.getByText("Keep your pause file. If the server loses this game, everyone's files together bring it back.")).toBeVisible();
  const downloading = alice.waitForEvent('download');
  await alice.getByRole('button', { name: 'Download my pause file' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`uno-${table.gameId}-Alice-paused.json`);
  const file = JSON.parse(await readFile(await download.path(), 'utf8')) as { seat: number };
  expect(file.seat).toBe(1);
  await bob.getByRole('button', { name: 'Resume', exact: true }).click();
  for (const page of [alice, bob]) {
    await expect(page.locator('.game-screen')).toBeVisible();
    await expect(page.getByText('Play resumed')).toBeVisible();
    await expect(pauseButton(page)).toBeEnabled();
  }
});

test('a declined pause leaves the game running', async ({ seat }) => {
  const [alice, bob] = (await started(seat)).pages;
  await pauseButton(alice).click();
  await expect(voteTitle(bob)).toHaveText('Alice wants to pause the game');
  await bob.getByRole('button', { name: 'Decline' }).click();
  for (const page of [alice, bob]) {
    await expect(page.getByText('Bob declined to pause')).toBeVisible();
    await expect(voteTitle(page)).toHaveCount(0);
    await expect(paused(page)).toHaveCount(0);
    await expect(page.locator('.game-screen')).toBeVisible();
  }
});

test('a paused game waits for a missing player', async ({ seat }) => {
  const table = await started(seat);
  const [alice, bob] = table.pages;
  await pauseAll(alice, bob);
  await bob.getByRole('button', { name: 'Back to games' }).click();
  await expect(alice.getByText('Waiting for Bob', { exact: true })).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
  await bob.getByRole('button', { name: `Back to ${nameOf('uno')} (${table.gameId})` }).click();
  await expect(paused(bob)).toBeVisible();
  await expect(alice.getByText('Everyone is here')).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
});

test('a pass and play device pauses for every seat it holds', async ({ seat, browser, server }) => {
  const table = await seat('uno', [], { agree: false });
  const device = await newPlayer(browser, server);
  await joinPassAndPlay(device, 'uno', table.gameId, ['Alice', 'Bob']);
  await table.patch({ started: true });
  await pauseButton(device).click();
  await expect(paused(device)).toBeVisible();
  await expect(device.getByRole('button', { name: "Download Alice's pause file" })).toBeVisible();
  await expect(device.getByRole('button', { name: "Download Bob's pause file" })).toBeVisible();
  await expect(device.getByRole('button', { name: 'Download my pause file' })).toHaveCount(0);
  await device.context().close();
});

test('a spectator sees the pause but no download', async ({ seat, browser, server }) => {
  const table = await started(seat);
  const [alice, bob] = table.pages;
  const cara = await newPlayer(browser, server);
  await cara.goto('/');
  await cara.locator('.lobby-game').filter({ has: cara.locator('.lobby-game-name', { hasText: new RegExp(`^${nameOf('uno')}$`) }) }).click();
  await cara.getByRole('button', { name: 'Spectator' }).click();
  await cara.getByLabel('Your name').fill('Cara');
  await cara.getByLabel('Game ID').fill(table.gameId);
  await cara.getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(cara.getByRole('button', { name: 'Back to games' })).toBeVisible();
  await expect(pauseButton(cara)).toHaveCount(0);
  await pauseButton(alice).click();
  await expect(voteTitle(cara)).toHaveText('Alice wants to pause the game');
  await expect(cara.locator('.pause-vote').getByRole('button')).toHaveCount(0);
  await bob.getByRole('button', { name: 'Approve' }).click();
  await expect(paused(cara)).toBeVisible();
  await expect(cara.getByText('Everyone is here')).toBeVisible();
  await expect(cara.getByRole('button', { name: /pause file/ })).toHaveCount(0);
  await expect(cara.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
  await expect(cara.getByText(/Keep your pause file/)).toHaveCount(0);
  await cara.context().close();
});
