import type { GameDefinition } from '../../shared/gameDefinition.ts';
import {
  DOMINOES_RULES, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState
} from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const dominoes: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'dominoes',
    category: 'tile',
    name: 'Dominoes',
    description: 'Match tile ends to build a line and be first to play out your hand',
    minPlayers: 2,
    maxPlayers: 4,
    houseRules: DOMINOES_RULES
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo,
  toPublicState
};
