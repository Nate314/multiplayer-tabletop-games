import { test, expect, tableScreen, watch } from './fixtures.ts';
import type { Page } from '@playwright/test';

const hideButton = (page: Page) => page.locator('.game-header').getByRole('button', { name: 'Hide', exact: true });
const showButton = (page: Page) => page.locator('.game-header').getByRole('button', { name: 'Show', exact: true });
const below = (page: Page) => page.locator('.game-root > :not(.game-header, .hidden-cover) :visible');

test('Hide covers the hand and everything below the header, and Show brings it back', async ({ seat }) => {
  const { pages: [alice, bob] } = await seat('uno', ['Alice', 'Bob']);
  const hand = alice.locator('.hand-cards');
  await expect(hand.getByRole('button')).toHaveCount(7);
  await hand.evaluate(element => { element.setAttribute('data-test-mark', ''); }); // proves no remount
  await hideButton(alice).click();
  await expect(alice.locator('.game-root')).toHaveAttribute('data-hidden', '');
  await expect(hand).toBeHidden();
  await expect(below(alice)).toHaveCount(0);
  await expect(alice.getByRole('region', { name: 'Game hidden' })).toContainText('Press the eye button above to show it again.');
  await expect(bob.locator('.hand-cards')).toBeVisible(); // only Alice's screen
  await showButton(alice).click();
  await expect(alice.locator('.game-root')).not.toHaveAttribute('data-hidden');
  await expect(alice.locator('.hand-cards[data-test-mark]')).toBeVisible();
  await expect(alice.getByRole('region', { name: 'Game hidden' })).toHaveCount(0);
});

test('while hidden nothing can be clicked or reached with Tab', async ({ seat }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
  await hideButton(alice).click();
  await expect(alice.getByRole('button', { name: 'Drop in column 1' })).toBeHidden();
  for (let i = 0; i < 15; i++) {
    await alice.keyboard.press('Tab');
    expect(await alice.evaluate(() => Boolean(document.activeElement?.closest('.game-root > :not(.game-header)')))).toBe(false);
  }
  await showButton(alice).click();
  await alice.getByRole('button', { name: 'Drop in column 1' }).click(); // the screen works again
});

test('hiding and showing sends nothing to the server', async ({ seat }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
  await alice.getByRole('button', { name: 'Drop in column 1' }).click(); // a reload frees the seat until the game has started
  const sent: string[] = [];
  alice.on('websocket', socket => socket.on('framesent', frame => sent.push(String(frame.payload))));
  await alice.reload();
  await expect(hideButton(alice)).toBeVisible();
  await alice.waitForTimeout(500); // the rejoin's own messages
  const before = sent.length;
  await hideButton(alice).click();
  await showButton(alice).click();
  await alice.waitForTimeout(500);
  expect(sent.length).toBe(before);
});

test('a spectator can hide, a table screen has no Hide', async ({ seat, browser, server }) => {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan']);
  const dana = await watch(browser, server, 'hearts', table.gameId, 'Dana');
  await hideButton(dana).click();
  await expect(below(dana)).toHaveCount(0);
  const tv = await tableScreen(table);
  await expect(tv.locator('.hide-button')).toHaveCount(0);
});

test('History still opens while hidden', async ({ seat }) => {
  const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
  await alice.getByRole('button', { name: 'Drop in column 1' }).click();
  await hideButton(alice).click();
  await alice.getByRole('button', { name: 'History' }).click();
  await expect(alice.getByRole('dialog', { name: 'History' })).toBeVisible();
});
