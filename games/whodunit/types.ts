// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';
import type { Position } from './board.ts';
import type { CardId, ObjectId, RoomId, SuspectId } from './content.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Solution = { suspect: SuspectId; object: ObjectId; room: RoomId };
export type Mark = 'yes' | 'no' | 'maybe';
export type Suggestion = Solution & { by: Seat; passed: Seat[]; shownBy: Seat | null; awaiting: Seat | null }; // awaiting: who must show now
export type Seen = { suggestion: number; from: Seat; to: Seat; card: CardId }; // suggestion indexes into suggestions
export type Accusation = Solution & { by: Seat; correct: boolean };
export type Phase = 'start' | 'move' | 'room' | 'showing' | 'end';

export type Move =
  | { type: 'roll' } | { type: 'passage' } | { type: 'stay' }
  | { type: 'moveTo'; to: Position } | { type: 'stayPut' }
  | { type: 'suggest'; suspect: SuspectId; object: ObjectId }
  | { type: 'show'; card: CardId }
  | { type: 'accuse'; suspect: SuspectId; object: ObjectId; room: RoomId }
  | { type: 'endTurn' };

export type Action = { type: 'note'; card: CardId; mark: Mark | null };

// sealed: the step showed a card or judged an accusation, so History hides the detail
export type LastMove = { type: Move['type']; playerNumber: Seat; dice?: [number, number]; to?: Position; sealed?: true };

export type GameState = BaseGameState & {
  solution: Solution | null; // null only before the deal
  hands: Record<Seat, CardId[]>;
  faceUp: Record<Seat, CardId[]>; // dismissed players' cards, public
  suspectOf: Record<Seat, SuspectId>; // seat n plays SUSPECTS[n - 1]
  positions: Record<SuspectId, Position>;
  objectRooms: Record<ObjectId, RoomId>;
  phase: Phase;
  dice: [number, number] | null;
  destinations: Position[]; // phase 'move' only
  leftRoom: RoomId | null; // the room the mover left this turn
  movedIn: SuspectId[]; // moved into a room by a suggestion since their last turn
  suggestions: Suggestion[];
  seen: Seen[];
  accusations: Accusation[];
  out: Seat[]; // accused wrongly
  notes: Record<Seat, Partial<Record<CardId, Mark>>>;
  lastMove: LastMove | null;
};

export type PublicGameState = Omit<GameState, 'solution' | 'hands' | 'seen' | 'notes'> & BasePublicState & {
  solution: Solution | null; // null until the game is over
  hand: CardId[]; // the viewer's own; [] for null
  handSizes: Record<Seat, number>;
  seen: Seen[]; // only entries whose from or to is the viewer
  notes: Partial<Record<CardId, Mark>>; // the viewer's own; {} for null
};
