import type { Page } from '@playwright/test';
import { agreeToHouseRules, expect, joinPassAndPlay, newPlayer, test } from './fixtures.ts';
import type { Card, GameState } from '../games/bingo/types.ts';

// Seat 1 calls first. Crafted cards hold c * 15 + row + offset in column c, so card(1) has 1, 16, 31, 46 and 61 on its top row
// and card(6) shares no number with it.

const card = (offset: number): Card =>
  Array.from({ length: 25 }, (_, index) => (index === 12 ? 0 : (index % 5) * 15 + Math.floor(index / 5) + offset));
const TOP_ROW = [1, 16, 31, 46, 61];
// The calls in order: the given numbers, then the rest
const poolOf = (...first: number[]) => [...first, ...Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !first.includes(n))];
const LETTERS = 'BINGO';
const squareName = (n: number) => `${LETTERS[Math.floor((n - 1) / 15)]} ${n}`;

const cards = (page: Page, name: string) => page.getByRole('region', { name: `${name}'s cards` });
const square = (page: Page, name: string, n: number) => cards(page, name).getByRole('button', { name: squareName(n), exact: true });
const callButton = (page: Page) => page.getByRole('button', { name: 'Call', exact: true });
const lastCall = (page: Page) => page.getByLabel('Last call');
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });

async function call(page: Page, n: number) {
  await callButton(page).click();
  await expect(lastCall(page)).toHaveText(squareName(n));
}

test.describe('Bingo', () => {
  test('two players call, mark and claim', async ({ seat }) => {
    const table = await seat('bingo', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await table.patch({ cards: { 1: [card(1)], 2: [card(6)] }, marks: { 1: [[]], 2: [[]] }, pool: poolOf(...TOP_ROW) });
    await expect(callButton(bob)).toBeDisabled();
    for (const [index, n] of TOP_ROW.entries()) {
      await call(index % 2 === 0 ? alice : bob, n);
      await expect(square(alice, 'Alice', n)).toHaveClass(/bingo-callable/);
      await square(alice, 'Alice', n).click();
      await expect(square(alice, 'Alice', n)).toHaveClass(/bingo-marked/);
    }
    await cards(alice, 'Alice').getByRole('button', { name: 'Bingo!' }).click();
    await expect(cards(bob, 'Alice')).toHaveCount(0); // each player sees only their own cards
    for (const page of [alice, bob]) await expect(gameOver(page).getByRole('heading')).toHaveText('Alice wins');
  });

  test('auto-call and auto-mark run the game', async ({ seat }) => {
    test.setTimeout(150_000);
    const table = await seat('bingo', ['Alice', 'Bob']);
    for (const page of table.pages) {
      await page.getByLabel('Auto-call').check();
      await page.getByLabel('Auto-mark').check();
    }
    await expect(gameOver(table.pages[0])).toBeVisible({ timeout: 120_000 });
    const state = await table.state<GameState>();
    expect(state.called.length).toBeLessThanOrEqual(75);
    expect(Object.keys(state.places).length).toBeGreaterThan(0);
  });

  test('auto-mark sends again a mark the server refused', async ({ seat }) => {
    const table = await seat('bingo', ['Alice', 'Bob']);
    const [alice] = table.pages;
    await table.patch({ cards: { 1: [card(1)], 2: [card(6)] }, marks: { 1: [[]], 2: [[]] }, pool: poolOf(...TOP_ROW) });
    await call(alice, 1); // started, so the reload below takes the seat back
    // Alice's first mark reaches the server pointing at a square that does not exist, so it is refused
    let forged = false;
    await alice.routeWebSocket(/./, ws => {
      const server = ws.connectToServer();
      ws.onMessage(message => {
        const data = JSON.parse(String(message));
        if (!forged && data.type === 'GAME_ACTION' && data.payload.action.type === 'mark') {
          forged = true;
          data.payload.action.square = 99;
          server.send(JSON.stringify(data));
        } else {
          server.send(message);
        }
      });
    });
    await alice.reload();
    await alice.getByLabel('Auto-mark').check();
    await expect(square(alice, 'Alice', 1)).toHaveClass(/bingo-marked/);
    expect(forged).toBe(true);
  });

  test('a false claim says Not a Bingo yet', async ({ seat }) => {
    const table = await seat('bingo', ['Alice', 'Bob']);
    const [alice] = table.pages;
    await call(alice, (await table.state<GameState>()).pool[0]);
    await cards(alice, 'Alice').getByRole('button', { name: 'Bingo!' }).click();
    await expect(alice.locator('.game-status')).toHaveText('Not a Bingo yet');
    await expect(gameOver(alice)).toHaveCount(0);
  });

  test('pass and play marks for each local player', async ({ seat, browser, server }) => {
    const table = await seat('bingo', [], { agree: false });
    const device = await newPlayer(browser, server);
    await joinPassAndPlay(device, 'bingo', table.gameId, ['Ann', 'Bo', 'Cy']);
    await agreeToHouseRules(device); // one Agree on the device agrees for all three
    // All three hold the same card, so one call lands on every card
    await table.patch({ cards: { 1: [card(1)], 2: [card(1)], 3: [card(1)] }, marks: { 1: [[]], 2: [[]], 3: [[]] }, pool: poolOf(...TOP_ROW) });
    for (const name of ['Ann', 'Bo', 'Cy']) await expect(cards(device, name)).toBeVisible();

    // A tap on Bo's card marks only Bo's
    await call(device, 1);
    await square(device, 'Bo', 1).click();
    await expect(square(device, 'Bo', 1)).toHaveClass(/bingo-marked/);
    for (const name of ['Ann', 'Cy']) await expect(square(device, name, 1)).toHaveClass(/bingo-callable/);
    expect((await table.state<GameState>()).marks).toEqual({ 1: [[]], 2: [[0]], 3: [[]] });

    // Auto-mark marks for every local player, and claims for each once their card has a line
    await device.getByLabel('Auto-mark').check();
    for (const name of ['Ann', 'Cy']) await expect(square(device, name, 1)).toHaveClass(/bingo-marked/);
    for (const n of TOP_ROW.slice(1)) {
      await call(device, n);
      for (const name of ['Ann', 'Bo', 'Cy']) await expect(square(device, name, n)).toHaveClass(/bingo-marked/);
    }
    await expect(gameOver(device).getByRole('heading')).toHaveText('Ann, Bo and Cy win');
    expect((await table.state<GameState>()).places).toEqual({ 1: 1, 2: 1, 3: 1 });
    await device.context().close();
  });

  test("a shared device's action names its seat", async ({ seat, browser, server }) => {
    const table = await seat('bingo', [], { agree: false });
    const page = await newPlayer(browser, server);
    await page.goto('/');
    // A bare shared-device socket. Each send is followed by a second JOIN_GAME, whose error closes the reply, so
    // the errors a message got are the ones before it
    const revision = await page.evaluate(gameId => new Promise<number>(resolve => {
      const ws = new WebSocket(`ws://${window.location.host}`);
      const replies: string[] = [];
      let waiting: ((errors: string[]) => void) | undefined;
      Object.assign(window, {
        sendOnDevice: (message: object) => new Promise<string[]>(done => {
          waiting = done;
          ws.send(JSON.stringify(message));
          ws.send(JSON.stringify({ type: 'JOIN_GAME' }));
        })
      });
      ws.onopen = () => ws.send(JSON.stringify({ type: 'JOIN_GAME', gameType: 'bingo', gameId, role: 'passAndPlay', playerNames: ['Ann', 'Bo'] }));
      ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'GAME_JOINED') resolve(message.payload.gameState.houseRules.revision);
        else if (message.type === 'GAME_ERROR') {
          replies.push(message.payload.message);
          if (message.payload.message === 'Already in a game' && waiting) {
            const done = waiting;
            waiting = undefined;
            done(replies.splice(0).slice(0, -1));
          }
        }
      };
    }), table.gameId);
    const act = (message: object) => page.evaluate(
      sent => (window as unknown as { sendOnDevice(message: object): Promise<string[]> }).sendOnDevice(sent), message
    );
    expect(await act({ type: 'AGREE_HOUSE_RULES', payload: { revision } })).toEqual([]);
    await table.patch({ cards: { 1: [card(1)], 2: [card(1)] }, marks: { 1: [[]], 2: [[]] }, pool: poolOf(...TOP_ROW) });

    expect(await act({ type: 'MAKE_MOVE', payload: { move: { type: 'call' }, seat: 1 } })).toEqual([]);
    expect((await table.state<GameState>()).called).toEqual([1]);
    expect(await act({ type: 'GAME_ACTION', payload: { action: { type: 'mark', card: 0, square: 0 }, seat: 2 } })).toEqual([]);
    expect((await table.state<GameState>()).marks).toEqual({ 1: [[]], 2: [[0]] });

    for (const wrong of [9, '2']) {
      const errors = await act({ type: 'GAME_ACTION', payload: { action: { type: 'mark', card: 0, square: 0 }, seat: wrong } });
      expect(errors).toEqual(["Not one of this device's players"]);
    }
    expect((await table.state<GameState>()).marks).toEqual({ 1: [[]], 2: [[0]] });
    // Bingo has no private hand, so every state shows a seat; hand the device back to be shown none, then name none
    expect(await act({ type: 'SHOW_SEAT', payload: { seat: null } })).toEqual([]);
    expect(await act({ type: 'GAME_ACTION', payload: { action: { type: 'mark', card: 0, square: 0 } } })).toEqual(['Pass the device first']);
    await page.context().close();
  });
});
