import assert from 'node:assert/strict';
import type { GameDefinition } from '../shared/gameDefinition.ts';
import { PAUSE_FILE_FORMAT, PAUSE_FILE_VERSION, type PauseFile, type PauseRecord } from '../shared/pauseFile.ts';
import type { BaseGameState, BasePublicState, HistoryStep, Seat } from '../shared/types.ts';
import { openSeal, shareHash, type SealedRoom } from './pauseSeal.ts';
import { historyMoments, historyStep, publicView, type ViewRoom } from './views.ts';

// Secrets and per-run bookkeeping that must not outlive the pause: the seal protects the rest
const UNSEALED_KEYS = [
  'seatKeys', 'seatDevices', 'spectatorKeys', 'spectators', 'handRequests', 'reactions', 'pause', 'pausedAt', 'turnStartedAt', 'turnPausedAt'
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
    // a dismissed seat keeps its name in playerNames but holds no share, so only seated players are listed
    players: Object.fromEntries(room.state.activePlayers.map(active => [active, room.state.playerNames[active]])),
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

function namesList(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function pauseFilesMismatch(files: PauseFile[], seats: Seat[]): { error: string; seats: Seat[] } {
  const named = files.filter(file => seats.includes(file.seat)).sort((a, b) => a.seat - b.seat);
  const names = named.map(file => file.playerName);
  const error = names.length === 1
    ? `${names[0]}'s pause file does not match the others`
    : `The pause files from ${namesList(names)} do not match`;
  return { error, seats: named.map(file => file.seat) };
}

const sharedPart = (file: PauseFile) => canonicalJson({
  format: file.format, version: file.version, gameType: file.gameType, gameId: file.gameId,
  players: file.players, table: file.table, history: file.history, seal: file.seal
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Anyone can seal a room under their own key, so the opened room must be this game's, seated as the files say;
// history and timeline are walked in step, so they are the same length
function roomFits(room: SealedRoom, { gameId, players }: PauseFile): boolean {
  if (!isPlainObject(room) || !isPlainObject(room.state) || !Array.isArray(room.history) || !Array.isArray(room.timeline)) return false;
  const { state } = room;
  const seats = Object.keys(players).map(Number).sort((a, b) => a - b);
  return room.history.length === room.timeline.length && state.gameId === gameId &&
    Array.isArray(state.activePlayers) && canonicalJson(state.activePlayers) === canonicalJson(seats) &&
    isPlainObject(state.playerNames) && seats.every(seat => state.playerNames[seat] === players[seat]);
}

// The tamper check on untrusted files, one per seat: plain parts are compared only as canonical JSON, and nothing throws
export function checkPauseFiles(
  game: GameDefinition<any, BasePublicState>, files: PauseFile[] // eslint-disable-line @typescript-eslint/no-explicit-any
): { room: SealedRoom } | { error: string; seats: Seat[] } {
  const every = files.map(file => file.seat);
  const groups = new Map<string, Seat[]>();
  for (const file of files) {
    const key = sharedPart(file);
    groups.set(key, [...(groups.get(key) ?? []), file.seat]);
  }
  const sizes = [...groups.values()].map(group => group.length).sort((a, b) => b - a);
  if (sizes.length > 1) {
    const largest = sizes[0] > sizes[1] ? [...groups.values()].find(group => group.length === sizes[0])! : [];
    return pauseFilesMismatch(files, every.filter(seat => !largest.includes(seat)));
  }

  const badShares = files.filter(file => typeof file.share !== 'string' || shareHash(file.share) !== file.seal.shareHashes[file.seat]);
  if (badShares.length > 0) return pauseFilesMismatch(files, badShares.map(file => file.seat));

  const { players, seal } = files[0];
  assert.deepEqual([...every].sort((a, b) => a - b), Object.keys(players).map(Number).sort((a, b) => a - b));

  const room = openSeal(seal, Object.fromEntries(files.map(file => [file.seat, file.share])));
  if (!room || !roomFits(room, files[0])) return pauseFilesMismatch(files, every);

  // the opened room is unchecked JSON that every player agreed on, so rebuilding its parts may throw
  try {
    const badHands: Seat[] = [];
    for (const file of files) {
      const parts = pausePlainParts(game, room, file.seat);
      if (canonicalJson(parts.table) !== canonicalJson(file.table) || canonicalJson(parts.history) !== canonicalJson(file.history)) {
        return pauseFilesMismatch(files, every);
      }
      if (canonicalJson(parts.hand) !== canonicalJson(file.hand)) badHands.push(file.seat);
    }
    return badHands.length > 0 ? pauseFilesMismatch(files, badHands) : { room };
  } catch {
    return pauseFilesMismatch(files, every);
  }
}
