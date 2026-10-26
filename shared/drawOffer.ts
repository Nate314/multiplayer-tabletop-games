// Resigning and draws by agreement for two-player games, applied as game actions (see GameDefinition.applyAction).
// A game adds DrawOfferState to its state, passes unknown actions to applyEndingAction, and calls lapseDrawOffer after each move.
import { asRecord } from './messages.ts';
import type { BaseGameState, Result, Seat } from './types.ts';

export type DrawOfferState = {
  drawOffer: Seat | null; // the seat whose draw offer waits for an answer
};

export type EndingAction = { type: 'resign' } | { type: 'offerDraw' } | { type: 'answerDraw'; accept: boolean };

type EndingState = BaseGameState & DrawOfferState;

// Whether a resignation by `seat` is scored as a draw, as in chess when the opponent could never checkmate
export type ResignationDraws<S> = (state: S, seat: Seat) => boolean;

export function otherSeat(state: Pick<BaseGameState, 'activePlayers'>, seat: Seat): Seat {
  return state.activePlayers.find(other => other !== seat) as Seat; // both seats are filled while the game runs
}

// Why nobody may resign, offer, answer or claim a draw right now, or null when they may
export function endingRefusal(state: BaseGameState): string | null {
  if (state.isGameOver) return 'The game is over';
  if (!state.started) return 'The game has not started';
  if (state.undoVote || state.dismissVote) return 'A vote is in progress';
  return null;
}

// Ends the game; no winners is a draw
export function endGame<S extends EndingState>(state: S, winners: Seat[], gameStatus: string): S {
  return { ...state, isGameOver: true, currentPlayer: null, winners, drawOffer: null, gameStatus };
}

function resign<S extends EndingState>(state: S, seat: Seat, drawn: boolean): S {
  const name = state.playerNames[seat];
  const winner = otherSeat(state, seat);
  return drawn
    ? endGame(state, [], `${name} resigned, but ${state.playerNames[winner]} could never checkmate. Draw.`)
    : endGame(state, [winner], `${name} resigned. ${state.playerNames[winner]} wins!`);
}

function answerDraw<S extends EndingState>(state: S, seat: Seat, accept: boolean): Result<S> {
  if (state.drawOffer !== otherSeat(state, seat)) return { error: 'There is no draw offer to answer' };
  if (accept) return { state: endGame(state, [], 'Draw by agreement') };
  return { state: { ...state, drawOffer: null, gameStatus: `${state.playerNames[seat]} declined the draw` } };
}

// Offering when the opponent has already offered is an agreement
function offerDraw<S extends EndingState>(state: S, seat: Seat): Result<S> {
  if (state.drawOffer === seat) return { error: 'You have already offered a draw' };
  if (state.drawOffer !== null) return answerDraw(state, seat, true);
  return { state: { ...state, drawOffer: seat, gameStatus: `${state.playerNames[seat]} offers a draw` } };
}

// Applies an EndingAction from untrusted input, at any time while the game runs, on either player's turn
export function applyEndingAction<S extends EndingState>(
  state: S,
  seat: Seat,
  action: unknown,
  resignationDraws: ResignationDraws<S> = () => false
): Result<S> {
  const input = asRecord(action);
  const type = input?.type;
  if (type !== 'resign' && type !== 'offerDraw' && type !== 'answerDraw') return { error: 'Unknown action' };
  const refusal = endingRefusal(state);
  if (refusal) return { error: refusal };

  if (type === 'resign') return { state: resign(state, seat, resignationDraws(state, seat)) };
  if (type === 'offerDraw') return offerDraw(state, seat);
  return answerDraw(state, seat, input?.accept === true);
}

// A move by the offerer's opponent declines the offer; the offerer's own move leaves it standing
export function lapseDrawOffer<S extends EndingState>(state: S, mover: Seat): S {
  return state.drawOffer !== null && state.drawOffer !== mover ? { ...state, drawOffer: null } : state;
}

// The opponent of an open offer, for a game's waitingOn
export function drawOfferAnswerers(state: EndingState): Seat[] {
  return state.drawOffer === null || state.isGameOver ? [] : [otherSeat(state, state.drawOffer)];
}
