import { expect, headerButton, openControls, tableScreen, test } from './fixtures.ts';

// Not importing CONTROLS: the e2e project cannot follow the client chunk that ClientGame pulls in

test.describe('Controls dialog', () => {
  test('lists the game\'s controls and closes with Escape or Close, focus returning to the menu button', async ({ seat }) => {
    const [alice] = (await seat('tictactoe', ['Alice', 'Bob'])).pages;
    const dialog = await openControls(alice);
    await expect(dialog).toHaveAccessibleName('Tic-Tac-Toe controls');
    await expect(dialog).toContainText('Tab moves between buttons, and Enter or Space presses one.');
    for (const heading of ['To', 'Mouse or touch', 'Keys']) await expect(dialog.getByRole('columnheader', { name: heading, exact: true })).toBeVisible();
    await expect(dialog.locator('tbody tr')).toHaveCount(5);
    await expect(dialog.locator('tbody tr').first()).toContainText('Place a mark');

    await alice.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(alice.locator('.game-menu-button')).toBeFocused();

    await openControls(alice);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(alice.locator('.game-menu-button')).toBeFocused();
  });

  test('fits a 320px wide screen without scrolling sideways', async ({ seat }) => {
    const [alice] = (await seat('tictactoe', ['Alice', 'Bob'])).pages;
    await alice.setViewportSize({ width: 320, height: 640 });
    const dialog = await openControls(alice);
    await expect(dialog).toBeVisible();
    expect(await alice.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });

  test('the table screen\'s menu has no Controls button', async ({ seat }) => {
    const table = await seat('tictactoe', ['Alice', 'Bob']);
    const tv = await tableScreen(table);
    await expect(await headerButton(tv, 'Rules')).toBeVisible();
    await expect(await headerButton(tv, 'Controls')).toHaveCount(0);
  });

  // Deleted once every game has a list
  test('a game with no list yet has no Controls button', async ({ seat }) => {
    const [alice] = (await seat('whodunit', ['Alice'])).pages;
    await expect(await headerButton(alice, 'Rules')).toBeVisible();
    await expect(await headerButton(alice, 'Controls')).toHaveCount(0);
  });
});
