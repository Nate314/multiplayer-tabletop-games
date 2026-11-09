// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Random, Result, Seat } from '../../shared/types.ts';

export type Resource = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
export type Resources = Record<Resource, number>;

export type DevCard = 'knight' | 'victoryPoint' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly';

export type PortKind = Resource | 'any'; // 'any' trades 3:1, a resource 2:1

// One land hex of the random layout: its resource (null for the desert) and number token (null for the desert)
export type Hex = { resource: Resource | null; number: number | null };
export type Port = { edge: number; kind: PortKind };
export type Layout = { hexes: Hex[]; ports: Port[] };

// A settlement or a city on an intersection
export type Building = { seat: Seat; city: boolean };

// The rest of a turn that must be finished before anything else
export type Pending =
  | { kind: 'discard'; counts: Record<Seat, number> } // players with more than 7 cards discard half, as actions
  | { kind: 'robber' } // the robber must move, after a 7 or a Knight
  | { kind: 'roadBuilding'; roads: number }; // free roads left from a Road Building card

// Setup: each seat in `order` places a settlement and then a road next to it; the second round's settlement produces
export type Setup = { order: Seat[]; step: number; settlement: number | null };

// A domestic offer from the turn holder to one player (`to`) or to everyone (`to: null`); the first to accept trades
export type Trade = { from: Seat; to: Seat | null; give: Resources; get: Resources; declined: Seat[] };

// Who stole from whom; the resource is seen only by those two
export type Steal = { thief: Seat; victim: Seat; resource: Resource | null };

// The 5-6 player special build phase after a turn: builders[0] has the build chance now; the rest wait in turn order
export type SpecialBuild = { builders: Seat[] };

export type Move =
  | { type: 'placeSettlement'; vertex: number } // setup
  | { type: 'placeRoad'; edge: number } // setup, or a free road from Road Building
  | { type: 'roll' }
  | { type: 'buildRoad'; edge: number }
  | { type: 'buildSettlement'; vertex: number }
  | { type: 'buildCity'; vertex: number }
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  | { type: 'moveRobber'; hex: number; victim: Seat | null }
  | { type: 'bankTrade'; give: Resource; get: Resource }
  | { type: 'endTurn' }
  | { type: 'passBuild' }; // Done building, in the special build phase

// Not turn-bound and not undoable
export type Action =
  | { type: 'discard'; resources: Resources }
  | { type: 'offerTrade'; to: Seat | null; give: Resources; get: Resources }
  | { type: 'answerTrade'; accept: boolean }
  | { type: 'cancelTrade' };

// The move that produced a state and what followed from it, e.g. ['Alice rolled 4 and 5', 'Bob took 1 wheat']
export type LastMove = { type: Move['type']; playerNumber: Seat; events: string[] };

// The full state, which never leaves the server: hands, unplayed development cards and the deck order are hidden
export type GameState = BaseGameState & {
  layout: Layout;
  robber: number; // the hex the robber is on
  roads: Record<number, Seat>; // edge to owner
  buildings: Record<number, Building>; // vertex to building
  hands: Record<Seat, Resources>;
  bank: Resources;
  devDeck: DevCard[]; // top first
  devCards: Record<Seat, DevCard[]>; // unplayed, held since before this turn (Victory Point cards stay here)
  boughtThisTurn: DevCard[]; // the turn holder's cards bought this turn, playable from their next turn
  devPlayed: boolean; // the turn holder has played a development card this turn
  knights: Record<Seat, number>; // Knights played
  longestRoad: Seat | null;
  largestArmy: Seat | null;
  setup: Setup | null; // null once setup is over
  turnHolder: Seat | null;
  rolled: boolean;
  dice: [number, number] | null; // the most recent roll
  pending: Pending | null;
  specialBuild: SpecialBuild | null; // missing in older saves, read by truthiness only
  trade: Trade | null;
  steal: Steal | null; // the most recent steal, shown until the next
  log: string[]; // the most recent events, newest last
  lastMove: LastMove | null;
};

// What every viewer sees of each player: counts only, and points without unrevealed Victory Point cards
export type PublicGameState = Omit<GameState, 'hands' | 'devDeck' | 'devCards' | 'boughtThisTurn'> & BasePublicState & {
  handCounts: Record<Seat, number>;
  devCounts: Record<Seat, number>; // unplayed development cards, including any bought this turn
  points: Record<Seat, number>; // as the viewer may see them
  roadLengths: Record<Seat, number>;
  devDeckCount: number;
  viewer: Seat | null;
  hand: Resources | null; // the viewer's own cards, null for the table view
  myDevCards: DevCard[]; // the viewer's own unplayed cards held since before this turn
  myNewDevCards: DevCard[]; // the viewer's own cards bought this turn
};
