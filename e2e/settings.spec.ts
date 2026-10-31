import { test, expect, newPlayer, setPreference } from './fixtures.ts';

test.describe('Settings', () => {
  test('the gear opens Settings from the landing page and the game header, every setting at its default', async ({ seat }) => {
    const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
    await alice.getByRole('button', { name: 'Settings' }).click();
    const dialog = alice.getByRole('dialog', { name: 'Settings' });
    await expect(dialog.getByLabel('Volume')).toHaveValue('50');
    await expect(dialog.getByLabel('Mute all')).not.toBeChecked();
    for (const label of ['Your turn chime', 'Moves', 'Dice', 'Game over', 'Timer warnings', 'Highlight newly drawn cards'])
      await expect(dialog.getByLabel(label)).toBeChecked();
    await expect(dialog.getByLabel('Color-blind symbols')).not.toBeChecked();
    await alice.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await alice.getByRole('button', { name: 'Back to games' }).click();
    await alice.getByRole('button', { name: 'Settings' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('a change is kept in this browser across a reload and does not change another player', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('connectfour', ['Alice', 'Bob']);
    await setPreference(alice, 'Color-blind symbols', true);
    await alice.reload();
    await alice.getByRole('button', { name: 'Settings' }).click();
    await expect(alice.getByLabel('Color-blind symbols')).toBeChecked();
    await bob.getByRole('button', { name: 'Settings' }).click();
    await expect(bob.getByLabel('Color-blind symbols')).not.toBeChecked();
  });

  test('the History gear has a Sounds option, off by default and kept for next time', async ({ seat }) => {
    const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
    await alice.getByRole('button', { name: 'Drop in column 1' }).click();
    await alice.getByRole('button', { name: 'History' }).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await history.getByRole('button', { name: 'Playback settings' }).click();
    const sounds = history.getByRole('group', { name: 'Playback settings' }).getByLabel('Sounds');
    await expect(sounds).not.toBeChecked();
    await sounds.check();
    await alice.getByRole('button', { name: 'Close' }).click();
    await alice.getByRole('button', { name: 'History' }).click();
    await history.getByRole('button', { name: 'Playback settings' }).click();
    await expect(sounds).toBeChecked();
  });
  test('on a phone the header fits one row, and Share and the theme toggle are in Settings', async ({ seat }) => {
    const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
    await alice.setViewportSize({ width: 375, height: 667 });
    const header = alice.locator('.game-header');
    await expect(header.getByRole('button', { name: 'Share' })).toBeHidden();
    await expect(header.getByRole('link', { name: /GitHub/ })).toBeHidden();
    const controls = header.locator(':scope > :not(h1):visible');
    await expect(controls).toHaveCount(4);
    const tops = await controls.evaluateAll(elements => elements.map(element => Math.round(element.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await header.getByRole('button', { name: 'Settings' }).click();
    const dialog = alice.getByRole('dialog', { name: 'Settings' });
    await expect(dialog.getByRole('button', { name: 'Share' })).toBeVisible();
    await dialog.getByRole('button', { name: /Switch to (dark|light) mode/ }).click();
    const theme = await alice.evaluate(() => document.documentElement.dataset.theme);
    await alice.keyboard.press('Escape');
    await alice.setViewportSize({ width: 1280, height: 800 });
    await expect(header.getByRole('button', { name: 'Share' })).toBeVisible();
    await expect(header.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` })).toBeVisible();
  });
  test('a theme saved before the storage prefix is kept and copied', async ({ browser, server }) => {
    const page = await newPlayer(browser, server);
    const stored = (key: string) => page.evaluate(k => localStorage.getItem(k), key);
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('theme', 'dark'); });
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    await expect.poll(() => stored('multiplayer-tabletop-games:theme')).toBe('dark');
    expect(await stored('theme')).toBe('dark');
    await page.getByRole('button', { name: 'Switch to light mode' }).first().click();
    expect(await stored('multiplayer-tabletop-games:theme')).toBe('light');
    expect(await stored('theme')).toBe('dark');
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  });
});
