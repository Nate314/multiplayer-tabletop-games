// The pause vote: every seated player must approve, and anyone can decline
import type { BaseGameState, Result, Seat } from './types.ts';

export function openPauseVote<S extends BaseGameState>(state: S, seat: Seat): Result<S> {
  if (!state.started) return { error: 'The game has not started' };
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.paused) return { error: 'The game is already paused' };
  if (state.undoVote || state.dismissVote || state.rematchVote || state.pauseVote) return { error: 'A vote is already in progress' };
  if (state.disconnected.length > 0) return { error: 'Everyone must be here to pause' };
  return {
    state: {
      ...state,
      pauseVote: { requestedBy: seat, votes: { [seat]: true } },
      gameStatus: `${state.playerNames[seat]} wants to pause the game`
    }
  };
}

export function castPauseVote<S extends BaseGameState>(state: S, seat: Seat, approve: unknown): Result<S> {
  const vote = state.pauseVote;
  if (!vote) return { error: 'No pause vote in progress' };
  if (seat in vote.votes) return { error: 'You already voted' };
  if (approve !== true) {
    return { state: { ...state, pauseVote: null, gameStatus: `${state.playerNames[seat]} declined to pause` } };
  }
  return { state: { ...state, pauseVote: { ...vote, votes: { ...vote.votes, [seat]: true } } } };
}

export function pauseVotePassed(state: BaseGameState): boolean {
  const vote = state.pauseVote;
  return !!vote && state.activePlayers.every(seat => vote.votes[seat] === true);
}
