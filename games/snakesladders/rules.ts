// Snakes and ladders rules, run on the server: every roll is made here, so nothing is hidden
import { rollDie } from '../../shared/dice.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { rankStandings } from '../../shared/standings.ts';
import type { Standing } from '../../shared/types.ts';
import { FINISH, START, jumpFrom } from './board.ts';
import { EXACT_FINISH } from './options.ts';
import type { GameState, LastMove, PublicGameState, Random, Result, Seat } from './types.ts';

const ROLL_AGAIN = 6;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), positions: {}, lastMove: null };
}

export function resetLobby(state: GameState): GameState {
  return { ...state, positions: Object.fromEntries(state.activePlayers.map(seat => [seat, START])), lastMove: null };
}

// The platform has already passed the turn on, so only the token comes off the board
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const positions = { ...state.positions };
  delete positions[seat];
  return { ...state, positions };
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

export function describeLastMove({ playerNumber, roll, from, landed, to, via, stayed, again }: LastMove, playerNames: Record<Seat, string>): string {
  const rolled = `${playerNames[playerNumber]} rolled ${roll} and`;
  if (to === FINISH) return `${rolled} reached ${FINISH}`;
  const text = stayed ? `${rolled} needs exactly ${FINISH - from} to reach ${FINISH}`
    : via === 'ladder' ? `${rolled} climbed a ladder from ${landed} to ${to}`
      : via === 'snake' ? `${rolled} slid down a snake from ${landed} to ${to}`
        : `${rolled} moved from ${from} to ${to}`;
  return again ? `${text}, and rolls again` : text;
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  if (asRecord(move)?.type !== 'roll') return { error: 'Unknown move type' };

  const roll = rollDie(random);
  const from = state.positions[seat];
  const stayed = from + roll > FINISH && houseRule(state, EXACT_FINISH);
  const landed = stayed ? from : Math.min(from + roll, FINISH);
  const jump = jumpFrom(landed);
  const to = jump?.to ?? landed;
  const won = to === FINISH;
  const lastMove: LastMove = {
    type: 'roll', playerNumber: seat, roll, from, landed, to, via: jump?.via ?? null, stayed, again: roll === ROLL_AGAIN && !won
  };
  const next: GameState = {
    ...state, positions: { ...state.positions, [seat]: to }, lastMove, gameStatus: describeLastMove(lastMove, state.playerNames)
  };
  if (won) return { state: { ...next, isGameOver: true, winners: [seat], currentPlayer: null, gameStatus: `${state.playerNames[seat]} wins!` } };
  return { state: { ...next, currentPlayer: lastMove.again ? seat : nextActivePlayer(state, seat) } };
}

// Furthest along first, the winner on 100 at the top
export function finalStandings(state: GameState): Standing[] {
  const square = (seat: Seat) => state.positions[seat] ?? START;
  return rankStandings(state, (a, b) => square(b) - square(a),
    seat => square(seat) === FINISH ? `Reached ${FINISH}` : `Square ${square(seat)}`);
}
