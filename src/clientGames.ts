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
  // How long the finished game took on the game-over screen, e.g. '5 rounds'; without it, the move count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameLength?(gameState: any): string;
  // The last round's scoring, shown under the standings on the game-over screen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FinalRound?: ComponentType<{ gameState: any; viewer: Seat | null }>;
};

// Each game's client is its own chunk, downloaded when first needed; use loadClientGame, which shares one download per game
export const CLIENT_LOADERS: Record<string, () => Promise<ClientGame>> = {
  palacewalls: () => import('../games/palacewalls/client/index.ts').then(m => m.palacewallsClient),
  backgammon: () => import('../games/backgammon/client/index.ts').then(m => m.backgammonClient),
  roadsandfields: () => import('../games/roadsandfields/client/index.ts').then(m => m.roadsandfieldsClient),
  categories: () => import('../games/categories/client/index.ts').then(m => m.categoriesClient),
  hexisland: () => import('../games/hexisland/client/index.ts').then(m => m.hexislandClient),
  charades: () => import('../games/charades/client/index.ts').then(m => m.charadesClient),
  checkers: () => import('../games/checkers/client/index.ts').then(m => m.checkersClient),
  chinesecheckers: () => import('../games/chinesecheckers/client/index.ts').then(m => m.chinesecheckersClient),
  chess: () => import('../games/chess/client/index.ts').then(m => m.chessClient),
  codebreaker: () => import('../games/codebreaker/client/index.ts').then(m => m.codebreakerClient),
  fourinarow: () => import('../games/fourinarow/client/index.ts').then(m => m.fourinarowClient),
  corners: () => import('../games/corners/client/index.ts').then(m => m.cornersClient),
  dominoes: () => import('../games/dominoes/client/index.ts').then(m => m.dominoesClient),
  euchre: () => import('../games/euchre/client/index.ts').then(m => m.euchreClient),
  farkle: () => import('../games/farkle/client/index.ts').then(m => m.farkleClient),
  fictionary: () => import('../games/fictionary/client/index.ts').then(m => m.fictionaryClient),
  go: () => import('../games/go/client/index.ts').then(m => m.goClient),
  gofish: () => import('../games/gofish/client/index.ts').then(m => m.gofishClient),
  hintgrid: () => import('../games/hintgrid/client/index.ts').then(m => m.hintgridClient),
  hearts: () => import('../games/hearts/client/index.ts').then(m => m.heartsClient),
  holdem: () => import('../games/holdem/client/index.ts').then(m => m.holdemClient),
  blocktower: () => import('../games/blocktower/client/index.ts').then(m => m.loadBlocktowerClient()),
  jigsaw: () => import('../games/jigsaw/client/index.ts').then(m => m.jigsawClient),
  mancala: () => import('../games/mancala/client/index.ts').then(m => m.mancalaClient),
  monopoly: () => import('../games/monopoly/client/index.ts').then(m => m.monopolyClient),
  naval: () => import('../games/naval/client/index.ts').then(m => m.navalClient),
  pachisi: () => import('../games/pachisi/client/index.ts').then(m => m.pachisiClient),
  phase10: () => import('../games/phase10/client/index.ts').then(m => m.phase10Client),
  pictionary: () => import('../games/pictionary/client/index.ts').then(m => m.pictionaryClient),
  pawnsandwalls: () => import('../games/pawnsandwalls/client/index.ts').then(m => m.pawnsandwallsClient),
  racko: () => import('../games/racko/client/index.ts').then(m => m.rackoClient),
  risk: () => import('../games/risk/client/index.ts').then(m => m.riskClient),
  roadtoretirement: () => import('../games/roadtoretirement/client/index.ts').then(m => m.roadtoretirementClient),
  rook: () => import('../games/rook/client/index.ts').then(m => m.rookClient),
  rummytiles: () => import('../games/rummytiles/client/index.ts').then(m => m.rummytilesClient),
  scrabble: () => import('../games/scrabble/client/index.ts').then(m => m.scrabbleClient),
  skipbo: () => import('../games/skipbo/client/index.ts').then(m => m.skipboClient),
  snakesladders: () => import('../games/snakesladders/client/index.ts').then(m => m.snakesladdersClient),
  spades: () => import('../games/spades/client/index.ts').then(m => m.spadesClient),
  splendor: () => import('../games/splendor/client/index.ts').then(m => m.splendorClient),
  steadyhand: () => import('../games/steadyhand/client/index.ts').then(m => m.steadyhandClient),
  sudoku: () => import('../games/sudoku/client/index.ts').then(m => m.sudokuClient),
  thecrew: () => import('../games/thecrew/client/index.ts').then(m => m.thecrewClient),
  tickettoride: () => import('../games/tickettoride/client/index.ts').then(m => m.tickettorideClient),
  tictactoe: () => import('../games/tictactoe/client/index.ts').then(m => m.tictactoeClient),
  tradingfloor: () => import('../games/tradingfloor/client/index.ts').then(m => m.tradingfloorClient),
  ultimatetictactoe: () => import('../games/ultimatetictactoe/client/index.ts').then(m => m.ultimatetictactoeClient),
  uno: () => import('../games/uno/client/index.ts').then(m => m.unoClient),
  war: () => import('../games/war/client/index.ts').then(m => m.warClient),
  whodunit: () => import('../games/whodunit/client/index.ts').then(m => m.whodunitClient),
  yahtzee: () => import('../games/yahtzee/client/index.ts').then(m => m.yahtzeeClient)
};
