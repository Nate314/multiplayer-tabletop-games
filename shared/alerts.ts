import type { GameInfo } from './gameDefinition.ts';
import { everyoneAgreed, houseRulesOf, needsAgreement, tableLimit } from './houseRules.ts';
import { connectedPlayers } from './seating.ts';
import type { BaseGameState, BasePublicState, Seat } from './types.ts';

export type AlertKind = 'turn' | 'vote' | 'gameOver';
export type Alert = { kind: AlertKind; key: string }; // key changes only when a new alert begins

// Keys in the order alertFor reports them: undo, dismiss, rematch, hand request
export function votesWaitingOn(state: BaseGameState, seat: Seat): string[] {
  const keys: string[] = [];
  const asked = connectedPlayers(state).includes(seat);
  const { undoVote, dismissVote, rematchVote } = state;
  if (undoVote && asked && !(seat in undoVote.votes)) keys.push(`vote:undo:${undoVote.requestedBy}`);
  if (dismissVote && asked && seat !== dismissVote.target && !(seat in dismissVote.votes)) keys.push(`vote:dismiss:${dismissVote.target}`);
  if (rematchVote && state.activePlayers.includes(seat) && !(seat in rematchVote.votes)) keys.push(`vote:rematch:${rematchVote.requestedBy}`);
  for (const request of state.handRequests ?? []) if (request.seat === seat) keys.push(`vote:hand:${request.spectator}`);
  return keys;
}

export function alertFor(info: GameInfo, state: BasePublicState, seat: Seat): Alert | null {
  if (state.isGameOver) return { kind: 'gameOver', key: 'gameOver' };
  const [vote] = votesWaitingOn(state, seat);
  if (vote) return { kind: 'vote', key: vote };
  // The server only moves a lobby once the table agreed, so an ungated lobby turn is not yet a turn
  const live = state.started || !needsAgreement(info, houseRulesOf(info, state).values) || everyoneAgreed(info, state);
  const toAct = state.waitingOn ? state.waitingOn.includes(seat) : state.currentPlayer === seat;
  return live && toAct && state.activePlayers.includes(seat) && state.activePlayers.length >= 2 ? { kind: 'turn', key: 'turn' } : null;
}

export function alertText(info: GameInfo, state: BasePublicState, kind: AlertKind, name?: string): { title: string; body: string } {
  if (kind === 'gameOver') {
    const winners = state.winners.map(seat => state.playerNames[seat]).join(', ');
    return { title: 'Game over', body: winners ? `${winners} won ${info.name}` : `Draw in ${info.name}` };
  }
  const body = `${info.name} · ${state.gameId}`;
  if (kind === 'turn') return { title: name ? `Your turn, ${name}` : 'Your turn', body };
  return { title: name ? `A vote is waiting for ${name}` : 'A vote is waiting for you', body };
}

export function tabTitle(info: GameInfo, state: BasePublicState, seats: Seat[]): string {
  const count = state.activePlayers.length;
  const base = state.started || state.isGameOver
    ? `${info.name} · ${count} players`
    : `${info.name} · ${count} of ${tableLimit(info, state)} players`;
  const kinds = seats.map(seat => alertFor(info, state, seat)?.kind);
  if (kinds.includes('vote')) return `● Vote · ${base}`;
  return kinds.includes('turn') ? `● Your turn · ${base}` : base;
}
