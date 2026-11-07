import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { guessGame } from '../../shared/guessing/turns.ts';
import type { Random, Result, Seat } from '../../shared/types.ts';
import { CANVAS_H, CANVAS_W, MAX_POINTS, PALETTE } from './clock.ts';
import { DRAWS_PER_PLAYER, TURN_SECONDS, WORD_CHOICES } from './options.ts';
import type { GameState, Stroke, Tool } from './types.ts';
import { WORDS } from './words.ts';

export { DRAWER_POINTS, guesserPoints } from '../../shared/guessing/turns.ts';

const game = guessGame<GameState>({
  words: WORDS, turnSeconds: TURN_SECONDS, choices: WORD_CHOICES, turnsPerPlayer: DRAWS_PER_PLAYER,
  noun: 'word', verb: 'drawing', freshTurn: () => ({ strokes: [] })
});

export const {
  resetLobby, applyMove, recordsAction, deadline, onDeadline, resumeClock, onPlayerLeft, toPublicState, privateSeatView,
  spectatorState, finalStandings
} = game;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...game.guessFields(), strokes: [], nextStrokeId: 1 };
}

const MAX_ACTION_NUMBERS = 200;
const STROKE_ACTIONS = ['stroke', 'extend', 'fill', 'undoStroke', 'clear'];

const isColor = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < PALETTE.length;
const isCoord = (value: unknown, max: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

function validPoints(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= MAX_ACTION_NUMBERS && value.length % 2 === 0
    && value.every((n, i) => isCoord(n, i % 2 === 0 ? CANVAS_W : CANVAS_H));
}

const usedPoints = (strokes: Stroke[]) => strokes.reduce((sum, stroke) => sum + (stroke.kind === 'line' ? stroke.points.length : 2), 0);

// shortcut: every stroke action rewrites and broadcasts the whole state, so MAX_POINTS and the client's 100 ms batching keep it small, upgrade to a platform broadcast-only channel if drawings lag
function drawAction(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  if (state.phase !== 'drawing' || seat !== state.drawer || state.isGameOver) return { error: 'Only the drawer can draw' };
  const strokes = state.strokes;
  const last = strokes[strokes.length - 1];
  const add = (stroke: Stroke): Result<GameState> => ({ state: { ...state, strokes: [...strokes, stroke], nextStrokeId: state.nextStrokeId + 1 } });
  const full = (extra: number) => usedPoints(strokes) + extra > MAX_POINTS;
  const fullError = { error: 'The drawing is full; undo or clear to keep drawing' };
  switch (input.type) {
    case 'undoStroke': return { state: { ...state, strokes: strokes.slice(0, -1) } };
    case 'clear': return { state: { ...state, strokes: [] } };
    case 'fill':
      if (!isColor(input.color) || !isCoord(input.x, CANVAS_W) || !isCoord(input.y, CANVAS_H)) return { error: 'Invalid fill' };
      return full(2) ? fullError : add({ id: state.nextStrokeId, kind: 'fill', color: input.color, x: input.x, y: input.y });
    case 'extend': {
      if (last?.kind !== 'line' || input.id !== last.id || !validPoints(input.points)) return { error: 'Invalid stroke' };
      const points = input.points;
      if (full(points.length)) return fullError;
      return { state: { ...state, strokes: [...strokes.slice(0, -1), { ...last, points: [...last.points, ...points] }] } };
    }
    default: {
      const { tool, color, size, points } = input;
      if ((tool !== 'pen' && tool !== 'eraser') || !isColor(color) || (size !== 0 && size !== 1 && size !== 2) || !validPoints(points)) {
        return { error: 'Invalid stroke' };
      }
      return full(points.length) ? fullError : add({ id: state.nextStrokeId, kind: 'line', tool: tool as Tool, color, size, points });
    }
  }
}

// Strokes from the drawer; anything else is chat, which doubles as guessing
export function applyAction(state: GameState, seat: Seat, action: unknown, _random: Random, now: number): Result<GameState> {
  const input = asRecord(action);
  if (typeof input?.type === 'string' && STROKE_ACTIONS.includes(input.type)) return drawAction(state, seat, input);
  return game.chatAction(state, seat, action, now);
}
