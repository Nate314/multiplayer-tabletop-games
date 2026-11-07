import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { guessGame } from '../../shared/guessing/turns.ts';
import type { Random, Result, Seat } from '../../shared/types.ts';
import { PROMPT_CHOICES, TURNS_PER_PLAYER, TURN_SECONDS } from './options.ts';
import { PROMPTS } from './prompts.ts';
import type { GameState } from './types.ts';

const game = guessGame<GameState>({
  words: PROMPTS, turnSeconds: TURN_SECONDS, choices: PROMPT_CHOICES, turnsPerPlayer: TURNS_PER_PLAYER,
  noun: 'prompt', verb: 'acting', freshTurn: () => ({})
});

export const {
  resetLobby, applyMove, recordsAction, deadline, onDeadline, resumeClock, onPlayerLeft, toPublicState, privateSeatView,
  spectatorState, finalStandings
} = game;

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...game.guessFields() };
}

// The acting happens on camera, so chat (which doubles as guessing) is the only action
export function applyAction(state: GameState, seat: Seat, action: unknown, _random: Random, now: number): Result<GameState> {
  if (asRecord(action)?.type !== 'chat') return { error: 'Invalid action' };
  return game.chatAction(state, seat, action, now);
}
