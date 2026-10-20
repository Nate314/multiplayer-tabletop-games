// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';
import type { Seat } from '../../shared/types.ts';

export type Color = 'pink' | 'blue' | 'green' | 'yellow';
export type Suit = Color | 'rocket';

// A color card is 1 to 9, a rocket 1 to 4
export type Card = { suit: Suit; value: number };

// Order tokens on task cards: 1 to 5 fix a task's place among all tasks, arrows only order the arrow tasks among
// themselves, and omega makes a task the last one done
export type OrderToken = 1 | 2 | 3 | 4 | 5 | '>' | '>>' | '>>>' | '>>>>' | 'omega';

// Where the radio token sits on a communicated card
export type CommToken = 'highest' | 'lowest' | 'only';

export type Direction = 'left' | 'right';

// A mission's special rule, as structured data. The commander picks the player a rule names (`chosen` in the state).
export type Rule =
  | { kind: 'sick' } // the chosen crew member must not win a trick
  | { kind: 'oneWins'; count: number } // this many tricks must be won by a color card of value 1
  | { kind: 'mute' } // the chosen crew member, not the commander, may not communicate
  | { kind: 'drawFromRight' } // after the first trick each player draws a random card from the player on their right
  | { kind: 'rocketsWin'; ordered: boolean } // each rocket must win a trick, in order 1 to 4 when ordered
  | { kind: 'noNines' } // no trick may be won by a 9
  | { kind: 'takesAll' } // commander's decision: the tasks lie face down and the chosen crew member, not the commander, takes them all
  | { kind: 'distribution' } // commander's distribution: the commander hands out the tasks one at a time, evenly
  | { kind: 'swapTokens' } // before the tasks are chosen, two order tokens may swap places
  | { kind: 'moveToken' } // before the tasks are chosen, one order token may move to a task without one
  | { kind: 'balanced'; commanderFirstLast: boolean } // nobody may ever have won 2 tricks more than another
  | { kind: 'exactlyOneTrick' } // the chosen crew member wins exactly one trick, not with a rocket
  | { kind: 'firstAndLastOnly' } // the chosen crew member wins only the first and last tricks, neither with a rocket
  | { kind: 'allPink' } // the player left of the pink 9's holder must win every pink card
  | { kind: 'omegaInLastTrick' } // the omega task must be won in the last trick
  | { kind: 'relay' }; // the first chosen wins tricks 1 to 4 only, the second only the last, the rest all between

export type Mission = {
  number: number;
  tasks: number; // task cards drawn
  tokens: OrderToken[]; // given to the drawn task cards from the first one on
  deadSpot?: boolean; // a communicated card shows no radio token
  commsFrom?: number; // disruption: nobody communicates before this trick
  rule?: Rule;
};

export type Task = { card: Card; token: OrderToken | null; owner: Seat | null; done: boolean };

export type Communication = { card: Card; token: CommToken | null; beforeTrick: number };

export type Play = { seat: Seat; card: Card };
export type Trick = { plays: Play[]; winner: Seat };

// tokens: moving an order token (missions 23 and 40); decision: the commander picks a crew member; distribute: the
// commander hands out the tasks; choose: the crew takes tasks in turn; distress: everyone passes a card
export type Phase = 'tokens' | 'decision' | 'distribute' | 'choose' | 'distress' | 'play' | 'missionOver';

export type Move =
  | { type: 'takeTask'; task: number }
  | { type: 'choosePlayer'; seat: Seat }
  | { type: 'assignTask'; seat: Seat }
  | { type: 'moveToken'; from: number; to: number }
  | { type: 'keepTokens' }
  | { type: 'distress'; direction: Direction }
  | { type: 'handOverTask'; task: number; to: Seat }
  | { type: 'play'; card: Card };

// Not turn-bound and not undoable
export type Action =
  | { type: 'chooseMission'; mission: number }
  | { type: 'communicate'; card: Card; token?: CommToken }
  | { type: 'passCard'; card: Card }
  | { type: 'acknowledgeRound' }
  | { type: 'voteEnd'; yes: boolean };

// What a commander's pick means, for the status line
export type Role = 'sick' | 'mute' | 'takesAll' | 'oneTrick' | 'firstLast' | 'relayFirst' | 'relayLast';

export type LastMove =
  | { type: 'takeTask'; playerNumber: Seat; card: Card; token: OrderToken | null }
  | { type: 'choosePlayer'; playerNumber: Seat; seat: Seat; role: Role }
  | { type: 'assignTask'; playerNumber: Seat; seat: Seat; card: Card }
  | { type: 'moveToken'; playerNumber: Seat; from: Card; to: Card; swap: boolean }
  | { type: 'keepTokens'; playerNumber: Seat }
  | { type: 'distress'; playerNumber: Seat; direction: Direction }
  | { type: 'handOverTask'; playerNumber: Seat; from: Seat; to: Seat; card: Card }
  | { type: 'play'; playerNumber: Seat; card: Card; trickWinner: Seat | null; result: 'success' | 'failure' | null };

// How one attempt at a mission ended
export type MissionSummary = {
  mission: number;
  attempt: number;
  success: boolean;
  reason: string;
  distress: boolean; // the distress signal was sent during this mission, which counts one more attempt
  acknowledged: Seat[]; // the next attempt waits for every connected player
};

// The full state, which never leaves the server
export type GameState = BaseGameState & {
  startMission: number; // the lobby choice
  mission: number;
  attempt: number; // 1 for the first try at this mission
  lastCompleted: number | null; // the last mission the crew completed in this game
  distressUsed: boolean; // the distress signal is active for this mission, its retries included
  passedThisAttempt: boolean; // the distress pass already happened in this attempt
  handedOver: boolean; // the five-player task hand-over was used in this attempt
  phase: Phase;
  hands: Record<Seat, Card[]>;
  commander: Seat | null;
  tasks: Task[];
  chosen: Seat[]; // the crew members a special rule names
  communications: Record<Seat, Communication>;
  distress: { direction: Direction; passes: Record<Seat, Card> } | null;
  trick: Play[];
  lastTrick: Trick | null;
  tricks: Trick[]; // taken tricks lie face down; only the last one may be looked at
  roundSummary: MissionSummary | null;
  endVotes: Record<Seat, boolean>;
  lastMove: LastMove | null;
};

export type PublicTask = Omit<Task, 'card'> & { card: Card | null }; // null while it lies face down

// The game state as the server sends it to one browser: only that player's own hand and distress pass
export type PublicGameState =
  Omit<GameState, 'hands' | 'tasks' | 'tricks' | 'distress' | 'communications'> &
  BasePublicState & {
    hand: Card[]; // the viewer's own hand; empty for the table view
    handCounts: Record<Seat, number>;
    tasks: PublicTask[];
    trickWinners: Seat[]; // who won each trick so far
    communications: Record<Seat, Communication & { held: boolean }>; // held: the card is still in its owner's hand
    distress: { direction: Direction; passed: Seat[]; mine: Card | null } | null;
  };
