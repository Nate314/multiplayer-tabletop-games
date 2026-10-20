import type { ComponentType } from 'react';
import type { GameInfo } from '../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../shared/types.ts';
import type { MoveChange } from './animation/useMoveAnimation.ts';
import { quoridorClient } from '../games/quoridor/client/index.ts';
import { azulClient } from '../games/azul/client/index.ts';
import { carcassonneClient } from '../games/carcassonne/client/index.ts';
import { chessClient } from '../games/chess/client/index.ts';
import { checkersClient } from '../games/checkers/client/index.ts';
import { connectfourClient } from '../games/connectfour/client/index.ts';
import { euchreClient } from '../games/euchre/client/index.ts';
import { backgammonClient } from '../games/backgammon/client/index.ts';
import { catanClient } from '../games/catan/client/index.ts';
import { mancalaClient } from '../games/mancala/client/index.ts';
import { monopolyClient } from '../games/monopoly/client/index.ts';
import { parchisiClient } from '../games/parchisi/client/index.ts';
import { rummikubClient } from '../games/rummikub/client/index.ts';
import { scrabbleClient } from '../games/scrabble/client/index.ts';
import { unoClient } from '../games/uno/client/index.ts';
import { phase10Client } from '../games/phase10/client/index.ts';
import { skipboClient } from '../games/skipbo/client/index.ts';
import { gofishClient } from '../games/gofish/client/index.ts';
import { warClient } from '../games/war/client/index.ts';
import { riskClient } from '../games/risk/client/index.ts';
import { rookClient } from '../games/rook/client/index.ts';
import { splendorClient } from '../games/splendor/client/index.ts';
import { tickettorideClient } from '../games/tickettoride/client/index.ts';
import { dominoesClient } from '../games/dominoes/client/index.ts';

export type FaqItem = { question: string; answer: string };

export type GameScreenProps<P extends BasePublicState> = { gameState: P; playerNumber: Seat; error: string | null };

// Everything the browser needs to show a game; GameInfo in games/registry.ts holds the rest
export type ClientGame = {
  id: string; // matches GameInfo.id
  // Games differ in their state types, so the registry holds screens type-erased
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Screen: ComponentType<GameScreenProps<any>>;
  faq: FaqItem[];
  icon: string; // a short glyph or emoji shown in the landing row
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

export const CLIENT_GAMES: Record<string, ClientGame> = {
  [quoridorClient.id]: quoridorClient,
  [azulClient.id]: azulClient,
  [carcassonneClient.id]: carcassonneClient,
  [chessClient.id]: chessClient,
  [checkersClient.id]: checkersClient,
  [connectfourClient.id]: connectfourClient,
  [euchreClient.id]: euchreClient,
  [backgammonClient.id]: backgammonClient,
  [catanClient.id]: catanClient,
  [mancalaClient.id]: mancalaClient,
  [monopolyClient.id]: monopolyClient,
  [parchisiClient.id]: parchisiClient,
  [rummikubClient.id]: rummikubClient,
  [scrabbleClient.id]: scrabbleClient,
  [unoClient.id]: unoClient,
  [phase10Client.id]: phase10Client,
  [skipboClient.id]: skipboClient,
  [gofishClient.id]: gofishClient,
  [warClient.id]: warClient,
  [riskClient.id]: riskClient,
  [rookClient.id]: rookClient,
  [splendorClient.id]: splendorClient,
  [tickettorideClient.id]: tickettorideClient,
  [dominoesClient.id]: dominoesClient
};

// A game's rules and screen together, as the landing list and game view use them
export type PlayableGame = { info: GameInfo; client: ClientGame };
