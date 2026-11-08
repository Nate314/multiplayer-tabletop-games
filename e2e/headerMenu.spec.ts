import { test, expect, headerButton, agreeToHouseRules } from './fixtures.ts';
import type { Page } from '@playwright/test';

const menuOf = (page: Page) => page.locator('.game-header').getByRole('button', { name: 'Menu', exact: true });
const panelOf = (page: Page) => page.locator('.game-menu-panel');

// Each button's and link's accessible name, in order (every control here is named by aria-label or its text)
const names = (page: Page) => panelOf(page).locator('button, a').evaluateAll(elements =>
  elements.map(element => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''));

test('the header shows Back to games, the title and a closed Menu button', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
  const children = await alice.locator('.game-header > *').evaluateAll(elements =>
    elements.filter(element => element.checkVisibility()).map(element => element.tagName === 'H1' ? 'h1' : `.${element.className}`));
  expect(children).toEqual(['.back-button', 'h1', '.game-menu']);
  const menu = menuOf(alice);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toHaveAttribute('aria-controls', (await panelOf(alice).getAttribute('id'))!);
  await expect(panelOf(alice)).toBeHidden();
});

test('Menu lists the controls in order, with labels, the same on a phone and a laptop', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
  await alice.getByRole('button', { name: 'Drop in column 1' }).click();
  for (const width of [1280, 390]) {
    await alice.setViewportSize({ width, height: 800 });
    await menuOf(alice).click();
    const panel = panelOf(alice);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    const theme = await alice.evaluate(() => document.documentElement.dataset.theme);
    const next = theme === 'dark' ? 'light' : 'dark';
    expect(await names(alice)).toEqual(['History', 'Share', 'Rules', 'Hide', 'Pause', 'Settings', 'View source on GitHub', `Switch to ${next} mode`]);
    for (const text of ['Share', 'Hide', 'Settings', 'GitHub', next === 'dark' ? 'Dark mode' : 'Light mode']) await expect(panel).toContainText(text);
    await expect.poll(async () => {
      const box = (await panel.boundingBox())!;
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 800;
    }).toBe(true);
    await menuOf(alice).click();
    await expect(menuOf(alice)).toHaveAttribute('aria-expanded', 'false');
  }
});

test('Pause is listed only once play has started', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
  await menuOf(alice).click();
  await expect(panelOf(alice)).toBeVisible();
  expect(await names(alice)).not.toContain('Pause');
});

test('a second press, a press outside, Escape and choosing a control each close the menu', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
  const menu = menuOf(alice);
  const focusInPanel = () => alice.evaluate(() => document.querySelector('.game-menu-panel')!.contains(document.activeElement));

  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(focusInPanel).toBe(true);
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await alice.locator('.game-header h1').click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  await menu.click();
  await expect.poll(focusInPanel).toBe(true);
  await alice.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();

  await (await headerButton(alice, 'History')).click();
  await expect(alice.getByRole('dialog', { name: 'History' })).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('Share keeps the menu open to show Link copied', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
  await alice.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await alice.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await (await headerButton(alice, 'Share')).click();
  await expect(panelOf(alice).getByRole('status')).toHaveText('Link copied');
  await expect(menuOf(alice)).toHaveAttribute('aria-expanded', 'true');
});

test('Rules and Settings chosen from the menu stay open while hidden and before agreement', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob'], { houseRules: { turnTimer: 30 }, agree: false });
  await (await headerButton(alice, 'Rules')).click();
  const rules = alice.getByRole('dialog', { name: 'Four in a Row rules' });
  await expect(rules).toBeVisible();
  await expect(menuOf(alice)).toHaveAttribute('aria-expanded', 'false');
  await expect(rules.locator('xpath=ancestor::header[contains(@class, "game-header")]')).toHaveCount(1);
  await alice.keyboard.press('Escape');
  await expect(rules).toHaveCount(0);
  await (await headerButton(alice, 'Hide')).click();
  await (await headerButton(alice, 'Settings')).click();
  await expect(alice.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});

test('the Menu button shows a dot while the house rules need this player, and Rules keeps its own', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob'], { houseRules: { turnTimer: 30 }, agree: false });
  const menu = menuOf(alice);
  await expect(menu).toHaveAttribute('data-attention', '');
  await menu.click();
  await expect(panelOf(alice).locator('.rules-button')).toHaveAttribute('data-attention', '');
  await menu.click();
  await agreeToHouseRules(alice);
  await expect(menu).not.toHaveAttribute('data-attention');
  await expect(panelOf(alice).locator('.rules-button')).not.toHaveAttribute('data-attention');
});

test('Hide shows its state in the menu', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
  await (await headerButton(alice, 'Hide')).click();
  await menuOf(alice).click();
  await expect(panelOf(alice).getByRole('button', { name: 'Show', exact: true })).toHaveText('Show');
  await expect(alice.getByRole('region', { name: 'Game hidden' })).toContainText('Open the menu (☰) and choose Show to see it again.');
});

test('Settings has no Share and theme section', async ({ seat }) => {
  const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
  await alice.setViewportSize({ width: 390, height: 800 });
  await (await headerButton(alice, 'Settings')).click();
  const dialog = alice.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Share and theme' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Share' })).toHaveCount(0);
});

test('the menu animates, and not with reduced motion', async ({ seat }) => {
  const { pages: [moving] } = await seat('fourinarow', ['Alice', 'Bob'], { motion: true });
  expect(await panelOf(moving).evaluate(element => getComputedStyle(element).transitionDuration)).toContain('0.15s');
  const { pages: [still] } = await seat('fourinarow', ['Carol', 'Dan']);
  expect(await panelOf(still).evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
});
