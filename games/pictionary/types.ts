// Data shapes shared by the browser and the server
import type { ChatLine, GuessLastMove, GuessPublic, GuessState, Phase } from '../../shared/guessing/types.ts';

export type { Result, Seat, UndoVote } from '../../shared/types.ts';
export type { ChatLine, Phase };

export type Tool = 'pen' | 'eraser';

export type Stroke =
  | { id: number; kind: 'line'; tool: Tool; color: number; size: 0 | 1 | 2; points: number[] } // flat x,y pairs, integers 0..CANVAS_W/H
  | { id: number; kind: 'fill'; color: number; x: number; y: number };

export type LastMove = GuessLastMove;

// The guessing turn plus the drawing
export type GameState = GuessState & {
  strokes: Stroke[];
  nextStrokeId: number;
};

export type PublicGameState = GuessPublic<GameState>;
