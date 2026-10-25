// Farkle rules shared by the browser (the score of a selection) and the server (validation),
// from https://en.wikipedia.org/wiki/Farkle.
import { rollDice } from '../../shared/dice.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import { canScore, score } from './scoring.ts';
import type { GameState, LastMove, PublicGameState, Result, Seat } from './types.ts';
import { TARGET_RULE } from './options.ts';

export const targetScore = (state: Pick<GameState, 'houseRules'>): number => houseRule(state, TARGET_RULE);
export const DICE_COUNT = 6;

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    scores: {},
    dice: [],
    setAside: [],
    turnTotal: 0,
    triggeredBy: null,
    finalTurns: [],
    lastMove: null
  };
}

const NEW_TURN = { dice: [], setAside: [], turnTotal: 0 };

// Before the first move every seat is on zero and the first seat to join rolls
export function resetLobby(state: GameState): GameState {
  return {
    ...state,
    ...NEW_TURN,
    scores: Object.fromEntries(state.activePlayers.map(seat => [seat, 0])),
    triggeredBy: null,
    finalTurns: [],
    lastMove: null
  };
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

const pointsText = (points: number) => `${points} ${points === 1 ? 'point' : 'points'}`;

// One line about a move, for the status line and the history
export function moveText(name: string, lastMove: LastMove): string {
  if (lastMove.type === 'bank') return `${name} banked ${pointsText(lastMove.total)}`;
  const set = lastMove.kept.length > 0 ? `set aside ${lastMove.kept.join(', ')} for ${pointsText(lastMove.points)} and ` : '';
  const rolled = `rolled ${lastMove.dice.join(', ')}`;
  if (lastMove.farkle) return `${name} ${set}${rolled}: Farkle! ${name} loses ${pointsText(lastMove.lost)}`;
  return `${name} ${set}${lastMove.hot ? 'has hot dice and ' : ''}${rolled}`;
}

function withLastMove(state: GameState, lastMove: LastMove, extra = ''): GameState {
  return { ...state, lastMove, gameStatus: moveText(state.playerNames[lastMove.playerNumber], lastMove) + extra };
}

// The highest total among the players still seated wins; equal totals share the win
function finish(state: GameState): GameState {
  const best = Math.max(...state.activePlayers.map(seat => state.scores[seat]));
  const winners = state.activePlayers.filter(seat => state.scores[seat] === best);
  const names = winners.map(seat => state.playerNames[seat]).join(' and ');
  const gameStatus = `${state.gameStatus}. ${names} ${winners.length > 1 ? 'tie' : 'wins'} with ${best}!`;
  return { ...state, ...NEW_TURN, isGameOver: true, currentPlayer: null, winners, gameStatus };
}

// The turn is over: the next player starts fresh, unless the last of the final turns was just played
function endTurn(state: GameState, seat: Seat): GameState {
  const finalTurns = state.finalTurns.filter(owed => owed !== seat);
  const next = { ...state, ...NEW_TURN, finalTurns };
  if (state.triggeredBy !== null && finalTurns.length === 0) return finish(next);
  return { ...next, currentPlayer: nextActivePlayer(next, seat) };
}

// A dismissed player's turn is dropped, and they are no longer owed a last turn
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const abandoned = state.dice.length > 0 && state.lastMove?.playerNumber === seat;
  const finalTurns = state.finalTurns.filter(owed => owed !== seat);
  const next = { ...state, ...(abandoned ? NEW_TURN : {}), finalTurns };
  return state.triggeredBy !== null && finalTurns.length === 0 ? finish(next) : next;
}

// The indexes of the dice to set aside, each a distinct die of the roll; null when the move is malformed
function keptIndexes(input: Record<string, unknown>, rollLength: number): number[] | null {
  const { keep } = input;
  if (!Array.isArray(keep)) return null;
  const valid = keep.every(index => Number.isInteger(index) && index >= 0 && index < rollLength);
  return valid && new Set(keep).size === keep.length ? keep : null;
}

// The dice the move sets aside and what they score, or an error
function setAsideBy(state: GameState, input: Record<string, unknown>): { kept: number[]; points: number } | { error: string } {
  if (state.dice.length === 0) {
    if (!Array.isArray(input.keep)) return { error: 'Invalid dice' };
    return input.keep.length === 0 ? { kept: [], points: 0 } : { error: 'Nothing to set aside before the first roll' };
  }
  const indexes = keptIndexes(input, state.dice.length);
  if (!indexes) return { error: 'Invalid dice' };
  if (indexes.length === 0) return { error: 'Set aside at least one scoring die' };
  const kept = indexes.map(index => state.dice[index]);
  const points = score(kept);
  return points === null ? { error: 'Every die you set aside must score' } : { kept, points };
}

function roll(state: GameState, seat: Seat, input: Record<string, unknown>, random: Random): Result<GameState> {
  const aside = setAsideBy(state, input);
  if ('error' in aside) return aside;
  const { kept, points } = aside;

  const turnTotal = state.turnTotal + points;
  const left = state.dice.length - kept.length;
  const hot = state.dice.length > 0 && left === 0;
  const dice = rollDice(state.dice.length === 0 || hot ? DICE_COUNT : left, random);
  const setAside = hot ? [] : [...state.setAside, ...kept];
  const farkle = !canScore(dice);
  const lastMove: LastMove = { type: 'roll', playerNumber: seat, kept, points, dice, hot, farkle, lost: turnTotal };

  if (farkle) return { state: endTurn(withLastMove(state, lastMove), seat) };
  return { state: withLastMove({ ...state, dice, setAside, turnTotal }, lastMove) };
}

function bank(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  if (state.dice.length === 0) return { error: 'Roll before you bank' };
  const aside = setAsideBy(state, input);
  if ('error' in aside) return aside;

  const total = state.turnTotal + aside.points;
  const scores = { ...state.scores, [seat]: state.scores[seat] + total };
  const lastMove: LastMove = { type: 'bank', playerNumber: seat, kept: aside.kept, points: aside.points, total };
  let next = withLastMove({ ...state, scores }, lastMove);
  if (state.triggeredBy === null && scores[seat] >= targetScore(state)) {
    const finalTurns = state.activePlayers.filter(other => other !== seat);
    next = { ...next, triggeredBy: seat, finalTurns, gameStatus: `${next.gameStatus}. Everyone else gets one more turn` };
  }
  return { state: endTurn(next, seat) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const input = asRecord(move);
  switch (input?.type) {
    case 'roll': return roll(state, seat, input, random);
    case 'bank': return bank(state, seat, input);
    default: return { error: 'Unknown move type' };
  }
}
