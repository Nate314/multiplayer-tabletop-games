import type { HouseRulesState } from './houseRules.ts';

export const MAX_NAME_LENGTH = 20; // applies to player names and game IDs

export type Seat = number; // 1-based, seated in join order
export type Result<T> = { state: T } | { error: string };
export type Random = () => number;
export type UndoVote = { requestedBy: Seat; votes: Record<Seat, boolean> };
export type DismissVote = { target: Seat; requestedBy: Seat; votes: Record<Seat, boolean> };

// What every game's state has in common; games extend it with their own fields
export type BaseGameState = {
  gameId: string;
  started: boolean; // true after the first move; locks joining
  currentPlayer: Seat | null;
  activePlayers: Seat[]; // always sorted ascending
  playerNames: Record<Seat, string>;
  gameStatus: string;
  isGameOver: boolean;
  winners: Seat[];
  undoVote: UndoVote | null;
  disconnected: Seat[]; // held seats, sorted ascending; always a subset of activePlayers
  dismissVote: DismissVote | null;
  houseRules?: HouseRulesState; // missing in games saved before house rules; read through houseRulesOf / houseRule
  seatKeys?: Record<Seat, string>; // the secret each seat's rejoin must send; the server strips it from every view
};

export type BasePublicState = BaseGameState & {
  undoAvailable: boolean;
  moveCount: number; // moves on the timeline; undo lowers it
  serverTime?: number; // only on live views, so a client countdown can correct for its own clock
};

// One step of a game's history: the starting board, the board after each move, and the end if no move ended it
export type HistoryStep = BasePublicState & { historyStep: 'start' | 'move' | 'end' };
