import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGameManager } from './games.ts';
import { GAMES } from '../games/registry.ts';
import { MESSAGE_TYPES, asRecord, type ServerMessage } from '../shared/messages.ts';
import type { BasePublicState, Result, Seat } from '../shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

type Connection = { roomId: string; seat: Seat };

const manager = createGameManager(GAMES);
const connections = new Map<WebSocket, Connection>(); // Filled once the socket has joined a game

// Configure Express routes
app.use(express.static(path.join(__dirname, '../dist')));

// Serve index.html for any routes that don't match static files
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

wss.on('connection', (ws) => {
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
  switch (message?.type) {
    case MESSAGE_TYPES.MAKE_MOVE:
      respond(ws, roomId, manager.move(roomId, seat, payload?.move));
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
  }
}

function handleJoinGame(ws: WebSocket, message: Record<string, unknown>): void {
  if (connections.has(ws)) {
    sendError(ws, 'Already in a game');
    return;
  }

  const result = manager.join(message.gameType, message.gameId, message.playerName);
  if ('error' in result) {
    sendError(ws, result.error);
    return;
  }

  connections.set(ws, { roomId: result.roomId, seat: result.seat });
  send(ws, { type: MESSAGE_TYPES.GAME_JOINED, payload: { playerNumber: result.seat, gameState: result.state } });
  broadcast(result.roomId, result.state);
}

function handleDisconnect(ws: WebSocket): void {
  const connection = connections.get(ws);
  if (!connection) return;

  connections.delete(ws);
  const result = manager.leave(connection.roomId, connection.seat);
  if (result) broadcast(connection.roomId, result.state);
}

function respond(ws: WebSocket, roomId: string, result: Result<BasePublicState>): void {
  if ('error' in result) {
    sendError(ws, result.error);
  } else {
    broadcast(roomId, result.state);
  }
}

function broadcast(roomId: string, state: BasePublicState): void {
  for (const [ws, connection] of connections) {
    if (connection.roomId === roomId) send(ws, { type: MESSAGE_TYPES.GAME_STATE, payload: state });
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
  console.log('Use Ctrl+C to stop the server');
});
