import type { GameDefinition } from '../shared/gameDefinition.ts';
import { houseRulesOf } from '../shared/houseRules.ts';
import type { Reaction } from '../shared/reactions.ts';
import { standingsOf } from '../shared/standings.ts';
import type { BaseGameState, BasePublicState, HistoryStep, Seat } from '../shared/types.ts';

// What the view functions read of a room; games differ in their state types, so a room holds its game's state type-erased.
export type ViewRoom = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  game: GameDefinition<any, BasePublicState>;
  state: BaseGameState;
  history: BaseGameState[];
  timeline: BaseGameState[];
};

export const STAMP_KEYS = ['turnStartedAt', 'turnPausedAt'] as const;

export type HistoryMoment = { state: BaseGameState; moveCount: number; historyStep: HistoryStep['historyStep'] };

// The one place a public state is built: the game hides its secrets and the platform adds the move count
export function publicView(
  room: ViewRoom, state: BaseGameState, undoAvailable: boolean, moveCount: number, viewer: Seat | null
): BasePublicState {
  return platformView(room, state, room.game.toPublicState(state, undoAvailable, viewer), moveCount);
}

// Secrets and per-viewer lists are never part of a stored or shared view; the live view adds back what its viewer may see
export function platformView(
  room: ViewRoom, state: BaseGameState, raw: Omit<BasePublicState, 'moveCount'>, moveCount: number
): BasePublicState {
  const {
    seatKeys: _seatKeys, seatDevices: _seatDevices, spectatorKeys: _spectatorKeys, handRequests: _handRequests, spectators: _spectators,
    seatViews: _seatViews, reactions: _reactions, pause: _pause, ...view
  } = raw;
  const { startedAt, finishedAt, gameNumber } = state;
  const stamp = Object.fromEntries(STAMP_KEYS.filter(key => key in state).map(key => [key, state[key]]));
  return {
    ...view,
    ...stamp,
    moveCount,
    houseRules: houseRulesOf(room.game.info, state),
    startedAt,
    finishedAt,
    gameNumber,
    ...(state.isGameOver && { standings: standingsOf(room.game, state) })
  };
}

export function hasEndMoment(room: ViewRoom): boolean {
  return room.state.isGameOver && !room.timeline.at(-1)?.isGameOver;
}

// The states a history shows, oldest first: the start, each move, and the live state when the game ended without one
export function historyMoments(room: ViewRoom): HistoryMoment[] {
  const moments: HistoryMoment[] = [
    { state: room.history[0] ?? room.state, moveCount: 0, historyStep: 'start' },
    ...room.timeline.map((state, index): HistoryMoment => ({ state, moveCount: index + 1, historyStep: 'move' }))
  ];
  if (hasEndMoment(room)) {
    moments.push({ state: room.state, moveCount: room.timeline.length, historyStep: 'end' });
  }
  return moments;
}

export function historyStep(room: ViewRoom, { state, moveCount, historyStep }: HistoryMoment, viewer: Seat | null): HistoryStep {
  // The last moment with a move count owns its reactions, so the end moment takes the count it shares with the last move or the start
  const shared = historyStep !== 'end' && moveCount === room.timeline.length && hasEndMoment(room);
  const reactions = shared ? [] : (room.state.reactions ?? [])
    .filter(reaction => reaction.moveCount === moveCount)
    .map(({ at, emoji, from, fromSpectator, target }): Reaction => ({ from, fromSpectator, target, emoji, at }));
  const { turnStartedAt: _started, turnPausedAt: _paused, ...past } = state; // a past turn has no live clock
  return { ...publicView(room, past, false, moveCount, viewer), historyStep, ...(reactions.length > 0 && { reactions }) };
}
