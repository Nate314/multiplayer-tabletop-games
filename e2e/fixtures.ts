import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { GAMES } from '../games/registry.ts';

// The shared harness for the end-to-end rule tests.
// Each Playwright worker runs its own server with the test hooks on (server/e2e.ts), so a test's queued random numbers
// and crafted states never reach another test. Each player is a separate browser context, seated in join order.

type Server = { url: string };

export type Table = {
  gameType: string;
  gameId: string;
  pages: Page[]; // pages[0] is seat 1
  // The full server state, hidden cards included
  state<S>(): Promise<S>;
  // Merges `fields` over the server state and sends every player their new view
  patch(fields: object): Promise<void>;
  // The next numbers the server's random function returns, each in [0, 1); replaces any still queued
  random(...values: number[]): Promise<void>;
  // Queues six-sided die faces, as every game here rolls a die: Math.floor(random * 6) + 1
  dice(...faces: number[]): Promise<void>;
  // Seats one more player after the table was made, so a test can first queue the random numbers their join uses
  join(name: string): Promise<Page>;
};

// `motion: true` lets moves animate; by default every player asks for reduced motion, so nothing animates
export type SeatOptions = { gameId?: string; motion?: boolean };
export type Seat = (gameType: string, names: string[], options?: SeatOptions) => Promise<Table>;

let tableCount = 0;

export function nameOf(gameType: string): string {
  const game = GAMES.find(candidate => candidate.info.id === gameType);
  if (!game) throw new Error(`No game ${gameType}`);
  return game.info.name;
}

// Opens the site in `page` and joins `gameId` as `name` through the join dialog
export async function joinGame(page: Page, gameType: string, gameId: string, name: string): Promise<void> {
  await page.goto('/');
  await page.locator('.lobby-game').filter({ has: page.locator('.lobby-game-name', { hasText: new RegExp(`^${nameOf(gameType)}$`) }) }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Game ID').fill(gameId);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to games' })).toBeVisible();
}

export async function newPlayer(browser: Browser, server: Server, motion = false): Promise<Page> {
  const context = await browser.newContext({ baseURL: server.url, reducedMotion: motion ? 'no-preference' : 'reduce' });
  return context.newPage();
}

// The player's connection drops for good: their page closes and the server holds their seat
export async function leave(page: Page): Promise<void> {
  await page.context().close();
}

// `voters` start and approve a dismiss vote against `name`, who must have left
export async function dismiss(name: string, ...voters: Page[]): Promise<void> {
  const [first, ...rest] = voters;
  await first.locator('.presence-player', { hasText: name }).getByRole('button', { name: 'Dismiss' }).click();
  for (const voter of rest) await voter.getByRole('button', { name: 'Approve' }).click();
}

// `requester` asks to undo the last move and every one of `approvers` approves
export async function undo(requester: Page, ...approvers: Page[]): Promise<void> {
  await requester.getByRole('button', { name: 'Undo' }).click();
  for (const approver of approvers) await approver.getByRole('button', { name: 'Approve' }).click();
}

// Opens the FAQ from the game view and returns the dialog
export async function openFaq(page: Page) {
  await page.getByRole('button', { name: 'FAQ' }).click();
  return page.getByRole('dialog', { name: 'Frequently asked questions' });
}

export const test = base.extend<{ seat: Seat }, { server: Server }>({
  server: [async ({}, use, workerInfo) => {
    const port = Number(process.env.E2E_PORT_BASE ?? 4300) + workerInfo.workerIndex;
    const child = spawn(process.execPath, ['server/server.ts'], {
      env: { ...process.env, E2E: '1', PORT: String(port), DATABASE_PATH: ':memory:' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise<void>((resolve, reject) => {
      child.stdout.on('data', data => { if (String(data).includes('Server running')) resolve(); });
      child.on('exit', code => reject(new Error(`The test server exited with code ${code}`)));
    });
    await use({ url: `http://localhost:${port}` });
    child.kill();
  }, { scope: 'worker' }],

  seat: async ({ browser, server }, use) => {
    const pages: Page[] = [];
    await use(async (gameType, names, { gameId = `t${++tableCount}`, motion = false } = {}) => {
      const api = `${server.url}/api/e2e`;
      async function call(path: string, body?: unknown): Promise<unknown> {
        const response = await fetch(`${api}/${path}`, body === undefined ? {} : {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
        return response.json();
      }
      const seated: Page[] = [];
      for (const name of names) {
        const page = await newPlayer(browser, server, motion);
        pages.push(page);
        await joinGame(page, gameType, gameId, name);
        seated.push(page);
      }
      return {
        gameType,
        gameId,
        pages: seated,
        state: async <S>() => await call(`state/${gameType}/${gameId}`) as S,
        patch: async fields => { await call(`state/${gameType}/${gameId}`, fields); },
        random: async (...values) => { await call('random', { values }); },
        dice: async (...faces) => { await call('random', { values: faces.map(face => (face - 0.5) / 6) }); },
        join: async name => {
          const page = await newPlayer(browser, server, motion);
          pages.push(page);
          await joinGame(page, gameType, gameId, name);
          return page;
        }
      };
    });
    for (const page of pages) await page.context().close().catch(() => {}); // a test may have closed it already
  }
});

export { expect };
