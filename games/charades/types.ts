// Data shapes shared by the browser and the server: the guessing turn, with no fields of its own
import type { ChatLine, GuessLastMove, GuessPublic, GuessState, Phase } from '../../shared/guessing/types.ts';

export type { Seat } from '../../shared/types.ts';
export type { ChatLine, GuessLastMove as LastMove, Phase };

export type GameState = GuessState;
export type PublicGameState = GuessPublic<GameState>;
