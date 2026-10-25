import { test, expect, newPlayer } from './fixtures.ts';
import type { Page } from '@playwright/test';

type Received = { type: string; payload: Record<string, unknown> };
type Sent = { type: string; payload?: Record<string, unknown> };

// A bare socket, since the spectator screen comes later: joins, then sends each message and waits for its GAME_ERROR.
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
  await dialog.getByRole('button', { name: 'Spectator' }).click();
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
  // The "Watching: Cara" line on the players' pages is the spectator screen's (Task 8); here the refusal clears
  await expect(dialog.getByText('Game already in progress', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Spectator' })).toHaveAttribute('aria-pressed', 'true');
});
