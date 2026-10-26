import type { Page } from '@playwright/test';
import { expect, test, type Seat } from './fixtures.ts';

// Reactions open after the first move, so every test drops one disc first. Ann is seat 1, Bo seat 2.

const nameButton = (page: Page, name: string) => page.locator('.presence-bar').getByRole('button', { name: new RegExp(`^${name}`) });
const picker = (page: Page, name: string) => page.getByRole('dialog', { name: `React to ${name}` });

async function setUp(seat: Seat) {
  const { pages: [ann, bo] } = await seat('connectfour', ['Ann', 'Bo']);
  await ann.getByRole('button', { name: 'Drop in column 1' }).click();
  await expect(nameButton(bo, 'Ann')).toBeEnabled();
  return [ann, bo];
}

test('a reaction shows to everyone and starts the countdown', async ({ seat }) => {
  const [ann, bo] = await setUp(seat);
  await nameButton(ann, 'Bo').click();
  await picker(ann, 'Bo').getByRole('button', { name: '😂' }).click();
  for (const page of [ann, bo]) await expect(page.locator('.reaction-bubble')).toHaveText('Ann → Bo 😂');
  await expect(nameButton(ann, 'Bo')).toHaveText('Bo');
  await nameButton(ann, 'Bo').click();
  const open = picker(ann, 'Bo');
  await expect(open.locator('.reaction-cooldown')).toHaveText(/0:1\d/);
  await expect(open.getByRole('button', { name: '😂' })).toBeDisabled();
  await expect(open.getByRole('button', { name: 'Send' })).toBeDisabled();
  await expect(ann.locator('.reaction-bubble')).toHaveCount(0, { timeout: 4000 });
  await expect(bo.locator('.reaction-bubble')).toHaveCount(0);
});

test('the emoji box sends any one emoji and refuses text', async ({ seat }) => {
  const [ann, bo] = await setUp(seat);
  await nameButton(ann, 'Bo').click();
  const box = picker(ann, 'Bo').getByLabel('Any emoji');
  const send = picker(ann, 'Bo').getByRole('button', { name: 'Send' });
  await box.fill('hi');
  await expect(send).toBeDisabled();
  await box.fill('👨‍👩‍👧');
  await expect(send).toBeEnabled();
  await send.click();
  await expect(bo.locator('.reaction-bubble')).toHaveText('Ann → Bo 👨‍👩‍👧');
});

test('a reaction is in History at its step and is not a move', async ({ seat }) => {
  const [ann] = await setUp(seat);
  await nameButton(ann, 'Bo').click();
  await picker(ann, 'Bo').getByRole('button', { name: '😂' }).click();
  await expect(ann.locator('.reaction-bubble')).toBeVisible();
  await ann.getByRole('button', { name: 'History' }).click();
  const dialog = ann.getByRole('dialog', { name: 'History' });
  await expect(dialog.locator('.history-move')).toContainText('Move 1 of 1');
  await expect(dialog.locator('.history-reactions')).toContainText('Ann → Bo 😂');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(ann.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('two emoji cannot be sent', async ({ seat }) => {
  const [ann] = await setUp(seat);
  await nameButton(ann, 'Bo').click();
  await picker(ann, 'Bo').getByLabel('Any emoji').fill('😂😂');
  await expect(picker(ann, 'Bo').getByRole('button', { name: 'Send' })).toBeDisabled();
});
