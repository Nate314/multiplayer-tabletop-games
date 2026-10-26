import type { HouseRulesState } from './houseRules.ts';
import type { Reaction, RecordedReaction } from './reactions.ts';

export const MAX_NAME_LENGTH = 20; // applies to player names and game IDs

export type Seat = number; // 1-based, seated in join order
export type Result<T> = { state: T } | { error: string };
export type Random = () => number;
export type Standing = { seat: Seat; place: number; score?: string }; // place 1 is first; ties share a place
export type GameResult = {
  archiveId: string; // <gameType>/<gameId>#<n>
  gameType: string;
  gameId: string;
  startedAt: number;
  finishedAt: number;
  moveCount: number;
  standings: Standing[];
  players: { seat: Seat; name: string; deviceId?: string }[];
  abandoned?: boolean; // the platform ended the game because fewer than two players remained
};
export type UndoVote = { requestedBy: Seat; votes: Record<Seat, boolean> };
export type DismissVote = { target: Seat; requestedBy: Seat; votes: Record<Seat, boolean> };
export type RematchVote = { requestedBy: Seat; votes: Record<Seat, boolean> }; // true Join, false Drop

export type JoinRole = 'player' | 'spectator' | 'passAndPlay' | 'tableScreen';
export type Spectator = { id: string; name: string; tableScreen: boolean; allowedSeats: Seat[] };
export type HandRequest = { spectator: string; seat: Seat };

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
  rematchVote?: RematchVote | null; // only once the game is over; missing in rooms saved before rematches
  houseRules?: HouseRulesState; // missing in games saved before house rules; read through houseRulesOf / houseRule
  turnStartedAt?: number | null; // server time the turn began, shifted later by paused time; absent with the turn timer off
  turnPausedAt?: number | null; // server time a pausing vote opened; null while the clock runs
  seatKeys?: Record<Seat, string>; // the secret each seat's rejoin must send; the server strips it from every view
  seatDevices?: Record<Seat, string>; // the SHA-256 of the device ID each seat joined with; stripped from every view, like seatKeys
  spectators?: Spectator[]; // missing in games saved before spectators
  handRequests?: HandRequest[];
  spectatorKeys?: Record<string, string>; // the secret each spectator's rejoin must send; stripped from every view, like seatKeys
  startedAt?: number; // server ms of the first move
  finishedAt?: number; // server ms when isGameOver first became true
  gameNumber?: number; // the n of archiveId; missing means 1
  reactions?: RecordedReaction[]; // the live log, stripped from every view and snapshot
};

export type BasePublicState = BaseGameState & {
  undoAvailable: boolean;
  moveCount: number; // moves on the timeline; undo lowers it
  standings?: Standing[]; // only once isGameOver
  serverTime?: number; // only on live views, so a client countdown can correct for its own clock
  seatViews?: Record<Seat, unknown>; // only on a spectator's live view: the private view of each seat that allowed it
};

// A room anyone can see in the open games list: names only, never a seat key
export type OpenGame = { gameType: string; gameId: string; players: string[]; playing: boolean };

// One step of a game's history: the starting board, the board after each move, and the end if no move ended it
export type HistoryStep = Omit<BasePublicState, 'reactions'> & { historyStep: 'start' | 'move' | 'end'; reactions?: Reaction[] };
