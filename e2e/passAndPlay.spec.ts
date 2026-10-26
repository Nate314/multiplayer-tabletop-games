import type { Page } from '@playwright/test';
import { agreeToHouseRules, expect, fillPassAndPlay, joinPassAndPlay, newPlayer, openJoinDialog, test as base, type Seat } from './fixtures.ts';
import { cardName, type Rank, type Suit } from '../shared/playingCards.ts';
import type { GameState, PlayingCard } from '../games/hearts/types.ts';

// Ann, Bo and Cy share one device (seats 1 to 3) and Dee plays from her own (seat 4)

const test = base.extend<{ device: Page }>({
  device: async ({ browser, server }, use) => {
    const page = await newPlayer(browser, server);
    await use(page);
    await page.context().close();
  }
});

const club = (rank: Rank): PlayingCard => ({ rank, suit: 'clubs' as Suit });
const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const show = (page: Page, name: string) => page.getByRole('button', { name: `I'm ${name}, show my hand` });

async function passFirstThree(page: Page): Promise<void> {
  for (let index = 0; index < 3; index++) await hand(page).getByRole('button').nth(index).click();
  await page.getByRole('button', { name: /^Pass \d\/3$/ }).click();
}

// The device's seats first, so the fourth seat (Dee) starts the hand
async function sharedTable(seat: Seat, device: Page) {
  const table = await seat('hearts', [], { agree: false });
  await joinPassAndPlay(device, 'hearts', table.gameId, ['Ann', 'Bo', 'Cy']);
  const dee = await table.join('Dee');
  // One Agree on the device agrees for all three of its players
  for (const page of [device, dee]) await expect(page.locator('.house-rules-list li')).toHaveCount(4);
  await agreeToHouseRules(device, dee);
  return { table, dee };
}

// Every card in a `hand` field anywhere in a frame's JSON
function handCards(frame: string): string[] {
  const found: string[] = [];
  const walk = (value: unknown, key?: string) => {
    if (Array.isArray(value)) {
      if (key === 'hand') for (const card of value as PlayingCard[]) found.push(cardName(card));
      else for (const item of value) walk(item);
    } else if (value && typeof value === 'object') {
      for (const [field, inner] of Object.entries(value)) walk(inner, field);
    }
  };
  walk(JSON.parse(frame));
  return found;
}

async function expectNoCards(page: Page, cards: PlayingCard[]): Promise<void> {
  for (const card of cards) await expect(page.getByLabel(cardName(card), { exact: true })).toHaveCount(0);
}

test.describe('Pass and play', () => {
  test('no private view of another local seat renders or arrives before its handoff', async ({ seat, device }) => {
    const frames: string[] = [];
    device.on('websocket', socket => socket.on('framereceived', ({ payload }) => frames.push(String(payload))));
    const { table } = await sharedTable(seat, device);
    const { hands } = await table.state<GameState>();
    const others = [...hands[2], ...hands[3]];
    const otherNames = new Set(others.map(cardName));

    await expect(device.getByText('Pass to Ann')).toBeVisible();
    await expect(hand(device)).toHaveCount(0);
    await expectNoCards(device, [...hands[1], ...others]);
    await show(device, 'Ann').click();
    await expect(hand(device).getByRole('button')).toHaveCount(13);
    await expectNoCards(device, others);
    await passFirstThree(device);

    await expect(device.getByText('Pass to Bo')).toBeVisible();
    const after = await table.state<GameState>();
    await expectNoCards(device, [...after.hands[1], ...others]);
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) expect(handCards(frame).filter(card => otherNames.has(card))).toEqual([]);

    // The check sees Bo's cards once they are shown
    await show(device, 'Bo').click();
    await expect(hand(device).getByRole('button')).toHaveCount(13);
    expect(frames.some(frame => handCards(frame).some(card => otherNames.has(card)))).toBe(true);
  });

  test('a pass and a vote hand off one player at a time', async ({ seat, device }) => {
    const { table, dee } = await sharedTable(seat, device);
    for (const name of ['Ann', 'Bo', 'Cy']) {
      await expect(device.getByText(`Pass to ${name}`)).toBeVisible();
      await show(device, name).click();
      await expect(device.getByText(`Playing as ${name}`)).toBeVisible();
      await passFirstThree(device);
    }
    // Nothing local is waited on, so Cy stays shown while Dee passes
    await expect(device.getByText('Playing as Cy')).toBeVisible();
    await passFirstThree(dee);

    // A known first trick: Ann leads the 2 of clubs and Dee's ace takes it
    await table.patch({
      phase: 'play', currentPlayer: 1, passes: {}, trick: [], tricksPlayed: 0,
      hands: { 1: [club('2'), club('K')], 2: [club('3'), club('4')], 3: [club('5'), club('6')], 4: [club('A'), club('8')] }
    });
    for (const [name, card] of [['Ann', club('2')], ['Bo', club('3')], ['Cy', club('5')]] as const) {
      await show(device, name).click();
      await hand(device).getByRole('button', { name: cardName(card), exact: true }).click();
    }
    await hand(dee).getByRole('button', { name: cardName(club('A')), exact: true }).click();
    await dee.getByRole('button', { name: 'Undo' }).click();

    // Cy, still shown, votes first; then the device goes to each other voter in seat order
    await expect(device.getByText('Playing as Cy')).toBeVisible();
    await device.getByRole('button', { name: 'Approve' }).click();
    for (const name of ['Ann', 'Bo']) {
      await expect(device.getByText(`Pass to ${name}`)).toBeVisible();
      await show(device, name).click();
      await device.getByRole('button', { name: 'Approve' }).click();
    }
    await expect(hand(dee).getByRole('button', { name: cardName(club('A')), exact: true })).toBeEnabled();
  });

  test('reload resumes on the handoff screen', async ({ seat, device }) => {
    await sharedTable(seat, device);
    await show(device, 'Ann').click();
    await passFirstThree(device);
    await show(device, 'Bo').click();
    await expect(hand(device).getByRole('button')).toHaveCount(13);

    await device.reload();
    await expect(device.getByText('Pass to Bo')).toBeVisible();
    await expect(hand(device)).toHaveCount(0);
    await show(device, 'Bo').click();
    await expect(hand(device).getByRole('button')).toHaveCount(13);
  });

  test('Pictionary offers no pass and play', async ({ device }) => {
    await openJoinDialog(device, 'pictionary');
    const roles = device.getByRole('group', { name: 'Join as' });
    await expect(roles.getByRole('button')).toHaveText(['Player', 'Spectator']);
  });

  test('the dialog refuses a single name and a duplicate', async ({ device }) => {
    await openJoinDialog(device, 'hearts');
    await fillPassAndPlay(device, 'refused', ['Ann', '']);
    await expect(device.getByRole('button', { name: 'Add player' })).toBeVisible();
    await expect(device.getByLabel('Your name')).toHaveCount(0);
    await device.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(device.getByText('Enter at least two names')).toBeVisible();

    await device.getByLabel('Player 2', { exact: true }).fill('ann');
    await device.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(device.getByText('Each player needs a different name')).toBeVisible();
  });
});
