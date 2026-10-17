import type { BasePublicState, Seat } from './types.ts';

// WebSocket message types shared by the browser and the server
export const MESSAGE_TYPES = {
  JOIN_GAME: 'JOIN_GAME',
  GAME_JOINED: 'GAME_JOINED',
  MAKE_MOVE: 'MAKE_MOVE',
  GAME_ACTION: 'GAME_ACTION',
  REQUEST_UNDO: 'REQUEST_UNDO',
  VOTE_UNDO: 'VOTE_UNDO',
  REQUEST_DISMISS: 'REQUEST_DISMISS',
  VOTE_DISMISS: 'VOTE_DISMISS',
  GAME_STATE: 'GAME_STATE',
  GAME_ERROR: 'GAME_ERROR'
} as const;

export type ClientMessage =
  | { type: typeof MESSAGE_TYPES.JOIN_GAME; gameType: string; gameId: string; playerName: string; rejoin?: boolean }
  | { type: typeof MESSAGE_TYPES.MAKE_MOVE; payload: { move: unknown } }
  | { type: typeof MESSAGE_TYPES.GAME_ACTION; payload: { action: unknown } }
  | { type: typeof MESSAGE_TYPES.REQUEST_UNDO }
  | { type: typeof MESSAGE_TYPES.VOTE_UNDO; payload: { approve: boolean } }
  | { type: typeof MESSAGE_TYPES.REQUEST_DISMISS; payload: { seat: Seat } }
  | { type: typeof MESSAGE_TYPES.VOTE_DISMISS; payload: { approve: boolean } };

export type ServerMessage =
  | { type: typeof MESSAGE_TYPES.GAME_JOINED; payload: { playerNumber: Seat; gameState: BasePublicState } }
  | { type: typeof MESSAGE_TYPES.GAME_STATE; payload: BasePublicState }
  | { type: typeof MESSAGE_TYPES.GAME_ERROR; payload: { message: string } };

// Reads untrusted data as an object whose fields are all still unchecked, or null if it is not an object
export function asRecord(value: unknown): Record<string, unknown> | null {
  // Any non-null object can be read field by field; each field stays `unknown`
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
