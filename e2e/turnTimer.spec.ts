import type { Page } from '@playwright/test';
import { expect, inHouseRules, test } from './fixtures.ts';

// The turn timer house rule, played in Connect Four (a game with no rules of its own) and Chess (which has a game clock).
// Seat 1 (Alice) moves first. Running out is a warning only: nobody's turn is skipped.

const timer = (page: Page) => page.locator('.presence-timer');
const drop = (page: Page, column: number) => page.getByRole('button', { name: `Drop in column ${column}` }).click();

test.describe('Turn timer', () => {
  test('a game without house rules starts without Agree while the timer is off', async ({ seat }) => {
    const { pages: [alice] } = await seat('connectfour', ['Alice', 'Bob']);
    await inHouseRules(alice, async dialog => {
      await expect(dialog.getByLabel('Turn timer', { exact: true })).toHaveValue('0');
      await expect(dialog.getByRole('button', { name: 'Agree', exact: true })).toHaveCount(0);
    });
    await expect(alice.locator('.rules-button')).not.toHaveAttribute('data-attention');
    await expect(timer(alice)).toHaveCount(0);
    await drop(alice, 1);
  });

  test('the host turns the timer on and everyone agrees', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('connectfour', ['Alice', 'Bob'], { houseRules: { turnTimer: 30 } });
    for (const page of [alice, bob]) {
      await expect(timer(page)).toContainText('Alice');
      await expect(timer(page)).toHaveText(/^Alice\s*0:(30|29|28|27|26)/);
    }
  });

  test('the last 10 seconds are red, then Time\'s up and overtime', async ({ seat }) => {
    const table = await seat('connectfour', ['Alice', 'Bob'], { houseRules: { turnTimer: 30 } });
    const [alice, bob] = table.pages;
    await table.patch({ turnStartedAt: Date.now() - 25_000 });
    await expect(timer(alice)).toHaveAttribute('data-low', '');
    await table.patch({ turnStartedAt: Date.now() - 31_000 });
    await expect(alice.getByRole('status').filter({ hasText: "Time's up" })).toBeVisible();
    await expect(bob.getByText('Alice is over time')).toBeVisible();
    await expect(timer(alice)).toContainText('+0:0');
    await drop(alice, 1);
    await expect(timer(bob)).toHaveText(/^Bob\s*0:(30|29|28|27|26)/);
    await expect(timer(bob)).not.toHaveAttribute('data-over', '');
  });

  test('an undo vote pauses the timer', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('connectfour', ['Alice', 'Bob'], { houseRules: { turnTimer: 30 } });
    await drop(alice, 1);
    await expect(timer(bob)).toContainText('Bob');
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(timer(bob)).toContainText('(paused)');
    const before = await timer(bob).innerText();
    await bob.waitForTimeout(2000);
    expect(await timer(bob).innerText()).toBe(before);
  });

  test('chess shows its own clock and the turn timer together', async ({ seat }) => {
    const { pages: [alice] } = await seat('chess', ['Alice', 'Bob'], { houseRules: { clockMinutes: 5, turnTimer: 60 } });
    await expect(alice.locator('.chess-clock').first()).toBeVisible();
    await expect(timer(alice)).toBeVisible();
  });
});
