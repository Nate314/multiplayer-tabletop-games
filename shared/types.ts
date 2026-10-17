export type Seat = number; // 1-based, seated in join order
export type Result<T> = { state: T } | { error: string };
export type Random = () => number;
export type UndoVote = { requestedBy: Seat; votes: Record<Seat, boolean> };

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
};

export type BasePublicState = BaseGameState & { undoAvailable: boolean };
