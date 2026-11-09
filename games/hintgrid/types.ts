// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Team = 'red' | 'blue';
export type CardKind = Team | 'bystander' | 'trap';
export type Role = { team: Team; clueGiver: boolean };
export type Clue = { team: Team; word: string; count: number };

export type LastMove =
  | { type: 'clue'; playerNumber: Seat; clue: Clue }
  | { type: 'guess'; playerNumber: Seat; index: number; kind: CardKind }
  | { type: 'endGuessing'; playerNumber: Seat };

// The full state, which never leaves the server: only clue-givers see `key`
export type GameState = BaseGameState & {
  roles: Partial<Record<Seat, Role>>;
  words: string[]; // 25
  key: CardKind[]; // 25
  revealed: boolean[]; // 25
  startingTeam: Team;
  turn: Team;
  phase: 'clue' | 'guessing';
  clue: Clue | null;
  guessesLeft: number;
  guessesThisTurn: number;
  clues: Clue[];
  lastMove: LastMove | null;
};

export type PublicGameState = Omit<GameState, 'key'> &
  BasePublicState & {
    key: (CardKind | null)[]; // null for a face-down card the viewer may not see
    left: Record<Team, number>; // each team's words still face down
  };
