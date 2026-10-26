import type { Browser, Page } from '@playwright/test';
import { test, expect, joinGame, joinPassAndPlay, nameOf, newPlayer, tableScreen } from './fixtures.ts';

// The tests have no push service, so what they see is the page's own notification. Each page records every
// notification on window.__shown, whether made with new Notification or through the service worker, and fakes
// Notification.permission so the browser's prompt never shows. window.__hidden plays the tab being in the background.
type Shown = { title: string; body: string };
type Recorded = { __shown: Shown[]; __asked: number; __hidden: boolean };

async function record(page: Page, permission: NotificationPermission = 'granted'): Promise<void> {
  await page.addInitScript(permission => {
    const win = window as unknown as Recorded;
    win.__shown = [];
    win.__asked = 0;
    win.__hidden = false;
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => win.__hidden ? 'hidden' : 'visible' });
    class Recorder {
      static permission = permission;
      static requestPermission() {
        win.__asked++;
        return Promise.resolve(Recorder.permission);
      }
      onclick: unknown = null;
      constructor(title: string, options?: NotificationOptions) { win.__shown.push({ title, body: options?.body ?? '' }); }
    }
    (window as unknown as { Notification: unknown }).Notification = Recorder;
    ServiceWorkerRegistration.prototype.showNotification = async (title: string, options?: NotificationOptions) => {
      win.__shown.push({ title, body: options?.body ?? '' });
    };
    PushManager.prototype.subscribe = () => Promise.reject(new Error('No push service in the tests'));
  }, permission);
}

// Records on a page that is already in a started game: the reload rejoins it with the recorders in place (a reload in a
// lobby frees the seat)
async function recordSeated(page: Page): Promise<void> {
  await record(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Back to games' })).toBeVisible();
}

const shown = (page: Page) => page.evaluate(() => (window as unknown as Recorded).__shown.slice());

async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate(hidden => {
    (window as unknown as Recorded).__hidden = hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

const drop = (page: Page, column: number) => page.getByRole('button', { name: `Drop in column ${column}` }).click();

async function watch(browser: Browser, server: { url: string }, gameType: string, gameId: string, name: string): Promise<Page> {
  const page = await newPlayer(browser, server);
  await record(page);
  await page.goto('/');
  await page.locator('.lobby-game').filter({ has: page.locator('.lobby-game-name', { hasText: new RegExp(`^${nameOf(gameType)}$`) }) }).click();
  await page.getByRole('button', { name: 'Spectator' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Game ID').fill(gameId);
  await page.getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to games' })).toBeVisible();
  return page;
}

test.describe('Turn alerts', () => {
  test('the tab title follows the lobby, the turn and a vote', async ({ seat }) => {
    const table = await seat('connectfour', ['Alice'], { agree: false });
    const [alice] = table.pages;
    await expect(alice).toHaveTitle('Connect Four · 1 of 2 players');
    const bob = await table.join('Bob');
    await expect(bob).toHaveTitle('Connect Four · 2 of 2 players');
    await expect(alice).toHaveTitle('● Your turn · Connect Four · 2 of 2 players');
    await drop(alice, 1);
    await expect(bob).toHaveTitle('● Your turn · Connect Four · 2 players');
    await expect(alice).toHaveTitle('Connect Four · 2 players');
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob).toHaveTitle('● Vote · Connect Four · 2 players');
  });

  test('a spectator gets the plain title and no notifications', async ({ seat, browser, server }) => {
    const table = await seat('connectfour', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    const dana = await watch(browser, server, 'connectfour', table.gameId, 'Dana');
    const tv = await tableScreen(table);
    await setHidden(dana, true);
    await drop(alice, 1);
    await drop(bob, 2);
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob).toHaveTitle('● Vote · Connect Four · 2 players');
    for (const page of [dana, tv]) await expect(page).toHaveTitle('Connect Four · 2 players');
    expect(await shown(dana)).toEqual([]);
  });

  test('back to games restores the site title', async ({ seat }) => {
    const { pages: [alice], gameId } = await seat('connectfour', ['Alice', 'Bob']);
    await expect(alice).toHaveURL(`/?game=connectfour%2F${gameId}`);
    await alice.getByRole('button', { name: 'Back to games' }).click();
    await expect(alice).toHaveTitle('Multiplayer Tabletop Games');
    await expect(alice).toHaveURL('/');
  });

  test('a hidden page shows one notification when it becomes your turn and none while visible', async ({ seat, browser, server }) => {
    const table = await seat('connectfour', ['Alice']);
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    await record(bob);
    await joinGame(bob, 'connectfour', table.gameId, 'Bob');
    await setHidden(bob, true);
    await drop(alice, 1);
    await expect.poll(() => shown(bob)).toEqual([{ title: 'Your turn', body: `Connect Four · ${table.gameId}` }]);
    await setHidden(bob, false);
    await drop(bob, 2);
    await drop(alice, 3);
    await expect(bob).toHaveTitle('● Your turn · Connect Four · 2 players');
    expect(await shown(bob)).toHaveLength(1);
  });

  test('the join button asks for permission once and Settings can turn it off', async ({ browser, server }) => {
    const alice = await newPlayer(browser, server);
    await record(alice, 'default');
    await alice.goto('/');
    expect(await alice.evaluate(() => (window as unknown as Recorded).__asked)).toBe(0); // the landing page never asks
    await alice.locator('.lobby-game', { hasText: 'Connect Four' }).click();
    await alice.getByLabel('Your name').fill('Alice');
    await alice.getByLabel('Game ID').fill('alerts-ask');
    await alice.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Back to games' })).toBeVisible();
    expect(await alice.evaluate(() => (window as unknown as Recorded).__asked)).toBe(1);
    await alice.getByRole('button', { name: 'Settings' }).click();
    const box = alice.getByRole('dialog', { name: 'Settings' }).getByLabel('Notify me when it is my turn');
    await expect(box).toBeChecked();
    await box.click();
    await expect(box).not.toBeChecked();
    const saved = await alice.evaluate(() => JSON.parse(localStorage.getItem('preferences') ?? '{}'));
    expect(saved.notifications).toBe(false);
  });

  test('a hand request alerts the player it asks', async ({ seat, browser, server }) => {
    const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan']);
    const [alice, , cara] = table.pages;
    // The first pass starts the game, and a spectator can ask only after that
    const cards = cara.getByRole('region', { name: 'Your hand' }).locator('.playing-card');
    for (let slot = 0; slot < 3; slot++) await cards.nth(slot).click();
    await cara.getByRole('button', { name: /^Pass \d\/3$/ }).click();
    await recordSeated(alice);
    await setHidden(alice, true);
    const dana = await watch(browser, server, 'hearts', table.gameId, 'Dana');
    await dana.locator('.spectator-seats').getByRole('button', { name: 'Alice' }).click();
    await dana.getByRole('button', { name: "Ask to see Alice's hand" }).click();
    await expect.poll(() => shown(alice)).toEqual([{ title: 'A vote is waiting for you', body: `Hearts · ${table.gameId}` }]);
  });

  test('a shared device names the player whose turn it is', async ({ seat, browser, server }) => {
    const table = await seat('connectfour', [], { agree: false });
    const device = await newPlayer(browser, server);
    await record(device);
    await joinPassAndPlay(device, 'connectfour', table.gameId, ['Ann', 'Bo']);
    await setHidden(device, true);
    await drop(device, 1);
    await expect.poll(() => shown(device)).toEqual([{ title: 'Your turn, Bo', body: `Connect Four · ${table.gameId}` }]);
    await expect(device).toHaveTitle('● Your turn · Connect Four · 2 players');
  });
});
