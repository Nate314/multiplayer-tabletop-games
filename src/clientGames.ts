import type { ComponentType } from 'react';
import type { BasePublicState, Seat } from '../shared/types.ts';
import { quoridorClient } from '../games/quoridor/client/index.ts';

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
};

export const CLIENT_GAMES: Record<string, ClientGame> = {
  [quoridorClient.id]: quoridorClient
};
