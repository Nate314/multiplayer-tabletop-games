import { test, expect, newPlayer } from './fixtures.ts';

type Received = { type: string; payload: Record<string, unknown> };

test('a spectator cannot move', async ({ seat, browser, server }) => {
  const table = await seat('connectfour', ['Alice', 'Bob']);
  const visitor = await newPlayer(browser, server);
  await visitor.goto('/');
  // A bare socket, since the spectator screen comes later; the server must refuse the move by itself
  const messages = await visitor.evaluate(({ gameId }) => new Promise<Received[]>(resolve => {
    const ws = new WebSocket(`ws://${window.location.host}`);
    const received: Received[] = [];
    ws.onopen = () => ws.send(JSON.stringify({ type: 'JOIN_GAME', gameType: 'connectfour', gameId, playerName: 'Dana', role: 'spectator' }));
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      received.push(message);
      if (message.type === 'GAME_JOINED') ws.send(JSON.stringify({ type: 'MAKE_MOVE', payload: { move: { column: 0 } } }));
      if (message.type === 'GAME_ERROR') resolve(received);
    };
  }), { gameId: table.gameId });
  expect(messages[0].type).toBe('GAME_JOINED');
  expect(messages[0].payload.playerNumber).toBeNull();
  expect(typeof messages[0].payload.spectatorId).toBe('string');
  expect(messages.at(-1)?.payload.message).toBe('Spectators cannot do that');
});
