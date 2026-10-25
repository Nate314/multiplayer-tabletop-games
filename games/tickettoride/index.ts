import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { tickettorideInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const tickettoride: GameDefinition<GameState, PublicGameState> = {
  info: tickettorideInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, deck: shuffle(state.deck, random), ticketDeck: shuffle(state.ticketDeck, random) }),
  toPublicState,
  finalStandings
};
