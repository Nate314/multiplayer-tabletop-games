import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, joinPassAndPlay, nameOf, newPlayer, openJoinDialog, test, type Seat } from './fixtures.ts';

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

// A phone has Pause in Settings, which closes so nothing is left over the vote or the paused screen
async function pauseFromSettings(page: Page, width = 390): Promise<void> {
  await page.setViewportSize({ width, height: 844 });
  await expect(pauseButton(page)).toBeHidden();
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

// Between the phone width and 680px only Pause moves into Settings, under no heading; Share and the theme stay in the header
test('a narrow tablet pauses from Settings while Share and the theme stay in the header', async ({ seat }) => {
  const [alice, bob] = (await started(seat)).pages;
  // Pause pushed the last buttons off screen here; narrower, the header overflows a little without it (not Pause's doing)
  await alice.setViewportSize({ width: 680, height: 844 });
  const rights = await alice.locator('.game-header > *').evaluateAll(items => items.map(item => item.getBoundingClientRect().right));
  for (const right of rights) expect(right).toBeLessThanOrEqual(680);
  await alice.setViewportSize({ width: 600, height: 844 });
  await expect(alice.locator('.game-header > .theme-toggle')).toBeVisible();
  await alice.getByRole('button', { name: 'Settings' }).click();
  const dialog = alice.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('heading', { name: 'Share and theme' })).toBeHidden();
  await expect(dialog.getByText('Share this game')).toBeHidden();
  await alice.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await pauseFromSettings(alice, 600);
  await expect(voteTitle(alice)).toHaveText('Alice wants to pause the game');
  await bob.getByRole('button', { name: 'Approve' }).click();
  await expect(paused(alice)).toBeVisible();
});

test('pausing from Settings on a phone closes Settings', async ({ seat }) => {
  const [alice, bob] = (await started(seat)).pages;
  await pauseFromSettings(alice);
  await expect(voteTitle(alice)).toHaveText('Alice wants to pause the game');
  await bob.getByRole('button', { name: 'Approve' }).click();
  await expect(paused(alice)).toBeVisible();
  await expect(alice.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
});

test('a pass and play phone pauses from Settings straight to the paused screen', async ({ seat, browser, server }) => {
  const table = await seat('uno', [], { agree: false });
  const device = await newPlayer(browser, server);
  await joinPassAndPlay(device, 'uno', table.gameId, ['Alice', 'Bob']);
  await table.patch({ started: true });
  await pauseFromSettings(device);
  await expect(paused(device)).toBeVisible();
  await device.context().close();
});

type PauseFileJson = { hand: unknown };
type UnoState = { currentPlayer: number; hands: unknown };

// Pauses Alice and Bob's game, has each download their file and go back to the games (so Alice has left before Bob
// downloads), then loses the room as a server restart would
async function lostGame(seat: Seat, server: { url: string }) {
  const table = await started(seat);
  const [alice, bob] = table.pages;
  await pauseAll(alice, bob);
  const before = await table.state<UnoState>();
  const files: string[] = [];
  for (const page of [alice, bob]) {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download my pause file' }).click();
    files.push(await (await downloading).path());
    await page.getByRole('button', { name: 'Back to games' }).click();
  }
  const response = await fetch(`${server.url}/api/e2e/room/uno/${table.gameId}`, { method: 'DELETE' });
  expect(response.ok).toBe(true);
  return { table, alice, bob, before, files };
}

async function resumeFrom(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Resume a game', exact: true }).click();
  await (await choosing).setFiles(file);
}

const waitingRoom = (page: Page) => page.locator('.resume-waiting');

test("a lost game resumes from everyone's files", async ({ seat, server }) => {
  const { table, alice, bob, before, files } = await lostGame(seat, server);
  await resumeFrom(alice, files[0]);
  await expect(waitingRoom(alice).getByRole('heading')).toHaveText(`Resuming ${nameOf('uno')} ${table.gameId}`);
  await expect(waitingRoom(alice).getByText('Alice: file in')).toBeVisible();
  await expect(waitingRoom(alice).getByText('Bob: waiting')).toBeVisible();
  await resumeFrom(bob, files[1]);
  for (const page of [alice, bob]) await expect(page.getByText('Everyone is here')).toBeVisible();
  await alice.getByRole('button', { name: 'Resume', exact: true }).click();
  for (const page of [alice, bob]) await expect(page.locator('.game-screen')).toBeVisible();
  const after = await table.state<UnoState>();
  expect(after.currentPlayer).toBe(before.currentPlayer);
  expect(after.hands).toEqual(before.hands);
});

test('a changed file is named in the waiting room', async ({ seat, server }) => {
  const { alice, bob, files } = await lostGame(seat, server);
  await resumeFrom(alice, files[0]);
  await expect(waitingRoom(alice).getByText('Bob: waiting')).toBeVisible();
  const changed = { ...JSON.parse(await readFile(files[1], 'utf8')) as PauseFileJson, hand: { edited: true } };
  await resumeFrom(bob, { name: 'bob.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(changed)) });
  await expect(bob.getByText("Bob's pause file does not match the others")).toBeVisible();
  await expect(waitingRoom(alice).getByText("Bob's pause file does not match the others")).toBeVisible();
  await expect(waitingRoom(alice).getByText('Bob: waiting')).toBeVisible();
});

test('joining by ID while files are awaited explains what to do', async ({ seat, server }) => {
  const { table, alice, bob, files } = await lostGame(seat, server);
  await resumeFrom(alice, files[0]);
  await expect(waitingRoom(alice).getByText('Bob: waiting')).toBeVisible();
  await openJoinDialog(bob, 'uno');
  await bob.getByLabel('Your name').fill('Bob');
  await bob.getByLabel('Game ID').fill(table.gameId);
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(bob.getByText('This game is waiting for its pause files. Choose Resume a game and upload yours')).toBeVisible();
});

test('a spectator sees the pause but no download',async ({ seat, browser, server }) => {
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
