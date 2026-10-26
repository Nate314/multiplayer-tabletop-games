import type { HouseRulesProposal } from './houseRules.ts';
import type { BasePublicState, JoinRole, Seat } from './types.ts';
import type { Reaction } from './reactions.ts';

// WebSocket message types shared by the browser and the server
export const MESSAGE_TYPES = {
  JOIN_GAME: 'JOIN_GAME',
  GAME_JOINED: 'GAME_JOINED',
  MAKE_MOVE: 'MAKE_MOVE',
  GAME_ACTION: 'GAME_ACTION',
  SET_HOUSE_RULES: 'SET_HOUSE_RULES',
  AGREE_HOUSE_RULES: 'AGREE_HOUSE_RULES',
  REQUEST_UNDO: 'REQUEST_UNDO',
  VOTE_UNDO: 'VOTE_UNDO',
  REQUEST_HAND: 'REQUEST_HAND',
  ANSWER_HAND: 'ANSWER_HAND',
  SWITCH_TO_PLAYER: 'SWITCH_TO_PLAYER',
  REQUEST_DISMISS: 'REQUEST_DISMISS',
  VOTE_DISMISS: 'VOTE_DISMISS',
  REACT: 'REACT',
  SHOW_SEAT: 'SHOW_SEAT',
  REACTION: 'REACTION',
  GAME_STATE: 'GAME_STATE',
  GAME_ERROR: 'GAME_ERROR'
} as const;

export type ClientMessage =
  | { type: typeof MESSAGE_TYPES.JOIN_GAME; gameType: string; gameId: string; playerName: string; rejoin?: boolean; seatKey?: string; role?: JoinRole }
  // role 'passAndPlay': seats every name on this device; seatKeys follow the order of playerNames
  | { type: typeof MESSAGE_TYPES.JOIN_GAME; gameType: string; gameId: string; playerNames: string[]; rejoin?: boolean; seatKeys?: string[]; role: 'passAndPlay' }
  | { type: typeof MESSAGE_TYPES.SHOW_SEAT; payload: { seat: Seat | null } }
  | { type: typeof MESSAGE_TYPES.REQUEST_HAND; payload: { seat: Seat } }
  | { type: typeof MESSAGE_TYPES.ANSWER_HAND; payload: { spectator: string; allow: boolean } }
  | { type: typeof MESSAGE_TYPES.SWITCH_TO_PLAYER }
  | { type: typeof MESSAGE_TYPES.MAKE_MOVE; payload: { move: unknown; moveCount?: number } } // moveCount: the count the mover saw
  | { type: typeof MESSAGE_TYPES.GAME_ACTION; payload: { action: unknown } }
  | { type: typeof MESSAGE_TYPES.SET_HOUSE_RULES; payload: { proposal: HouseRulesProposal } }
  | { type: typeof MESSAGE_TYPES.AGREE_HOUSE_RULES; payload: { revision: number } }
  | { type: typeof MESSAGE_TYPES.REQUEST_UNDO }
  | { type: typeof MESSAGE_TYPES.VOTE_UNDO; payload: { approve: boolean } }
  | { type: typeof MESSAGE_TYPES.REQUEST_DISMISS; payload: { seat: Seat } }
  | { type: typeof MESSAGE_TYPES.VOTE_DISMISS; payload: { approve: boolean } }
  | { type: typeof MESSAGE_TYPES.REACT; payload: { target: Seat; emoji: string } };

export type ServerMessage =
  | { type: typeof MESSAGE_TYPES.GAME_JOINED; payload: { playerNumber: Seat | null; spectatorId?: string; seatKey: string; gameState: BasePublicState } }
  | { type: typeof MESSAGE_TYPES.GAME_JOINED; payload: { playerNumber: null; localSeats: { seat: Seat; seatKey: string }[]; gameState: BasePublicState; spectatorId?: undefined; seatKey?: undefined } }
  | { type: typeof MESSAGE_TYPES.GAME_STATE; payload: BasePublicState }
  | { type: typeof MESSAGE_TYPES.REACTION; payload: Reaction }
  | { type: typeof MESSAGE_TYPES.GAME_ERROR; payload: { message: string } };

// Reads untrusted data as an object whose fields are all still unchecked, or null if it is not an object
export function asRecord(value: unknown): Record<string, unknown> | null {
  // Any non-null object can be read field by field; each field stays `unknown`
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
