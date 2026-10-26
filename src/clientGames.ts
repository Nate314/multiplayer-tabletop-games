import type { ComponentType } from 'react';
import type { BasePublicState, Seat } from '../shared/types.ts';
import type { MoveChange } from './animation/useMoveAnimation.ts';

export type FaqItem = { question: string; answer: string };

export type GameScreenProps<P extends BasePublicState> = { gameState: P; playerNumber: Seat; error: string | null };

// Everything the browser needs to show a game, loaded on demand; GameInfo in games/<id>/info.ts holds the rest
export type ClientGame = {
  id: string; // matches GameInfo.id
  // Games differ in their state types, so the registry holds screens type-erased
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Screen: ComponentType<GameScreenProps<any>>;
  faq: FaqItem[];
  // A read-only board of one public state with its lastMove highlighted, for the history dialog
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HistoryBoard: ComponentType<{ gameState: any; viewer: Seat | null }>;
  // The move that produced a public state, from its lastMove and playerNames, e.g. 'Alice placed a wall'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  describeMove(gameState: any): string;
  // Animates one step forward in the history dialog, as seen by the chosen seat (null for the table only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animateMove?: (change: MoveChange<any>, viewer: Seat | null) => void;
};

// Each game's client is its own chunk, downloaded when first needed; use loadClientGame, which shares one download per game
export const CLIENT_LOADERS: Record<string, () => Promise<ClientGame>> = {
  azul: () => import('../games/azul/client/index.ts').then(m => m.azulClient),
  backgammon: () => import('../games/backgammon/client/index.ts').then(m => m.backgammonClient),
  carcassonne: () => import('../games/carcassonne/client/index.ts').then(m => m.carcassonneClient),
  catan: () => import('../games/catan/client/index.ts').then(m => m.catanClient),
  checkers: () => import('../games/checkers/client/index.ts').then(m => m.checkersClient),
  chess: () => import('../games/chess/client/index.ts').then(m => m.chessClient),
  connectfour: () => import('../games/connectfour/client/index.ts').then(m => m.connectfourClient),
  dominoes: () => import('../games/dominoes/client/index.ts').then(m => m.dominoesClient),
  euchre: () => import('../games/euchre/client/index.ts').then(m => m.euchreClient),
  farkle: () => import('../games/farkle/client/index.ts').then(m => m.farkleClient),
  gofish: () => import('../games/gofish/client/index.ts').then(m => m.gofishClient),
  hearts: () => import('../games/hearts/client/index.ts').then(m => m.heartsClient),
  holdem: () => import('../games/holdem/client/index.ts').then(m => m.holdemClient),
  mancala: () => import('../games/mancala/client/index.ts').then(m => m.mancalaClient),
  monopoly: () => import('../games/monopoly/client/index.ts').then(m => m.monopolyClient),
  parchisi: () => import('../games/parchisi/client/index.ts').then(m => m.parchisiClient),
  phase10: () => import('../games/phase10/client/index.ts').then(m => m.phase10Client),
  pictionary: () => import('../games/pictionary/client/index.ts').then(m => m.pictionaryClient),
  quoridor: () => import('../games/quoridor/client/index.ts').then(m => m.quoridorClient),
  racko: () => import('../games/racko/client/index.ts').then(m => m.rackoClient),
  risk: () => import('../games/risk/client/index.ts').then(m => m.riskClient),
  rook: () => import('../games/rook/client/index.ts').then(m => m.rookClient),
  rummikub: () => import('../games/rummikub/client/index.ts').then(m => m.rummikubClient),
  scrabble: () => import('../games/scrabble/client/index.ts').then(m => m.scrabbleClient),
  skipbo: () => import('../games/skipbo/client/index.ts').then(m => m.skipboClient),
  spades: () => import('../games/spades/client/index.ts').then(m => m.spadesClient),
  splendor: () => import('../games/splendor/client/index.ts').then(m => m.splendorClient),
  thecrew: () => import('../games/thecrew/client/index.ts').then(m => m.thecrewClient),
  tickettoride: () => import('../games/tickettoride/client/index.ts').then(m => m.tickettorideClient),
  uno: () => import('../games/uno/client/index.ts').then(m => m.unoClient),
  war: () => import('../games/war/client/index.ts').then(m => m.warClient),
  yahtzee: () => import('../games/yahtzee/client/index.ts').then(m => m.yahtzeeClient)
};
