import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { GAMES } from '../games/registry.ts';
import { pipsName, tilesOf } from '../games/dominoes/rules.ts';

// The History dialog is the same size at every step, whatever the game: 90% of the window, the board scaled down to fit

const history = (page: Page) => page.getByRole('dialog', { name: 'History' });
const content = (dialog: Locator) => dialog.locator('.history-board-content');
const scaleOf = async (dialog: Locator) => Number(await content(dialog).getAttribute('data-fit-scale'));

async function expectBoardInside(dialog: Locator) {
  const box = (await dialog.locator('.history-board').boundingBox())!;
  const board = (await content(dialog).boundingBox())!;
  expect(board.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(board.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(board.x + board.width).toBeLessThanOrEqual(box.x + box.width + 1);
  expect(board.y + board.height).toBeLessThanOrEqual(box.y + box.height + 1);
}

for (const { info } of GAMES) {
  test(`the ${info.name} History dialog fills 90% of the window and its board fits inside`, async ({ seat }) => {
    const names = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn', 'Gus', 'Hal'].slice(0, info.minPlayers);
    const { pages: [alice] } = await seat(info.id, names);
    for (const size of [{ width: 375, height: 667 }, { width: 1280, height: 800 }]) {
      await alice.setViewportSize(size);
      await alice.getByRole('button', { name: 'History' }).click();
      const dialog = history(alice);
      await expect(dialog.locator('.history-slider')).toBeVisible();
      const box = (await dialog.boundingBox())!;
      expect(Math.abs(box.width - size.width * 0.9)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - size.height * 0.9)).toBeLessThanOrEqual(1);
      await expectBoardInside(dialog);
      await dialog.getByRole('button', { name: 'Close' }).click();
    }
  });
}

// Dominoes: each play lays one more tile on the line, so the board grows from step to step
test('stepping through History never enlarges the board or moves its top edge, and a resized window fits it again', async ({ seat }) => {
  const table = await seat('dominoes', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  const tile = (a: number, b: number) => tilesOf(6).findIndex(([low, high]) => low === Math.min(a, b) && high === Math.max(a, b));
  await table.patch({
    started: true, set: 6, roundNumber: 1, leadTile: null, lastWinner: null, roundSummary: null, lastMove: null, currentPlayer: 1,
    hands: { 1: [tile(4, 5), tile(5, 1), tile(0, 0)], 2: [tile(3, 6), tile(6, 2), tile(0, 1)] },
    boneyard: [], line: [{ tile: tile(3, 4), left: 3, right: 4 }], scores: { 1: 0, 2: 0 }
  });
  for (const [page, a, b] of [[alice, 4, 5], [bob, 3, 6], [alice, 5, 1], [bob, 6, 2]] as const) {
    await page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: pipsName([Math.min(a, b), Math.max(a, b)]), exact: true }).click();
  }
  await alice.setViewportSize({ width: 375, height: 667 });
  await alice.getByRole('button', { name: 'History' }).click();
  const dialog = history(alice);
  const slider = dialog.getByRole('slider', { name: 'Step' });
  await expect(dialog.locator('.history-move')).toContainText('Move 4 of 4');
  const dialogBox = await dialog.boundingBox();
  let scale = await scaleOf(dialog);
  expect(scale).toBeLessThan(1); // the five-tile line is wider than a phone, so the board is scaled
  const top = (await content(dialog).boundingBox())!.y;
  for (const step of ['0', '1', '2', '3', '4', '0']) {
    await slider.fill(step);
    const next = await scaleOf(dialog);
    expect(next).toBeLessThanOrEqual(scale);
    scale = next;
    expect((await content(dialog).boundingBox())!.y).toBe(top);
    expect(await dialog.boundingBox()).toEqual(dialogBox);
    await expectBoardInside(dialog);
  }
  await alice.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => scaleOf(dialog)).toBeGreaterThan(scale);
});

// Connect Four with three discs dropped: four steps to move through
async function openConnectFourHistory(seat: Parameters<Parameters<typeof test>[2]>[0]['seat']) {
  const { pages: [alice, bob] } = await seat('connectfour', ['Alice', 'Bob']);
  await alice.getByRole('button', { name: 'Drop in column 1' }).click();
  await bob.getByRole('button', { name: 'Drop in column 2' }).click();
  await alice.getByRole('button', { name: 'Drop in column 1' }).click();
  await alice.getByRole('button', { name: 'History' }).click();
  return { alice, dialog: history(alice) };
}

test('the row under the board is Play, the slider and the settings gear, and the dialog keeps its size between steps', async ({ seat }) => {
  const { dialog } = await openConnectFourHistory(seat);
  const board = (await dialog.locator('.history-board').boundingBox())!;
  const play = (await dialog.locator('.history-play').boundingBox())!;
  const slider = (await dialog.locator('.history-slider').boundingBox())!;
  const gear = (await dialog.locator('.history-settings-button').boundingBox())!;
  const centerY = (box: { y: number; height: number }) => box.y + box.height / 2;
  expect(play.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
  expect(Math.abs(centerY(play) - centerY(slider))).toBeLessThanOrEqual(3);
  expect(Math.abs(centerY(gear) - centerY(slider))).toBeLessThanOrEqual(3);
  expect(gear.x).toBeGreaterThan(slider.x);
  const dialogBox = await dialog.boundingBox();
  const sliderInput = dialog.getByRole('slider', { name: 'Step' });
  for (const step of ['0', '1', '2', '3']) {
    await sliderInput.fill(step);
    expect(await dialog.boundingBox()).toEqual(dialogBox);
  }
});

test('the gear holds Animations and Speed, and the live game has no View as', async ({ seat }) => {
  const { dialog } = await openConnectFourHistory(seat);
  const settings = dialog.getByRole('group', { name: 'Playback settings' });
  await expect(settings).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Playback settings' }).click();
  await expect(settings).toBeVisible();
  await expect(settings.getByLabel('Animations')).toBeVisible();
  await expect(settings.getByLabel('Speed')).toBeVisible();
  await expect(dialog.getByLabel('View as')).toHaveCount(0);
  await dialog.locator('.history-move').click();
  await expect(settings).toHaveCount(0);
});

test('speed and animations are remembered, and 4x plays a step every 375 ms', async ({ seat }) => {
  const { alice, dialog } = await openConnectFourHistory(seat);
  await dialog.getByRole('button', { name: 'Playback settings' }).click();
  await dialog.getByLabel('Speed').selectOption({ label: '4x' });
  await dialog.getByLabel('Animations').check();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await alice.getByRole('button', { name: 'History' }).click();
  await dialog.getByRole('button', { name: 'Playback settings' }).click();
  await expect(dialog.getByLabel('Speed')).toHaveValue('4');
  await expect(dialog.getByLabel('Animations')).toBeChecked();
  await dialog.getByRole('slider', { name: 'Step' }).fill('0');
  // A paused fake clock makes the timing exact: only runFor moves time. A step takes 375 ms at 4x, 750 ms at 2x, 1500 ms at 1x,
  // so 400 ms moves one step at 4x and none at 2x. The next timer starts after React renders, hence one runFor per step.
  await alice.clock.install({ time: 0 });
  await alice.clock.pauseAt(1000);
  await dialog.getByRole('button', { name: 'Play', exact: true }).click();
  for (const move of [1, 2, 3]) {
    await alice.clock.runFor(400);
    await expect(dialog.locator('.history-move')).toContainText(`Move ${move} of 3`, { timeout: 500 });
  }
});
