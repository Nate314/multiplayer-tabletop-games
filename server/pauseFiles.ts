import type { GameDefinition } from '../shared/gameDefinition.ts';
import { PAUSE_FILE_FORMAT, PAUSE_FILE_VERSION, type PauseFile, type PauseRecord } from '../shared/pauseFile.ts';
import type { BaseGameState, BasePublicState, HistoryStep, Seat } from '../shared/types.ts';
import type { SealedRoom } from './pauseSeal.ts';
import { historyMoments, historyStep, publicView, type ViewRoom } from './views.ts';

// Secrets and per-run bookkeeping that must not outlive the pause: the seal protects the rest
const UNSEALED_KEYS = [
  'seatKeys', 'seatDevices', 'spectatorKeys', 'spectators', 'handRequests', 'reactions', 'pause', 'turnStartedAt', 'turnPausedAt'
] as const;

function stripped(state: BaseGameState): BaseGameState {
  const copy = { ...state };
  for (const key of UNSEALED_KEYS) delete copy[key];
  return copy;
}

export function sealedRoomOf(room: ViewRoom): SealedRoom {
  return { state: stripped(room.state), history: room.history.map(stripped), timeline: room.timeline.map(stripped) };
}

// Everything a pause file shows in the clear: the table, the seat's own hand and the history, as the table saw it
export function pausePlainParts(
  game: GameDefinition<any, BasePublicState>, room: SealedRoom, seat: Seat // eslint-disable-line @typescript-eslint/no-explicit-any
): { table: BasePublicState; hand: unknown; history: HistoryStep[] } {
  const viewRoom: ViewRoom = { game, ...room };
  return {
    table: publicView(viewRoom, room.state, false, room.timeline.length, null),
    hand: game.privateSeatView?.(room.state, seat) ?? null,
    history: historyMoments(viewRoom).map(moment => historyStep(viewRoom, moment, null))
  };
}

export function buildPauseFile(
  game: GameDefinition<any, BasePublicState>, room: SealedRoom, seat: Seat, pause: PauseRecord, pausedAt: Date // eslint-disable-line @typescript-eslint/no-explicit-any
): PauseFile {
  return {
    format: PAUSE_FILE_FORMAT,
    version: PAUSE_FILE_VERSION,
    gameType: game.info.id,
    gameId: room.state.gameId,
    pausedAt: pausedAt.toISOString(),
    seat,
    playerName: room.state.playerNames[seat],
    players: { ...room.state.playerNames },
    ...pausePlainParts(game, room, seat),
    seal: pause.seal,
    share: pause.shares[seat]
  };
}

// JSON with keys sorted at every depth and undefined fields dropped, so equal values compare equal as text
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  });
}
