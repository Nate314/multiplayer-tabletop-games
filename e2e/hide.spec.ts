import { test, expect, tableScreen, watch, headerButton } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { GAMES } from '../games/registry.ts';

const hideButton = (page: Page) => headerButton(page, 'Hide');
const showButton = (page: Page) => headerButton(page, 'Show');
const below = (page: Page) => page.locator('.game-root > :not(.game-header, .hidden-cover) :visible');

test('Hide covers the hand and everything below the header, and Show brings it back', async ({ seat }) => {
  const { pages: [alice, bob] } = await seat('uno', ['Alice', 'Bob']);
  const hand = alice.locator('.hand-cards');
  await expect(hand.getByRole('button')).toHaveCount(7);
  await hand.evaluate(element => { element.setAttribute('data-test-mark', ''); }); // proves no remount
  await (await hideButton(alice)).click();
  await expect(alice.locator('.game-root')).toHaveAttribute('data-hidden', '');
  await expect(hand).toBeHidden();
  await expect(below(alice)).toHaveCount(0);
  await expect(alice.getByRole('region', { name: 'Game hidden' })).toContainText('Open the menu (☰) and choose Show to see it again.');
  await expect(bob.locator('.hand-cards')).toBeVisible(); // only Alice's screen
  await (await showButton(alice)).click();
  await expect(alice.locator('.game-root')).not.toHaveAttribute('data-hidden');
  await expect(alice.locator('.hand-cards[data-test-mark]')).toBeVisible();
  await expect(alice.getByRole('region', { name: 'Game hidden' })).toHaveCount(0);
});

test('while hidden nothing can be clicked or reached with Tab', async ({ seat }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
  await (await hideButton(alice)).click();
  await expect(alice.getByRole('button', { name: 'Drop in column 1' })).toBeHidden();
  for (let i = 0; i < 15; i++) {
    await alice.keyboard.press('Tab');
    expect(await alice.evaluate(() => Boolean(document.activeElement?.closest('.game-root > :not(.game-header)')))).toBe(false);
  }
  await (await showButton(alice)).click();
  await alice.getByRole('button', { name: 'Drop in column 1' }).click(); // the screen works again
});

test('hiding and showing sends nothing to the server', async ({ seat }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
  await alice.getByRole('button', { name: 'Drop in column 1' }).click(); // a reload frees the seat until the game has started
  const sent: string[] = [];
  alice.on('websocket', socket => socket.on('framesent', frame => sent.push(String(frame.payload))));
  await alice.reload();
  await expect(await hideButton(alice)).toBeVisible();
  await alice.waitForTimeout(500); // the rejoin's own messages
  const before = sent.length;
  await (await hideButton(alice)).click();
  await (await showButton(alice)).click();
  await alice.waitForTimeout(500);
  expect(sent.length).toBe(before);
});

test('a spectator can hide, a table screen has no Hide', async ({ seat, browser, server }) => {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan']);
  const dana = await watch(browser, server, 'hearts', table.gameId, 'Dana');
  await (await hideButton(dana)).click();
  await expect(below(dana)).toHaveCount(0);
  const tv = await tableScreen(table);
  await expect(tv.locator('.hide-button')).toHaveCount(0);
});

test('History still opens while hidden', async ({ seat }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
  await alice.getByRole('button', { name: 'Drop in column 1' }).click();
  await (await hideButton(alice)).click();
  await (await headerButton(alice, 'History')).click();
  await expect(alice.getByRole('dialog', { name: 'History' })).toBeVisible();
});

for (const { info } of GAMES) {
  test(`${info.name}: on a phone the header is one row and the open menu fits`, async ({ seat }) => {
    const { pages: [alice] } = await seat(info.id, ['Alice', 'Bob', 'Cara', 'Dan'].slice(0, info.minPlayers));
    const header = alice.locator('.game-header');
    const menu = header.getByRole('button', { name: 'Menu', exact: true });
    const panel = header.locator('.game-menu-panel');
    for (const width of [390, 320]) {
      await alice.setViewportSize({ width, height: 700 });
      const middles = await Promise.all(['.back-button', 'h1', '.game-menu-button'].map(async selector => {
        const box = (await header.locator(selector).boundingBox())!;
        return box.y + box.height / 2;
      }));
      expect(Math.max(...middles) - Math.min(...middles), `header at ${width}px`).toBeLessThanOrEqual(4);
      expect(await header.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0); // the header only: In Order, Spite and Malice and Dominoes boards are wider than 320 px
      await menu.click();
      await expect(panel).toHaveCSS('opacity', '1'); // the opening animation has finished
      const rows = await panel.locator(':scope > :is(button, a, .share-wrapper)').evaluateAll(elements => elements.map(element => {
        const { left, right, top, bottom, height } = element.getBoundingClientRect();
        return { left, right, top, bottom, height };
      }));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.left, `row at ${width}px`).toBeGreaterThanOrEqual(0);
        expect(row.right, `row at ${width}px`).toBeLessThanOrEqual(width);
        expect(row.top, `row at ${width}px`).toBeGreaterThanOrEqual(0);
        expect(row.bottom, `row at ${width}px`).toBeLessThanOrEqual(700);
        expect(row.height, `row at ${width}px`).toBeGreaterThanOrEqual(40);
      }
      await alice.keyboard.press('Escape');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    }
  });
}
