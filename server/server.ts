import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGameManager } from './games.ts';
import { openGameStore } from './store.ts';
import { createE2eRandom, mountE2eRoutes } from './e2e.ts';
import { serveClient } from './static.ts';
import { mountRulesRoute } from './rules.ts';
import { mountAssetRoutes } from './assets/routes.ts';
import { GAMES } from '../games/registry.ts';
import { MESSAGE_TYPES, asRecord, type ServerMessage } from '../shared/messages.ts';
import type { BasePublicState, JoinRole, Result, Seat } from '../shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const HEARTBEAT_MS = 15_000; // a socket that misses one ping is dead within about 30 s
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/games.sqlite');
const E2E = process.env.E2E === '1'; // test hooks for the Playwright suite; never set on a real server

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 }); // real messages are well under 1 KB

type Connection = { roomId: string; seat: Seat; spectatorId?: undefined } | { roomId: string; seat: null; spectatorId: string }; // a spectator has no seat

const e2eRandom = E2E ? createE2eRandom() : null;
const manager = createGameManager(GAMES, e2eRandom?.random ?? Math.random, openGameStore(DATABASE_PATH), { changed: broadcast });
const connections = new Map<WebSocket, Connection>(); // Filled once the socket has joined a game
const answered = new WeakSet<WebSocket>(); // sockets that answered the last ping

// Configure Express routes
app.get('/api/history/:gameType/:gameId', (req, res) => {
  const steps = manager.history(req.params.gameType, req.params.gameId);
  if (!steps) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json({ steps });
});

app.get('/api/game-file/:gameType/:gameId', (req, res) => {
  const result = manager.gameFile(req.params.gameType, req.params.gameId, new Date());
  if (!result) {
    res.status(404).json({ error: 'Game not found' });
  } else if ('error' in result) {
    res.status(409).json({ error: result.error });
  } else {
    res.json(result.file);
  }
});

mountRulesRoute(app, path.join(__dirname, '../games'), GAMES.map(game => game.info.id));

if (e2eRandom) mountE2eRoutes(app, manager, e2eRandom, roomId => broadcast(roomId));

mountAssetRoutes(app);

serveClient(app, path.join(__dirname, '../dist'));

wss.on('connection', (ws) => {
  answered.add(ws);
  ws.on('pong', () => answered.add(ws));

  ws.on('message', (message) => {
    let data: unknown;
    try {
      data = JSON.parse(String(message));
    } catch (error) {
      console.error('Error parsing message:', error);
      return;
    }
    try {
      handleMessage(ws, data);
    } catch (error) {
      console.error('Error handling message:', error);
      sendError(ws, 'Something went wrong');
    }
  });

  ws.on('close', () => handleDisconnect(ws));

  // Without a listener, a malformed frame would crash the process; ws closes the socket itself
  ws.on('error', (error) => console.error('WebSocket error:', error));
});

// A dropped device may never close its socket, so one that misses a ping is closed here, which disconnects it
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!answered.has(ws)) {
      ws.terminate();
      continue;
    }
    answered.delete(ws);
    ws.ping();
  }
}, HEARTBEAT_MS);
server.on('close', () => clearInterval(heartbeat));

function handleMessage(ws: WebSocket, data: unknown): void {
  const message = asRecord(data);
  if (message?.type === MESSAGE_TYPES.JOIN_GAME) {
    handleJoinGame(ws, message);
    return;
  }

  const connection = connections.get(ws);
  if (!connection) {
    sendError(ws, 'Join a game first');
    return;
  }

  const { roomId, seat } = connection;
  const payload = asRecord(message?.payload);
  if (seat === null) {
    handleSpectatorMessage(ws, roomId, connection.spectatorId, message?.type, payload);
    return;
  }
  switch (message?.type) {
    case MESSAGE_TYPES.ANSWER_HAND:
      respond(ws, roomId, manager.answerHand(roomId, seat, payload?.spectator, payload?.allow));
      break;
    case MESSAGE_TYPES.REQUEST_HAND:
    case MESSAGE_TYPES.SWITCH_TO_PLAYER:
      sendError(ws, 'Only spectators can do that');
      break;
    case MESSAGE_TYPES.MAKE_MOVE:
      respond(ws, roomId, manager.move(roomId, seat, payload?.move, payload?.moveCount));
      break;
    case MESSAGE_TYPES.SET_HOUSE_RULES:
      respond(ws, roomId, manager.setHouseRules(roomId, seat, payload?.proposal));
      break;
    case MESSAGE_TYPES.AGREE_HOUSE_RULES:
      respond(ws, roomId, manager.agreeHouseRules(roomId, seat, payload?.revision));
      break;
    case MESSAGE_TYPES.GAME_ACTION:
      respond(ws, roomId, manager.action(roomId, seat, payload?.action));
      break;
    case MESSAGE_TYPES.REQUEST_UNDO:
      respond(ws, roomId, manager.requestUndo(roomId, seat));
      break;
    case MESSAGE_TYPES.VOTE_UNDO:
      respond(ws, roomId, manager.voteUndo(roomId, seat, payload?.approve));
      break;
    case MESSAGE_TYPES.REQUEST_DISMISS:
      respond(ws, roomId, manager.requestDismiss(roomId, seat, payload?.seat));
      break;
    case MESSAGE_TYPES.VOTE_DISMISS:
      respond(ws, roomId, manager.voteDismiss(roomId, seat, payload?.approve));
      break;
  }
}

function handleJoinGame(ws: WebSocket, message: Record<string, unknown>): void {
  if (connections.has(ws)) {
    sendError(ws, 'Already in a game');
    return;
  }

  const result = manager.join(message.gameType, message.gameId, message.playerName, message.rejoin, message.seatKey, message.role as JoinRole | undefined);
  if ('error' in result) {
    sendError(ws, result.error);
    return;
  }

  connections.set(ws, connectionFor(result.roomId, result.seat, result.spectatorId));
  sendJoined(ws, result);
  broadcast(result.roomId);
}

// A joined spectator has an id and no seat; a player has a seat
function connectionFor(roomId: string, seat: Seat | null, spectatorId?: string): Connection {
  return spectatorId !== undefined ? { roomId, seat: null, spectatorId } : { roomId, seat: seat as Seat };
}

function sendJoined(ws: WebSocket, joined: { seat: Seat | null; spectatorId?: string; seatKey: string; state: BasePublicState }): void {
  send(ws, {
    type: MESSAGE_TYPES.GAME_JOINED,
    payload: { playerNumber: joined.seat, spectatorId: joined.spectatorId, seatKey: joined.seatKey, gameState: joined.state }
  });
}

// A spectator may only ask to see a hand or sit down; everything else is refused
function handleSpectatorMessage(
  ws: WebSocket, roomId: string, spectatorId: string, type: unknown, payload: Record<string, unknown> | null
): void {
  if (type === MESSAGE_TYPES.REQUEST_HAND) {
    respond(ws, roomId, manager.requestHand(roomId, spectatorId, payload?.seat));
  } else if (type === MESSAGE_TYPES.SWITCH_TO_PLAYER) {
    const result = manager.switchToPlayer(roomId, spectatorId);
    if ('error' in result) {
      sendError(ws, result.error);
      return;
    }
    connections.set(ws, connectionFor(roomId, result.seat));
    sendJoined(ws, result);
    broadcast(roomId);
  } else if (typeof type === 'string' && type in MESSAGE_TYPES) {
    sendError(ws, 'Spectators cannot do that');
  }
}

function handleDisconnect(ws: WebSocket): void {
  const connection = connections.get(ws);
  if (!connection) return;

  connections.delete(ws);
  if (connection.spectatorId !== undefined) {
    manager.disconnectSpectator(connection.roomId, connection.spectatorId);
    broadcast(connection.roomId);
    return;
  }
  const result = connection.seat !== null && manager.disconnect(connection.roomId, connection.seat);
  if (result) {
    broadcast(connection.roomId);
  } else if (!manager.getState(connection.roomId)) { // the last player left, so the room is gone: tell who still watches it
    for (const [other, { roomId }] of connections) if (roomId === connection.roomId) sendError(other, 'Game not found');
  }
}

function respond(ws: WebSocket, roomId: string, result: Result<BasePublicState>): void {
  if ('error' in result) {
    sendError(ws, result.error);
  } else {
    broadcast(roomId);
  }
}

// Each player gets their own view, so a game can show them their own hand
function broadcast(roomId: string): void {
  for (const [ws, connection] of connections) {
    if (connection.roomId !== roomId) continue;
    const state = connection.spectatorId === undefined
      ? manager.getState(roomId, connection.seat)
      : manager.getSpectatorState(roomId, connection.spectatorId);
    if (state) send(ws, { type: MESSAGE_TYPES.GAME_STATE, payload: state });
  }
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, message: string): void {
  send(ws, { type: MESSAGE_TYPES.GAME_ERROR, payload: { message } });
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server active on ws://localhost:${PORT}`);
  console.log(`Saving started games to ${DATABASE_PATH}`);
  console.log('Use Ctrl+C to stop the server');
});
