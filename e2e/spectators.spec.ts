import { test, expect, newPlayer, nameOf, type Seat } from './fixtures.ts';
import type { Page } from '@playwright/test';

type Received = { type: string; payload: Record<string, unknown> };
type Sent = { type: string; payload?: Record<string, unknown> };

// A bare socket: joins, then sends each message and waits for its GAME_ERROR.
// Returns the GAME_JOINED payload and the error text each message got.
async function protocol(page: Page, gameId: string, join: Record<string, unknown>, messages: Sent[]) {
  return page.evaluate(({ gameId, join, messages }) => new Promise<{ joined: Received; errors: string[] }>(resolve => {
    const ws = new WebSocket(`ws://${window.location.host}`);
    let joined: Received | undefined;
    const errors: string[] = [];
    ws.onopen = () => ws.send(JSON.stringify({ type: 'JOIN_GAME', gameType: 'connectfour', gameId, ...join }));
    ws.onmessage = event => {
      const message: Received = JSON.parse(event.data);
      if (message.type === 'GAME_JOINED') {
        joined = message;
        ws.send(JSON.stringify(messages[0]));
      } else if (message.type === 'GAME_ERROR') {
        errors.push(String(message.payload.message));
        if (errors.length === messages.length) resolve({ joined: joined!, errors });
        else ws.send(JSON.stringify(messages[errors.length]));
      }
    };
  }), { gameId, join, messages });
}

test('a spectator cannot move or act', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const visitor = await newPlayer(browser, server);
  await visitor.goto('/');
  const refused: Sent[] = [
    { type: 'MAKE_MOVE', payload: { move: { column: 0 } } },
    { type: 'GAME_ACTION', payload: { action: {} } },
    { type: 'SET_HOUSE_RULES', payload: { proposal: {} } },
    { type: 'AGREE_HOUSE_RULES', payload: { revision: 0 } },
    { type: 'REQUEST_UNDO' },
    { type: 'VOTE_UNDO', payload: { approve: true } },
    { type: 'REQUEST_DISMISS', payload: { seat: 1 } },
    { type: 'VOTE_DISMISS', payload: { approve: true } },
    { type: 'ANSWER_HAND', payload: { spectator: 'x', allow: true } }
  ];
  const { joined, errors } = await protocol(visitor, table.gameId, { playerName: 'Dana', role: 'spectator' }, refused);
  expect(joined.payload.playerNumber).toBeNull();
  expect(typeof joined.payload.spectatorId).toBe('string');
  expect(errors).toEqual(refused.map(() => 'Spectators cannot do that'));
});

test('a player cannot ask to see a hand or switch to player', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice']); // still a lobby, so a second player can take a seat
  const visitor = await newPlayer(browser, server);
  await visitor.goto('/');
  const { errors } = await protocol(visitor, table.gameId, { playerName: 'Eli' }, [
    { type: 'REQUEST_HAND', payload: { seat: 1 } },
    { type: 'SWITCH_TO_PLAYER' }
  ]);
  expect(errors).toEqual(['Only spectators can do that', 'Only spectators can do that']);
});

test('the switch picks Join or Watch and is remembered', async ({ browser, server }) => {
  const visitor = await newPlayer(browser, server);
  await visitor.goto('/');
  await visitor.locator('.lobby-game', { hasText: 'Connect Four' }).click();
  const dialog = visitor.getByRole('dialog', { name: 'Join Connect Four' });
  await expect(dialog.getByRole('button', { name: 'Join', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Player' })).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // the pressed one is filled
  await dialog.getByRole('button', { name: 'Spectator' }).click();
  await expect(dialog.getByRole('button', { name: 'Spectator' })).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(dialog.getByRole('button', { name: 'Player' })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(dialog.getByRole('button', { name: 'Watch', exact: true })).toBeVisible();
  await dialog.getByLabel('Game ID').fill('abc');
  await dialog.getByLabel('Your name').fill('Dana');
  await dialog.getByRole('button', { name: 'Watch', exact: true }).click(); // saves the form, then is refused: no such game
  await visitor.reload();
  await visitor.locator('.lobby-game', { hasText: 'Connect Four' }).click();
  await expect(visitor.getByRole('dialog').getByRole('button', { name: 'Spectator' })).toHaveAttribute('aria-pressed', 'true');
});

test('a started game offers to watch instead', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  const visitor = await newPlayer(browser, server);
  await visitor.goto(`/join/connectfour/${encodeURIComponent(table.gameId)}`);
  const dialog = visitor.getByRole('dialog', { name: 'Join Connect Four' });
  await dialog.getByLabel('Your name').fill('Cara');
  await dialog.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(dialog.getByText('Game already in progress', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Watch instead' }).click();
  await expect(visitor.getByRole('button', { name: 'Back to games' })).toBeVisible();
  await expect(visitor.locator('.spectator-status')).toBeVisible();
  for (const page of table.pages) await expect(page.locator('.presence-watching')).toHaveText('Watching: Cara');
});

// Opens the site in a new context and watches `gameId` as `name` through the join dialog
async function watch(browser: Parameters<typeof newPlayer>[0], server: Parameters<typeof newPlayer>[1], gameType: string, gameId: string, name: string) {
  const page = await newPlayer(browser, server);
  await page.goto('/');
  await page.locator('.lobby-game').filter({ has: page.locator('.lobby-game-name', { hasText: new RegExp(`^${nameOf(gameType)}$`) }) }).click();
  await page.getByRole('button', { name: 'Spectator' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Game ID').fill(gameId);
  await page.getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to games' })).toBeVisible();
  return page;
}

test('a spectator\'s reaction countdown sits in the reaction picker, not beside the turn clock', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice', 'Bob'], { houseRules: { turnTimer: 30 } });
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  const dana = await watch(browser, server, 'connectfour', table.gameId, 'Dana');
  const bar = dana.locator('.presence-bar');
  const timer = bar.locator('.presence-timer');
  await expect(timer).toContainText('Bob');
  await bar.getByRole('button', { name: /^Bob/ }).click();
  await dana.getByRole('dialog', { name: 'React to Bob' }).getByRole('button', { name: '😂' }).click();
  await bar.getByRole('button', { name: /^Alice/ }).click();
  await expect(dana.getByRole('dialog', { name: 'React to Alice' }).locator('.reaction-cooldown')).toHaveText(/0:1\d/);
  await expect(bar.getByRole('button', { name: /^Alice/ })).toHaveText('Alice');
  await expect(timer).toHaveText(/^Bob\s*0:(30|29|28|27|26)$/);
});

const handCards = (page: Awaited<ReturnType<typeof watch>>) => page.locator('.hand .hand-cards > *');

test('a spectator is told when the last player leaves the lobby', async ({ seat, browser, server }) => {
  const table = await seat('hearts', ['Alice']);
  const dana = await watch(browser, server, 'hearts', table.gameId, 'Dana');
  await table.pages[0].close();
  await expect(dana.getByText('Game not found')).toBeVisible();
});

async function heartsTable(seat: Seat) {
  return seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan']);
}

// A real move: the player picks the first three cards of their hand and passes them (the first pass starts the game)
async function passFirstThree(page: Page) {
  const cards = page.getByRole('region', { name: 'Your hand' }).locator('.playing-card');
  for (let slot = 0; slot < 3; slot++) await cards.nth(slot).click();
  await page.getByRole('button', { name: /^Pass \d\/3$/ }).click();
  await expect(page.locator('.my-pass')).toBeVisible();
}

test('a spectator sees the table and no hand', async ({ seat, browser, server }) => {
  const table = await heartsTable(seat);
  const dana = await watch(browser, server, 'hearts', table.gameId, 'Dana');
  for (const page of table.pages) await expect(page.locator('.presence-watching')).toHaveText('Watching: Dana');
  await expect(dana.locator('.hand')).toHaveCount(0);
  await expect(dana.locator('.spectator-seats button')).toHaveCount(4);
  await expect(dana.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
});

test('a Pictionary spectator sees everything, so no seat to pick or ask for', async ({ seat, browser, server }) => {
  const table = await seat('pictionary', ['Alice', 'Bob']);
  const dana = await watch(browser, server, 'pictionary', table.gameId, 'Dana');
  await expect(dana.locator('.spectator-status')).toBeVisible();
  await expect(dana.locator('.spectator-seats')).toHaveCount(0);
  await expect(dana.locator('.spectator-ask')).toHaveCount(0);
});

test('asking, allowing and seeing a hand', async ({ seat, browser, server }) => {
  const table = await heartsTable(seat);
  const [alice, bob] = table.pages;
  await passFirstThree(table.pages[2]);
  const dana = await watch(browser, server, 'hearts', table.gameId, 'Dana');
  await dana.locator('.spectator-seats').getByRole('button', { name: 'Alice' }).click();
  await dana.getByRole('button', { name: "Ask to see Alice's hand" }).click();
  await expect(dana.getByText('Waiting for Alice')).toBeVisible();
  await expect(alice.getByText('Dana (watching) wants to see your hand')).toBeVisible();
  await expect(bob.getByText('wants to see your hand')).toHaveCount(0);
  await alice.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(handCards(dana)).toHaveCount(13);
  await expect(dana.locator('.seat-name', { hasText: 'Alice' })).toHaveText('Alice'); // the seat is Alice's, not Dana's
  await expect(alice.locator('.seat-name', { hasText: 'Alice' })).toHaveText('Alice (you)');
  await passFirstThree(bob);
  await expect(dana.locator('.spectator-status')).toContainText('Bob passed three cards');
  await expect(handCards(dana)).toHaveCount(13);
  await dana.reload();
  await dana.locator('.spectator-seats').getByRole('button', { name: 'Alice' }).click(); // the pick is not remembered, the permission is
  await expect(handCards(dana)).toHaveCount(13);
});

test('a no can be asked again', async ({ seat, browser, server }) => {
  const table = await heartsTable(seat);
  await passFirstThree(table.pages[2]);
  const dana = await watch(browser, server, 'hearts', table.gameId, 'Dana');
  await dana.locator('.spectator-seats').getByRole('button', { name: 'Alice' }).click();
  await dana.getByRole('button', { name: "Ask to see Alice's hand" }).click();
  await table.pages[0].getByRole('button', { name: "Don't allow" }).click();
  await expect(dana.getByRole('button', { name: "Ask to see Alice's hand" })).toBeVisible();
});

test('nothing to ask in a game with nothing private', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const dana = await watch(browser, server, 'connectfour', table.gameId, 'Dana');
  await expect(dana.locator('.spectator-status')).toBeVisible();
  await expect(dana.locator('.spectator-seats')).toHaveCount(0);
});

test('play instead in the lobby', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice']);
  const dana = await watch(browser, server, 'connectfour', table.gameId, 'Dana');
  await dana.getByRole('button', { name: 'Play instead' }).click();
  await expect(dana.getByRole('button', { name: 'Play instead' })).toHaveCount(0);
  await expect(table.pages[0].locator('.presence-watching')).toHaveCount(0);
  await expect(table.pages[0].getByText('Dana joined (2/2 players)')).toBeVisible();
});

test('spectators get no votes', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  await table.pages[0].getByRole('button', { name: 'Drop in column 1' }).click();
  const dana = await watch(browser, server, 'connectfour', table.gameId, 'Dana');
  await table.pages[0].getByRole('button', { name: 'Undo' }).click();
  await expect(table.pages[1].getByRole('button', { name: 'Approve' })).toBeVisible();
  await expect(dana.getByRole('button', { name: 'Approve' })).toHaveCount(0);
});

test('no hand can be asked for before the game starts', async ({ seat, browser, server }) => {
  const table = await heartsTable(seat);
  const dana = await watch(browser, server, 'hearts', table.gameId, 'Dana');
  await dana.locator('.spectator-seats').getByRole('button', { name: 'Alice' }).click();
  await expect(dana.locator('.spectator-seats').getByRole('button', { name: 'Alice' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dana.getByRole('button', { name: /^Ask to see/ })).toHaveCount(0);
});

// Mid hand with three cards in the trick: the seats and the trick are all on show
const play = (seat: number, rank: string) => ({ seat, card: { rank, suit: 'spades' } });
const midHand = { phase: 'play', currentPlayer: 1, trick: [play(2, 'Q'), play(3, '10'), play(4, 'A')] };

for (const gameType of ['hearts', 'spades']) {
  test(`a player and a spectator of a started ${gameType} game have no sideways scroll at 320 px`, async ({ seat, browser, server }) => {
    const table = await seat(gameType, ['Alice', 'Bob', 'Cara', 'Dan']);
    if (gameType === 'hearts') await passFirstThree(table.pages[2]);
    await table.patch(gameType === 'hearts' ? { ...midHand, passes: {}, tricksPlayed: 3 } : { ...midHand, started: true, dealer: 4, bids: { 1: 3, 2: 4, 3: 2, 4: 3 }, tricksTaken: { 1: 0, 2: 0, 3: 0, 4: 0 } });
    const dana = await watch(browser, server, gameType, table.gameId, 'Dana');
    await dana.setViewportSize({ width: 320, height: 700 });
    const overflow = () => dana.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    // A player's own board shares the seat grid
    const alice = table.pages[0];
    await alice.setViewportSize({ width: 320, height: 700 });
    expect(await alice.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await dana.locator('.spectator-seats').getByRole('button', { name: 'Alice' }).click();
    await dana.getByRole('button', { name: "Ask to see Alice's hand" }).click();
    await table.pages[0].getByRole('button', { name: 'Allow', exact: true }).click();
    await expect(handCards(dana)).toHaveCount(13);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
}

