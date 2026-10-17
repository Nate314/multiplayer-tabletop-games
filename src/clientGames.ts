import type { ComponentType } from 'react';
import type { GameInfo } from '../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../shared/types.ts';
import { quoridorClient } from '../games/quoridor/client/index.ts';
import { azulClient } from '../games/azul/client/index.ts';

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
  HistoryBoard: ComponentType<{ gameState: any }>;
  // The move that produced a public state, from its lastMove and playerNames, e.g. 'Alice placed a wall'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  describeMove(gameState: any): string;
};

export const CLIENT_GAMES: Record<string, ClientGame> = {
  [quoridorClient.id]: quoridorClient,
  [azulClient.id]: azulClient
};

// A game's rules and screen together, as the landing list and game view use them
export type PlayableGame = { info: GameInfo; client: ClientGame };
