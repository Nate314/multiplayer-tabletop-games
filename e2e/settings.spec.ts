import { test, expect, newPlayer, setPreference, headerButton } from './fixtures.ts';

test.describe('Settings', () => {
  test('the gear opens Settings from the landing page and the game header, every setting at its default', async ({ seat }) => {
    const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
    await (await headerButton(alice, 'Settings')).click();
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
    const { pages: [alice, bob] } = await seat('fourinarow', ['Alice', 'Bob']);
    await setPreference(alice, 'Color-blind symbols', true);
    await alice.reload();
    await alice.getByRole('button', { name: 'Settings' }).click(); // before the first move a reload frees the seat, so this is the landing page's gear
    await expect(alice.getByLabel('Color-blind symbols')).toBeChecked();
    await (await headerButton(bob, 'Settings')).click();
    await expect(bob.getByLabel('Color-blind symbols')).not.toBeChecked();
  });

  test('the History gear has a Sounds option, off by default and kept for next time', async ({ seat }) => {
    const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
    await alice.getByRole('button', { name: 'Drop in column 1' }).click();
    await (await headerButton(alice, 'History')).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await history.getByRole('button', { name: 'Playback settings' }).click();
    const sounds = history.getByRole('group', { name: 'Playback settings' }).getByLabel('Sounds');
    await expect(sounds).not.toBeChecked();
    await sounds.check();
    await alice.getByRole('button', { name: 'Close' }).click();
    await (await headerButton(alice, 'History')).click();
    await history.getByRole('button', { name: 'Playback settings' }).click();
    await expect(sounds).toBeChecked();
  });
  test('on a phone Share and the theme toggle are in the menu, not in Settings', async ({ seat }) => {
    const { pages: [alice] } = await seat('fourinarow', ['Alice', 'Bob']);
    await alice.setViewportSize({ width: 375, height: 667 });
    await expect(await headerButton(alice, 'Share')).toBeVisible();
    const before = await alice.evaluate(() => document.documentElement.dataset.theme);
    await (await headerButton(alice, /Switch to (dark|light) mode/)).click();
    await expect.poll(() => alice.evaluate(() => document.documentElement.dataset.theme)).toBe(before === 'dark' ? 'light' : 'dark');
    await (await headerButton(alice, 'Settings')).click();
    const dialog = alice.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Share' })).toHaveCount(0);
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
