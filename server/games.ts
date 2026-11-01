import { randomUUID, timingSafeEqual } from 'node:crypto';
import { SIMULATION_TICK_MS, type GameDefinition } from '../shared/gameDefinition.ts';
import {
  addPlayer, applyMove, connectedPlayers, disconnectPlayer, findSeatByName, reconnectPlayer, removePlayer,
  dismissVoters, resolveDismissVote
} from '../shared/seating.ts';
import {
  agreeToHouseRules, agreementPending, everyoneAgreed, houseRulesOf, minimumToStart, setHouseRules, tableLimit
} from '../shared/houseRules.ts';
import { stampTurn, turnLimitMs } from '../shared/turnTimer.ts';
import { castPauseVote, openPauseVote, pauseVotePassed } from '../shared/pause.ts';
import { parsePauseFile, type PauseFile, type ResumeStatus, type ResumeUpload } from '../shared/pauseFile.ts';
import { buildGameFile, isImageId, type EmbeddedImages, type GameFile } from '../shared/gameFile.ts';
import { isSingleEmoji, MAX_REACTIONS, REACTION_COOLDOWN_MS, type Reaction } from '../shared/reactions.ts';
import type { ArchivedGame, GameStore, SavedRoom, StepChange } from './store.ts';
import { hashDeviceId } from './devices.ts';
import { MAX_SPECTATORS, openHandRequests, spectatorView } from '../shared/spectators.ts';
import { nextShownSeat, seatsToAct } from '../shared/passAndPlay.ts';
import { standingsOf } from '../shared/standings.ts';
import { plural } from '../shared/text.ts';
import { historyMoments, historyStep, platformView, publicView, type ViewRoom } from './views.ts';
import { openSeal, sealRoom, shareHash, type SealedRoom } from './pauseSeal.ts';
import { decodeImage, embedImages, imageMime, MAX_IMAGE_BYTES, MAX_ROOM_IMAGES, newImageId, type ImageUploadError } from './images.ts';
import { buildPauseFile, canonicalJson, checkPauseFiles, pauseFilesMismatch, sealedRoomOf } from './pauseFiles.ts';
import { MAX_NAME_LENGTH } from '../shared/types.ts';
import type { HandRequest, JoinRole } from '../shared/types.ts';
import type {
  BaseGameState, BasePublicState, GameResult, HistoryStep, OpenGame, Random, Result, Seat
} from '../shared/types.ts';

export const EMPTY_ROOM_TIMEOUT_MS = 10 * 60 * 1000; // how long a started game waits with nobody connected
export const ARCHIVE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // how long a finished game stays in the archive
export const PAUSED_ROOM_TTL_MS = 30 * 24 * 60 * 60 * 1000; // how long a paused game is kept; its players' files still bring it back
const ARCHIVE_PRUNE_MS = 24 * 60 * 60 * 1000;

// `history` holds the state before each move, for undo; `timeline` holds the state right after each move.
// Neither leaves this module except through the game's public view.
type Room = ViewRoom & {
  clockSeat?: Seat | null; // whose turn the turn timer was stamped for; memory only
  emptyTimer?: ReturnType<typeof setTimeout>; // set while a started game has nobody connected
  deadlineTimer?: ReturnType<typeof setTimeout>; // set while the game has a deadline
  simTimer?: ReturnType<typeof setInterval>; // set while the game is simulating
  watching: Set<string>; // ids of the connected spectators; in memory only, like sockets
  lastReactionAt: Map<string, number>; // by sender key; kept off the state, so a restart clears every cooldown
  dismissalEnded?: boolean; // a dismissal just ended the game; read by the save that follows it in the same call
};

// `now` is the server clock (tests set their own); `changed` hears of a change no player made, a timeout or a tick;
// `onGameFinished` hears of each game once, when it first ends.
// `manualSimulation` runs no timer: the end-to-end tests step the simulation with simulateTicks;
// `reseated` hears where every seat went when a rematch reset the room, before the call that reset it returns;
// `removed` hears of each room deleted, so nothing kept for it outlives it
// `samePerson` says whether a device hash belongs to the person of any of `hashes` (linked devices)
// `maxResumeBytes` replaces MAX_RESUME_BYTES, so a test can reach the cap with small files
export type ManagerHooks = {
  now?: () => number;
  changed?: (roomId: string) => void;
  onGameFinished?: (result: GameResult) => void;
  reseated?: (roomId: string, moves: Reseat[]) => void;
  removed?: (roomId: string) => void;
  manualSimulation?: boolean;
  samePerson?: (hash: string, hashes: string[]) => boolean;
  maxResumeBytes?: number;
};

export type Reseat = { from: Seat; to: Seat | null; seatKey: string }; // `to` is null for a seat that left

export type JoinResult =
  | { roomId: string; seat: Seat | null; spectatorId?: string; seatKey: string; state: BasePublicState }
  | { error: string };

export type LocalSeat = { seat: Seat; seatKey: string };

// The pause files gathered for a game this server lost; in memory only, at most one upload per seat of `players`
type ResumeLobby = {
  game: Room['game'];
  gameId: string;
  fingerprint: string;
  shareHashes: Record<Seat, string>; // from the first file, so a later file cannot bring its own
  players: Record<Seat, string>;
  uploads: Map<Seat, { file: PauseFile; seatKey: string; device: string | null; bytes: number }>;
  error: string | null;
  timer?: ReturnType<typeof setTimeout>;
  lifetime?: ReturnType<typeof setTimeout>; // forgets it MAX_RESUME_LOBBY_MS after creation, however often it is polled
};

// Anyone may open a lobby, so the files every lobby holds together are capped to keep the process in memory
export const MAX_RESUME_BYTES = 200 * 1024 * 1024;
export const MAX_RESUME_LOBBY_MS = 60 * 60 * 1000; // status reads renew a lobby, but never past this
const SERVER_BUSY = 'The server is too busy to resume a game. Try again later';
const NOT_A_PAUSE_FILE = 'This file is not a pause file';
const ANOTHER_GAME = 'Another game with this ID is on this server';
const WAITING_FOR_FILES = 'This game is waiting for its pause files. Choose Resume a game and upload yours';
const doesNotMatch = (name: string) => `${name}'s pause file does not match the others`;

// The file's seats are whole numbers, no more than the game can seat, and the same in `players` and the seal
function seatsAgree(game: Room['game'], file: PauseFile): boolean {
  const seats = Object.keys(file.players);
  const most = Math.max(game.info.maxPlayers, game.info.stretchedPlayers?.max ?? 0);
  return seats.length <= most && seats.length === Object.keys(file.seal.shareHashes).length &&
    seats.every(seat => /^[1-9]\d{0,2}$/.test(seat) && Object.hasOwn(file.seal.shareHashes, seat));
}

// Every uploaded image id the states show, each once
function imageIdsOf(game: Room['game'], states: BaseGameState[]): string[] {
  return [...new Set(states.flatMap(state => game.imagesOf?.(state) ?? []))].filter(isImageId);
}

const roomStates = (room: { state: BaseGameState; history: BaseGameState[]; timeline: BaseGameState[] }) =>
  [room.state, ...room.history, ...room.timeline];

function cleanName(value: unknown): string {
  return String(value ?? '').trim().slice(0, MAX_NAME_LENGTH);
}

export const NOT_AVAILABLE = 'not-available'; // one answer for a missing game and a refused credential, so neither can be told apart

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Who `credential` is in this game: a seat key or a remembered device is a player, a spectator key that spectator
export function access(
  state: BaseGameState, credential: string | undefined, samePerson?: ManagerHooks['samePerson']
): { kind: 'player' } | { kind: 'spectator'; allowedSeats: Seat[] } | null {
  if (typeof credential !== 'string' || credential === '') return null;
  const device = hashDeviceId(credential);
  const devices = Object.values(state.seatDevices ?? {});
  if (Object.values(state.seatKeys ?? {}).some(key => sameSecret(key, credential))) return { kind: 'player' };
  if (device && devices.some(hash => sameSecret(hash, device))) return { kind: 'player' };
  if (device && devices.length > 0 && samePerson?.(device, devices)) return { kind: 'player' };
  const spectatorId = Object.entries(state.spectatorKeys ?? {}).find(([, key]) => sameSecret(key, credential))?.[0];
  const spectator = state.spectators?.find(candidate => candidate.id === spectatorId);
  return spectator ? { kind: 'spectator', allowedSeats: spectator.allowedSeats } : null;
}

// Holds every game in memory, keyed by game type and game ID. Only the public view of a game ever leaves this module.
// With a `store`, started games are saved after every change and come back on creation with every seat held.
export function createGameManager(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  games: readonly GameDefinition<any, any>[], random: Random = Math.random, store?: GameStore, hooks: ManagerHooks = {}
) {
  const rooms = new Map<string, Room>();
  const lobbies = new Map<string, ResumeLobby>(); // by room ID; a room ID never has both
  const maxResumeBytes = hooks.maxResumeBytes ?? MAX_RESUME_BYTES;
  let resumeBytes = 0; // the JSON size of every file every lobby holds
  const now = hooks.now ?? Date.now;

  function pruneArchive(): void {
    writeStore('archive', target => { target.pruneArchive(now() - ARCHIVE_TTL_MS); });
  }
  pruneArchive();
  setInterval(() => {
    pruneArchive();
    prunePausedRooms();
  }, ARCHIVE_PRUNE_MS).unref();

  // Deletes every game paused for PAUSED_ROOM_TTL_MS, so abandoned pauses never fill the store
  function prunePausedRooms(): void {
    for (const [roomId, room] of rooms) {
      if (room.state.paused && (room.state.pausedAt ?? now()) <= now() - PAUSED_ROOM_TTL_MS) deleteRoom(roomId);
    }
  }

  function findGame(gameType: unknown) {
    return games.find(candidate => candidate.info.id === gameType);
  }

  function newRoom(game: Room['game'], id: string): Room {
    const state = { ...game.createGameState(id), gameNumber: nextGameNumber(game.info.id, id) };
    return { game, state, history: [], timeline: [], watching: new Set(), lastReactionAt: new Map() };
  }

  function spectatorNamed(state: BaseGameState, name: string) {
    return state.spectators?.find(candidate => candidate.name.toLowerCase() === name.toLowerCase());
  }

  // Seats `name` on `state` without touching the room: a held seat comes back only with its key, and `rejoin` never adds one
  function seatPlayer(
    game: Room['game'], state: BaseGameState, name: string, rejoin: unknown, seatKey: unknown
  ): { state: BaseGameState } & LocalSeat | { error: string } {
    const known = findSeatByName(state, name);
    if (known !== undefined) {
      if (!state.activePlayers.includes(known)) return { error: 'You were removed from this game' };
      if (!state.disconnected.includes(known)) return { error: `${state.playerNames[known]} is already in this game` };
      // A game saved before seat keys existed has none, so its first rejoin by name is given one
      const expected = state.seatKeys?.[known];
      if (expected !== undefined && seatKey !== expected) return { error: 'That name is taken in this game' };
      const key = expected ?? randomUUID();
      return { state: { ...reconnectPlayer(state, known), seatKeys: { ...state.seatKeys, [known]: key } }, seat: known, seatKey: key };
    }
    if (rejoin === true) return { error: 'You are not in this game' };
    if (spectatorNamed(state, name)) return { error: 'That name is taken in this game' };

    const result = addPlayer(game, state, name, random);
    if ('error' in result) return result;
    const key = randomUUID();
    return { state: { ...result.state, seatKeys: { ...result.state.seatKeys, [result.seat]: key } }, seat: result.seat, seatKey: key };
  }

  // A store failure is logged, never thrown: the game in memory stays playable
  function writeStore(roomId: string, write: (store: GameStore) => void): void {
    if (!store) return;
    try {
      write(store);
    } catch (error) {
      console.error(`Could not update saved game ${roomId}:`, error);
    }
  }

  // The number for a new game of this ID; a store that fails leaves it at 1
  function nextGameNumber(gameType: string, gameId: string): number {
    let number = 1;
    writeStore(`${gameType}/${gameId}`, target => { number = target.nextGameNumber(gameType, gameId); });
    return number;
  }

  // Records the seat's device by its hash; an invalid ID leaves the state as it is
  function withDevice(state: BaseGameState, seat: Seat, deviceId: unknown): BaseGameState {
    const hash = hashDeviceId(deviceId);
    return hash ? { ...state, seatDevices: { ...state.seatDevices, [seat]: hash } } : state;
  }

  const archiveIdOf = (roomId: string, state: BaseGameState) => `${roomId}#${state.gameNumber ?? 1}`;

  // Keeps the room's finished game; archiving again replaces it, so an undo and replay leave the final game.
  // Open votes are not part of the game as it ended, so every path archives without them.
  function archiveRoom(roomId: string, room: Room): void {
    const { game } = room;
    const state: BaseGameState = { ...room.state, rematchVote: null, dismissVote: null };
    writeStore(roomId, target => target.archive({
      id: archiveIdOf(roomId, state), gameType: game.info.id, gameId: state.gameId, n: state.gameNumber ?? 1,
      finishedAt: state.finishedAt ?? now(), state, history: room.history, timeline: room.timeline
    }, imageIdsOf(game, roomStates(room))));
  }

  // Stamps the first start and the first end; a game already stamped finished never reports again, even after an undo
  function stamp(roomId: string, room: Room): void {
    const abandoned = room.dismissalEnded;
    room.dismissalEnded = undefined;
    if (room.state.started && room.state.startedAt === undefined) room.state = { ...room.state, startedAt: now() };
    if (!room.state.isGameOver || room.state.finishedAt !== undefined) return;
    const finishedAt = now();
    const state: BaseGameState = { ...room.state, finishedAt };
    room.state = state;
    const { game } = room;
    archiveRoom(roomId, room);
    const result: GameResult = {
      archiveId: archiveIdOf(roomId, state),
      gameType: game.info.id,
      gameId: state.gameId,
      startedAt: state.startedAt ?? finishedAt,
      finishedAt,
      moveCount: room.timeline.length,
      standings: standingsOf(game, state),
      players: state.activePlayers.map(seat => ({
        seat, name: state.playerNames[seat], ...(state.seatDevices?.[seat] && { deviceId: state.seatDevices[seat] })
      }))
    };
    // A dismissal ending it is the platform ending it, not the game's own rules
    if (abandoned) result.abandoned = true;
    try {
      hooks.onGameFinished?.(result);
    } catch (error) {
      console.error(`Could not report finished game ${roomId}:`, error);
    }
  }

  // Only a started game is kept: a lobby lost in a restart is just joined again.
  // `step` is how this change moved `history` and `timeline`, so only that step is written
  // Every change passes through here, so this is also where the room's deadline is rescheduled
  function save(roomId: string, room: Room, step?: StepChange): void {
    stamp(roomId, room);
    stampRoom(room);
    const { game, state } = room;
    // A simulating tick is saved once, when the simulation stops
    if (step || !game.simulating?.(state)) {
      writeStore(roomId, target => {
        if (state.started) target.save(roomId, game.info.id, state, step);
        else target.remove(roomId);
      });
    }
    scheduleDeadline(roomId, room);
    scheduleSimulation(roomId, room);
  }

  // Every change passes through save, so this starts the timer when play begins simulating and stops it when it ends
  function scheduleSimulation(roomId: string, room: Room): void {
    if (hooks.manualSimulation || room.state.paused || !room.game.simulating?.(room.state)) {
      clearInterval(room.simTimer);
      room.simTimer = undefined;
      return;
    }
    if (room.simTimer) return;
    room.simTimer = setInterval(() => runSimulationTick(roomId, room), SIMULATION_TICK_MS);
    room.simTimer.unref(); // never keeps the process alive on its own
  }

  function runSimulationTick(roomId: string, room: Room): void {
    const { game, state } = room;
    if (rooms.get(roomId) !== room || state.paused || !game.simulate || !game.simulating?.(state)) return;
    let next: BaseGameState;
    try {
      next = game.simulate(state);
    } catch (error) { // a broken simulation stops ticking rather than crashing the server
      console.error(`${game.info.id} simulation failed in ${roomId}:`, error);
      clearInterval(room.simTimer);
      room.simTimer = undefined;
      return;
    }
    // The game-ending tick is a move, so an open undo vote (for the move before) is canceled
    if (next.isGameOver && !state.isGameOver) record(roomId, room, { ...next, undoVote: null });
    else room.state = next;
    if (!game.simulating(room.state)) save(roomId, room); // saved once, and the timer stops
    hooks.changed?.(roomId);
  }

  // The turn timer only displays: it stamps the live state only (history views and exports never carry the stamp), and never schedules anything.
  function stampRoom(room: Room): void {
    const { state } = room;
    const running = turnLimitMs(state) > 0 && !state.isGameOver && clockMayRun(room) && state.currentPlayer !== null;
    ({ state: room.state, clockSeat: room.clockSeat } = stampTurn(state, room.clockSeat, running, now()));
  }

  // Records `next` as a move after the current state, for undo, history and the store
  // The reaction log stays on the live state only, so snapshots are pushed without it
  function record(roomId: string, room: Room, next: BaseGameState): void {
    const { reactions: _before, ...before } = room.state;
    const { reactions: _after, ...after } = next;
    const index = room.history.push(before) - 1;
    room.timeline.push(after);
    room.state = next;
    save(roomId, room, { type: 'push', index, before, after });
  }

  // Before the first move, nobody may play until every seated player agreed to the current house rules
  function awaitingAgreement({ game, state }: Room): boolean {
    return !state.started && agreementPending(game.info, state);
  }

  // A lobby clock runs only while the table could start: everyone agreed and enough players are seated.
  // A join or leave clears the agreements, so it stops the clock until the last Agree restarts it. No clock runs while paused
  function clockMayRun(room: Room): boolean {
    const { game, state } = room;
    if (state.paused) return false;
    return state.started || (!awaitingAgreement(room) && state.activePlayers.length >= minimumToStart(game.info));
  }

  // Open votes and disconnects do not pause a clock; only the game's own deadline does.
  // The turn timer is display only and never schedules
  function scheduleDeadline(roomId: string, room: Room): void {
    clearTimeout(room.deadlineTimer);
    room.deadlineTimer = undefined;
    const deadline = room.state.isGameOver || !clockMayRun(room) ? null : room.game.deadline?.(room.state) ?? null;
    if (deadline === null || !room.game.onDeadline) return;
    room.deadlineTimer = setTimeout(() => runDeadline(roomId, room), Math.max(0, deadline - now()));
    room.deadlineTimer.unref(); // never keeps the process alive on its own
  }

  function runDeadline(roomId: string, room: Room): void {
    const { game } = room;
    const deadline = game.deadline?.(room.state) ?? null;
    if (rooms.get(roomId) !== room || deadline === null || !game.onDeadline) return;
    if (deadline > now()) { // a timer can fire a little before the clock says the deadline passed
      scheduleDeadline(roomId, room);
      return;
    }
    // An open undo vote was for the move before this one, so the timeout cancels it
    record(roomId, room, { ...game.onDeadline(room.state, now(), random), started: true, undoVote: null });
    const next = game.deadline?.(room.state) ?? null;
    if (room.deadlineTimer && next !== null && next <= now()) { // would time out again at once, forever
      clearTimeout(room.deadlineTimer);
      room.deadlineTimer = undefined;
      console.error(`${game.info.id} set a deadline that had already passed after a timeout in ${roomId}`);
    }
    hooks.changed?.(roomId);
  }

  function deleteRoom(roomId: string): void {
    const room = rooms.get(roomId);
    if (room?.state.isGameOver) archiveRoom(roomId, room);
    clearTimeout(room?.deadlineTimer);
    clearInterval(room?.simTimer);
    rooms.delete(roomId);
    writeStore(roomId, target => {
      target.remove(roomId);
      target.deleteRoomImages(roomId); // after the archive above, so the images it shows stay
    });
    try {
      hooks.removed?.(roomId);
    } catch (error) {
      console.error(`Could not report removed room ${roomId}:`, error);
    }
  }

  // A TV may open the lobby before anyone sits down, so it keeps the room alive
  function tableScreenWatching(room: Room): boolean {
    return (room.state.spectators ?? []).some(spectator => spectator.tableScreen && room.watching.has(spectator.id));
  }

  // Deletes a started game once nobody has been connected for EMPTY_ROOM_TIMEOUT_MS; a paused game waits for its players
  function startEmptyTimer(roomId: string, room: Room): void {
    if (!room.state.started || room.state.paused || room.emptyTimer || connectedPlayers(room.state).length > 0) return;
    room.emptyTimer = setTimeout(() => {
      if (rooms.get(roomId) === room) deleteRoom(roomId);
    }, EMPTY_ROOM_TIMEOUT_MS);
    room.emptyTimer.unref(); // never keeps the process alive on its own
  }

  // The current state as `viewer` may see it, stamped with the server time for countdowns
  function view(room: Room, viewer: Seat | null): BasePublicState {
    const base = publicView(room, room.state, room.history.length > 0 && allowsUndoVote(room), room.timeline.length, viewer);
    return live(room, base, request => request.seat === viewer);
  }

  // Adds what changes by the minute and is never stored: who is watching, and the open hand requests `wanted` picks
  function live(room: Room, base: BasePublicState, wanted: (request: HandRequest) => boolean): BasePublicState {
    return {
      ...base,
      spectators: (room.state.spectators ?? []).filter(spectator => room.watching.has(spectator.id)),
      handRequests: openHandRequests(room.state, room.watching).filter(wanted),
      serverTime: now(),
      waitingOn: seatsToAct(room.game, room.state)
    };
  }

  // A spectator sees the table plus the seats that allowed them, and can never undo
  function spectatorViewOf(room: Room, spectatorId: string): BasePublicState | undefined {
    const spectator = room.state.spectators?.find(candidate => candidate.id === spectatorId);
    if (!spectator) return undefined;
    const raw = spectatorView(room.game, room.state, spectator);
    const base = platformView(room, room.state, raw, room.timeline.length);
    const { seatViews } = raw as Partial<BasePublicState>;
    return live(room, { ...base, ...(seatViews && { seatViews }) }, request => request.spectator === spectatorId);
  }

  // The live room, or with `n` the archived game of that number laid out as a room; null unless `credential` was in the game
  function findHistoryRoom(gameType: unknown, gameId: unknown, credential: unknown, n?: number) {
    const game = findGame(gameType);
    if (!game) return null;
    const roomId = `${game.info.id}/${cleanName(gameId)}`;
    let room = rooms.get(roomId);
    if (n !== undefined) {
      let archived = undefined as ArchivedGame | undefined;
      if (Number.isSafeInteger(n) && n > 0) writeStore(roomId, target => { archived = target.loadArchive(`${roomId}#${n}`); });
      const expired = !archived || archived.finishedAt <= now() - ARCHIVE_TTL_MS;
      room = expired ? undefined : { game, state: archived!.state, history: archived!.history, timeline: archived!.timeline, watching: new Set(), lastReactionAt: new Map() };
    }
    const who = room && access(room.state, typeof credential === 'string' ? credential : undefined, hooks.samePerson);
    return room && who ? { game, room, who } : null;
  }

  function findPlayer(roomId: string, seat: Seat): { room: Room } | { error: string } {
    const room = rooms.get(roomId);
    if (!room) return { error: 'Game not found' };
    if (!room.state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
    return { room };
  }

  function allowsUndoVote({ game, state }: Room): boolean {
    return game.allowsUndoVote?.(state) ?? true;
  }

  // An undo needs two connected players. Only a one-player game, or one that continuesAlone, lets a lone seat undo
  function undoQuorum({ game, state }: Room): number {
    return game.info.minPlayers < 2 || game.continuesAlone ? Math.min(2, state.activePlayers.length) : 2;
  }

  // Applies the undo once every connected player has approved; a vote left short of the quorum (after a disconnect)
  // is canceled instead. Returns the popped step when it undid a move
  function resolveUndoVote(room: Room): StepChange | undefined {
    const { state } = room;
    const vote = state.undoVote;
    if (!vote) return;
    const voters = connectedPlayers(state);
    if (voters.length < undoQuorum(room)) {
      room.state = { ...state, undoVote: null };
      return;
    }
    if (!voters.every(seat => vote.votes[seat])) return;

    const previous = room.history.pop();
    if (!previous) return; // Unreachable: a vote only opens when there is history
    room.timeline.pop();

    // The restored state is from before any dismissal since, so each dismissed player is removed from it again,
    // through the game's own onPlayerLeft, which also moves a turn they held on
    let restored: BaseGameState = {
      ...previous,
      started: true,
      playerNames: state.playerNames,
      spectators: state.spectators,
      spectatorKeys: state.spectatorKeys,
      seatKeys: state.seatKeys, // a pause file may have given a seat a new key since
      seatDevices: state.seatDevices,
      handRequests: state.handRequests,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      undoVote: null,
      turnStartedAt: null, // the next save starts a fresh full turn
      disconnected: state.disconnected,
      dismissVote: null
    };
    if (room.game.onUndo) restored = room.game.onUndo(restored, random);
    if (room.game.resumeClock) restored = room.game.resumeClock(restored, now());
    for (const seat of previous.activePlayers.filter(s => !state.activePlayers.includes(s))) {
      restored = dismissed(room, restored, removePlayer(room.game, restored, seat, random));
    }
    // Dismissed seats are removed in seat order, which may differ from the order they were dismissed in.
    // A hook that ends the game again keeps its ending in the status
    const gameStatus = restored.isGameOver ? `Last turn undone. ${restored.gameStatus}` : 'Last turn undone';
    // The log carries over from the live state; a reaction on the undone move now belongs to the step left
    const moveCount = room.history.length;
    const reactions = state.reactions?.map(reaction => ({ ...reaction, moveCount: Math.min(reaction.moveCount, moveCount) }));
    room.state = { ...restored, gameStatus, ...(reactions && { reactions }) };
    return { type: 'pop', index: moveCount };
  }

  // Settles a dismiss vote. When it passes and the turn moves on from the dismissed player, the next player's clock
  // restarts from now, so they never inherit what was left of the leaver's turn
  function settleDismissVote(room: Room, voted: BaseGameState): void {
    room.state = resumeIfTurnMoved(room, voted, dismissed(room, voted, resolveDismissVote(room.game, voted, random)));
  }

  // `next` is `before` after a dismissal may have removed a seat; notes when a removed seat ended the game.
  // A game that ends itself on a plain disconnect removes no seat, so it is not marked
  function dismissed(room: Room, before: BaseGameState, next: BaseGameState): BaseGameState {
    const removed = next.activePlayers.length < before.activePlayers.length;
    if (removed && next.isGameOver && !before.isGameOver) room.dismissalEnded = true;
    return next;
  }

  function resumeIfTurnMoved(room: Room, before: BaseGameState, next: BaseGameState): BaseGameState {
    const turnMoved = next.started && !next.isGameOver && next.currentPlayer !== before.currentPlayer;
    return turnMoved && room.game.resumeClock ? room.game.resumeClock(next, now()) : next;
  }

  function clearEmptyTimer(room: Room): void {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = undefined;
  }

  // Pauses once every seat approved: a simulation in flight goes back to its turn start, then the room is sealed under the seats' shares
  function settlePause(room: Room): void {
    if (!pauseVotePassed(room.state)) return;
    const { game } = room;
    let state = room.state;
    if (game.simulating?.(state) && game.onUndo) state = game.onUndo(state, random);
    const { turnStartedAt: _started, turnPausedAt: _paused, ...bare } = state;
    state = { ...bare, paused: true, pausedAt: now(), pauseVote: null, gameStatus: 'Game paused' };
    room.state = { ...state, pause: sealRoom(sealedRoomOf({ ...room, state }), state.activePlayers) };
  }

  // Saves the room, first settling an open rematch vote once every seat has answered: with no connected joiner the
  // vote just closes; otherwise the finished game is archived and the connected joiners sit down in a fresh lobby
  function settleRematch(roomId: string, room: Room, step?: StepChange): void {
    const { game, state } = room;
    const vote = state.rematchVote;
    if (!vote || state.activePlayers.some(seat => vote.votes[seat] === undefined)) {
      save(roomId, room, step);
      return;
    }
    const joiners = state.activePlayers.filter(seat => vote.votes[seat]);
    const seated = joiners.filter(seat => !state.disconnected.includes(seat));
    if (seated.length === 0) {
      room.state = { ...state, rematchVote: null, gameStatus: 'Nobody joined the rematch' };
      save(roomId, room, step);
      return;
    }

    archiveRoom(roomId, room); // the game as it ended
    const rules = houseRulesOf(game.info, state);
    let next: BaseGameState = {
      ...game.createGameState(state.gameId),
      gameNumber: (state.gameNumber ?? 1) + 1,
      houseRules: { ...rules, host: null },
      spectators: state.spectators?.map(spectator => ({ ...spectator, allowedSeats: [] })),
      spectatorKeys: state.spectatorKeys,
      handRequests: []
    };
    const moves: Reseat[] = state.activePlayers.map(from => ({ from, to: null, seatKey: state.seatKeys?.[from] ?? '' }));
    for (const move of moves.filter(candidate => seated.includes(candidate.from))) {
      // Last game's values each time, so a rule offered only at the full table survives the smaller tables on the way
      const proposal = { ...next, houseRules: { ...next.houseRules!, values: rules.values } };
      const result = addPlayer(game, proposal, state.playerNames[move.from], random);
      if ('error' in result) break; // unreachable: the same table limit held them all last game
      move.to = result.seat;
      const device = state.seatDevices?.[move.from];
      next = {
        ...result.state,
        seatKeys: { ...result.state.seatKeys, [result.seat]: move.seatKey },
        ...(device && { seatDevices: { ...result.state.seatDevices, [result.seat]: device } })
      };
    }
    // Each seat added cleared the agreements and moved the revision on; the new lobby is one revision past the last game
    next = { ...next, houseRules: { ...next.houseRules!, revision: rules.revision + 1 } };
    const leftOut = joiners.filter(seat => !seated.includes(seat)).map(seat => state.playerNames[seat]);
    if (leftOut.length > 0) {
      const were = leftOut.length === 1 ? 'was' : 'were';
      next = { ...next, gameStatus: `${leftOut.join(', ')} ${were} not connected and ${were} left out` };
    }

    clearEmptyTimer(room);
    clearTimeout(room.deadlineTimer);
    clearInterval(room.simTimer);
    room.deadlineTimer = undefined;
    room.simTimer = undefined;
    room.clockSeat = null;
    room.state = next;
    room.history = [];
    room.timeline = [];
    save(roomId, room);
    try {
      hooks.reseated?.(roomId, moves);
    } catch (error) {
      console.error(`Could not report reseated players in ${roomId}:`, error);
    }
  }

  // Nobody is connected after a restart, so every seat is held for a rejoin and open votes are cleared; a paused game stays paused.
  // No game hook runs but `resumeClock`: a game's disconnect hook may deal the next round once nobody is waiting,
  // and a clock restarts from now, so the time the server was down is never charged
  function loadRoom(roomId: string, saved: SavedRoom): void {
    const game = findGame(saved.gameType);
    if (!game) throw new Error(`this site has no ${saved.gameType} game`);
    const disconnected = [...saved.state.activePlayers].sort((a, b) => a - b);
    // Nobody is watching either, so no hand request is still open; downtime is never charged to the turn timer
    let state: BaseGameState = {
      ...saved.state, undoVote: null, dismissVote: null, rematchVote: null, pauseVote: null, disconnected, handRequests: [], turnStartedAt: null, turnPausedAt: null
    };
    if (game.resumeClock) state = game.resumeClock(state, now());
    // A room saved before these stamps existed gets them now, so loading it never reports it as just finished
    if (state.startedAt === undefined) state = { ...state, startedAt: now() };
    if (state.isGameOver && state.finishedAt === undefined) state = { ...state, finishedAt: now() };
    if (state.paused && state.pausedAt === undefined) state = { ...state, pausedAt: now() }; // paused before the stamp existed
    const room: Room = {
      game, state, history: saved.history, timeline: saved.timeline, watching: new Set(), lastReactionAt: new Map()
    };
    rooms.set(roomId, room);
    save(roomId, room);
    startEmptyTimer(roomId, room);
  }

  // A saved game that cannot be loaded is dropped, so it never stops the server from starting
  for (const [roomId, saved] of store?.loadAll() ?? []) {
    try {
      loadRoom(roomId, saved);
    } catch (error) {
      console.error(`Dropping saved game ${roomId}:`, error);
      rooms.delete(roomId);
      writeStore(roomId, target => {
        target.remove(roomId);
        target.deleteRoomImages(roomId);
      });
    }
  }
  prunePausedRooms();

  // Opens or answers the pause vote through `change`, pausing the room once it passes
  function changePause(roomId: string, seat: Seat, change: (state: BaseGameState) => Result<BaseGameState>): Result<BasePublicState> {
    const found = findPlayer(roomId, seat);
    if ('error' in found) return found;
    const { room } = found;
    const result = change(room.state);
    if ('error' in result) return result;
    room.state = result.state;
    settlePause(room);
    save(roomId, room);
    return { state: view(room, seat) };
  }

  // A resume lobby lives EMPTY_ROOM_TIMEOUT_MS from its last upload or status read, and never past its lifetime
  function touchLobby(roomId: string, lobby: ResumeLobby): void {
    clearTimeout(lobby.timer);
    lobby.timer = setTimeout(() => forgetLobby(roomId, lobby), EMPTY_ROOM_TIMEOUT_MS);
    lobby.timer.unref(); // never keeps the process alive on its own
    if (lobby.lifetime) return;
    lobby.lifetime = setTimeout(() => forgetLobby(roomId, lobby), MAX_RESUME_LOBBY_MS);
    lobby.lifetime.unref();
  }

  function dropUpload(lobby: ResumeLobby, seat: Seat): void {
    resumeBytes -= lobby.uploads.get(seat)?.bytes ?? 0;
    lobby.uploads.delete(seat);
  }

  // Also releases the bytes its files held; a lobby already forgotten is left alone
  function forgetLobby(roomId: string, lobby: ResumeLobby): void {
    clearTimeout(lobby.timer);
    clearTimeout(lobby.lifetime);
    if (lobbies.get(roomId) !== lobby) return;
    for (const seat of [...lobby.uploads.keys()]) dropUpload(lobby, seat);
    lobbies.delete(roomId);
  }

  function lobbyStatus(lobby: ResumeLobby): ResumeStatus {
    const players = Object.entries(lobby.players).map(([seat, name]) => ({ seat: Number(seat), name, ready: lobby.uploads.has(Number(seat)) }));
    return { gameType: lobby.game.info.id, gameId: lobby.gameId, players, ready: false, error: lobby.error };
  }

  function roomStatus({ game, state }: Room): ResumeStatus {
    const players = [...state.activePlayers].sort((a, b) => a - b).map(seat => ({ seat, name: state.playerNames[seat], ready: true }));
    return { gameType: game.info.id, gameId: state.gameId, players, ready: true, error: null };
  }

  // A file for a room still paused here takes its held seat: the share proves the seat, so the key and device are replaced
  function takePausedSeat(roomId: string, room: Room, file: PauseFile, device: string | null): ResumeUpload | { error: string } {
    const { state } = room;
    if (!state.paused || !state.pause || state.pause.seal.fingerprint !== file.seal.fingerprint) return { error: ANOTHER_GAME };
    const { seat } = file;
    const name = state.playerNames[seat] ?? file.playerName;
    const share = state.pause.shares[seat];
    if (share === undefined || !sameSecret(share, file.share)) return { error: doesNotMatch(name) };
    if (!state.disconnected.includes(seat)) return { error: `${name} is already in this game` };
    const seatKey = randomUUID();
    const { [seat]: _old, ...seatDevices } = state.seatDevices ?? {};
    room.state = { ...state, seatKeys: { ...state.seatKeys, [seat]: seatKey }, seatDevices: device ? { ...seatDevices, [seat]: device } : seatDevices };
    save(roomId, room);
    return { ...roomStatus(room), seat, seatKey, playerName: name };
  }

  // Brings back a lost game paused, with every seat held for its uploader's new key and device.
  // Every step gets the new keys too, so an undo never brings back a key nobody holds
  function restoreRoom(roomId: string, lobby: ResumeLobby, sealed: SealedRoom): void {
    const uploads = [...lobby.uploads];
    const seatKeys = Object.fromEntries(uploads.map(([seat, upload]) => [seat, upload.seatKey]));
    const seatDevices = Object.fromEntries(uploads.flatMap(([seat, { device }]) => (device ? [[seat, device]] : [])));
    const rekeyed = (state: BaseGameState): BaseGameState => ({ ...state, seatKeys, seatDevices });
    const pause = { seal: uploads[0][1].file.seal, shares: Object.fromEntries(uploads.map(([seat, upload]) => [seat, upload.file.share])) };
    const state: BaseGameState = {
      ...rekeyed(sealed.state),
      paused: true,
      pausedAt: now(),
      disconnected: [...sealed.state.activePlayers].sort((a, b) => a - b),
      spectators: [],
      spectatorKeys: {},
      handRequests: [],
      pause
    };
    const room: Room = {
      game: lobby.game, state, history: sealed.history.map(rekeyed), timeline: sealed.timeline.map(rekeyed),
      watching: new Set(), lastReactionAt: new Map()
    };
    forgetLobby(roomId, lobby);
    rooms.set(roomId, room);
    writeStore(roomId, target => {
      target.remove(roomId);
      room.history.forEach((before, index) => {
        target.save(roomId, room.game.info.id, state, { type: 'push', index, before, after: room.timeline[index] });
      });
    });
    restoreImages(roomId, lobby.game, sealed, uploads[0][1].file.images ?? {});
    save(roomId, room);
  }

  // The files are untrusted (every one carries the same images, as checkPauseFiles saw), so only the sealed states'
  // own images go in, each a real JPEG or PNG of at most MAX_IMAGE_BYTES, and none replaces an image already stored
  function restoreImages(roomId: string, game: Room['game'], sealed: SealedRoom, images: EmbeddedImages): void {
    for (const id of imageIdsOf(game, roomStates(sealed))) {
      const image = Object.hasOwn(images, id) ? decodeImage(images[id]) : null;
      if (image) writeStore(roomId, target => target.saveImage(id, roomId, image.mime, image.bytes));
    }
  }

  const loadImage = (id: string) => {
    let image: { mime: string; bytes: Buffer } | undefined;
    writeStore(id, target => { image = target.loadImage(id); });
    return image;
  };

  // "Table screen", then "Table screen 2" and so on while the name is taken
  function freeScreenName(state: BaseGameState): string {
    const taken = (name: string) => findSeatByName(state, name) !== undefined
      || (state.spectators ?? []).some(spectator => spectator.name.toLowerCase() === name.toLowerCase());
    let name = 'Table screen';
    for (let n = 2; taken(name); n++) name = `Table screen ${n}`;
    return name;
  }

  return {
    // `rejoin` only takes back a held seat; it never creates a game or takes a new seat.
    // A held seat is taken back only with the `seatKey` its player was given on joining
    join(
      gameType: unknown, gameId: unknown, playerName: unknown, rejoin?: unknown, seatKey?: unknown, role?: JoinRole, deviceId?: unknown
    ): JoinResult {
      const game = findGame(gameType);
      if (!game) return { error: 'Unknown game' };

      const id = cleanName(gameId);
      const typedName = cleanName(playerName);
      const tableScreen = role === 'tableScreen';
      if (!id) return { error: 'Please enter a game ID' };
      if (!typedName && !tableScreen) return { error: 'Please enter your name' };

      const roomId = `${game.info.id}/${id}`;
      const existing = rooms.get(roomId);
      if (!existing && lobbies.has(roomId)) return { error: WAITING_FOR_FILES };
      if (!existing && (rejoin === true || role === 'spectator')) return { error: 'Game not found' };
      const room = existing ?? newRoom(game, id);
      const { state } = room;
      // A table screen's typed name is ignored: it is named by the server and found again by its key
      const spectator = tableScreen
        ? state.spectators?.find(candidate => candidate.tableScreen && seatKey !== undefined && state.spectatorKeys?.[candidate.id] === seatKey)
        : spectatorNamed(state, typedName);
      const name = tableScreen ? spectator?.name ?? freeScreenName(state) : typedName;

      if (role === 'spectator' || tableScreen) {
        if (findSeatByName(state, name) !== undefined) return { error: 'That name is taken in this game' };
        if (spectator) {
          if (room.watching.has(spectator.id)) return { error: `${spectator.name} is already in this game` };
          const expected = state.spectatorKeys?.[spectator.id];
          if (expected === undefined || seatKey !== expected) return { error: 'That name is taken in this game' };
          room.watching.add(spectator.id);
          save(roomId, room);
          return { roomId, seat: null, spectatorId: spectator.id, seatKey: seatKey as string, state: spectatorViewOf(room, spectator.id)! };
        }
        if (rejoin === true) return { error: 'You are not in this game' };
        // shortcut: departed spectators keep their slot so a refresh keeps its permissions; prune them if the cap is ever reached in practice
        if ((state.spectators ?? []).length >= MAX_SPECTATORS) return { error: 'Too many people are watching this game' };
        const added = { id: randomUUID(), name, tableScreen, allowedSeats: [] };
        const key = randomUUID();
        room.state = {
          ...state,
          spectators: [...(state.spectators ?? []), added],
          spectatorKeys: { ...state.spectatorKeys, [added.id]: key }
        };
        room.watching.add(added.id);
        rooms.set(roomId, room); // a table screen may have just created the room
        save(roomId, room);
        return { roomId, seat: null, spectatorId: added.id, seatKey: key, state: spectatorViewOf(room, added.id)! };
      }

      const seated = seatPlayer(room.game, state, name, rejoin, seatKey);
      if ('error' in seated) return seated;
      room.state = withDevice(seated.state, seated.seat, deviceId);
      clearEmptyTimer(room);
      rooms.set(roomId, room);
      save(roomId, room);
      return { roomId, seat: seated.seat, seatKey: seated.seatKey, state: view(room, seated.seat) };
    },

    // Seats several players on one device, all or none; a rejoin takes back each seat whose key still matches.
    // The view returned is the public one, so no local player's hidden information reaches the device before its turn
    joinLocal(
      gameType: unknown, gameId: unknown, names: unknown, rejoin?: unknown, seatKeys?: unknown, deviceId?: unknown
    ): { roomId: string; seats: LocalSeat[]; state: BasePublicState } | { error: string } {
      const game = findGame(gameType);
      if (!game) return { error: 'Unknown game' };
      if (game.info.passAndPlay === false) return { error: `Pass and play is not offered for ${game.info.name}` };
      const id = cleanName(gameId);
      if (!id) return { error: 'Please enter a game ID' };
      const cleaned = Array.isArray(names) ? names.map(cleanName).filter(Boolean) : [];
      if (cleaned.length < 2) return { error: 'Enter at least two names' };
      if (new Set(cleaned.map(name => name.toLowerCase())).size < cleaned.length) return { error: 'Each player needs a different name' };

      const roomId = `${game.info.id}/${id}`;
      const existing = rooms.get(roomId);
      if (!existing && lobbies.has(roomId)) return { error: WAITING_FOR_FILES };
      if (!existing && rejoin === true) return { error: 'Game not found' };
      const room = existing ?? newRoom(game, id);
      const free = tableLimit(game.info, room.state) - room.state.activePlayers.length;
      if (rejoin !== true && !room.state.started && free > 0 && cleaned.length > free) {
        return { error: `Only ${plural(free, 'seat')} left in this game` };
      }

      const keys = Array.isArray(seatKeys) ? seatKeys : [];
      let { state } = room;
      const seats: LocalSeat[] = [];
      let refused: { error: string } | undefined;
      for (const [index, name] of cleaned.entries()) {
        const seated = seatPlayer(room.game, state, name, rejoin, keys[index]);
        if ('error' in seated) {
          refused ??= seated;
          continue;
        }
        state = withDevice(seated.state, seated.seat, deviceId);
        seats.push({ seat: seated.seat, seatKey: seated.seatKey });
      }
      // A fresh join needs every name; a rejoin keeps whoever came back, since a dismissed seat is gone for good
      if (refused && (rejoin !== true || seats.length === 0)) return refused;

      room.state = state;
      clearEmptyTimer(room);
      rooms.set(roomId, room);
      save(roomId, room);
      return { roomId, seats, state: view(room, null) };
    },

    // The seat a shared device shows after this change: null hands over before a private hand would show
    handoffSeat(roomId: string, shown: Seat | null, localSeats: Seat[]): Seat | null {
      const room = rooms.get(roomId);
      if (!room) return null;
      // A dismissed local seat is no longer seated, so it is neither shown nor handed the device
      const { activePlayers } = room.state;
      const seated = localSeats.filter(seat => activePlayers.includes(seat));
      const stillShown = shown !== null && activePlayers.includes(shown) ? shown : null;
      return nextShownSeat(stillShown, seated, seatsToAct(room.game, room.state), room.game.privateSeatView !== undefined);
    },

    // Before the first move this frees the seat; after it the seat is held for a rejoin
    disconnect(roomId: string, seat: Seat): { state: BasePublicState } | null {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return null;
      const { room } = found;

      // A disconnect can settle a dismiss vote, which may move the turn on like any other dismissal
      room.state = resumeIfTurnMoved(room, room.state, dismissed(room, room.state, disconnectPlayer(room.game, room.state, seat, random)));
      if (room.state.activePlayers.length === 0 && (room.state.started || !tableScreenWatching(room))) {
        deleteRoom(roomId);
        return null;
      }
      // A disconnect can pass a rematch dismiss, the last answer the rematch was waiting for
      settleRematch(roomId, room, resolveUndoVote(room));
      startEmptyTimer(roomId, room);
      return { state: view(room, seat) };
    },

    move(roomId: string, seat: Seat, move: unknown, moveCount?: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      if (awaitingAgreement(room)) return { error: 'Everyone must agree to the house rules first' };
      if (moveCount !== undefined && moveCount !== room.timeline.length) return { error: 'Someone else moved first' };

      const result = applyMove(room.game, room.state, seat, move, random, now());
      if ('error' in result) return result;

      record(roomId, room, result.state);
      return { state: view(room, seat) };
    },

    setHouseRules(roomId: string, seat: Seat, proposal: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;

      const result = setHouseRules(room.game.info, room.state, seat, proposal);
      if ('error' in result) return result;
      room.state = room.game.resetLobby(result.state, random);
      save(roomId, room);
      return { state: view(room, seat) };
    },

    agreeHouseRules(roomId: string, seat: Seat, revision: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;

      const wasAgreed = everyoneAgreed(room.game.info, room.state);
      const result = agreeToHouseRules(room.game.info, room.state, seat, revision);
      if ('error' in result) return result;
      room.state = result.state;
      // The clock starts on the last agreement, not on a repeat of it
      if (!wasAgreed && everyoneAgreed(room.game.info, room.state) && room.game.resumeClock) {
        room.state = room.game.resumeClock(room.state, now());
      }
      save(roomId, room);
      return { state: view(room, seat) };
    },

    // Not turn-bound; pushed to `history` and `timeline` only when the game records it, else an undo skips over it
    action(roomId: string, seat: Seat, action: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      if (!room.game.applyAction) return { error: 'This game has no actions' };
      if (room.state.paused) return { error: 'The game is paused' };

      const recorded = room.game.recordsAction?.(room.state, seat, action) === true;
      const result = room.game.applyAction(room.state, seat, action, random, now());
      if ('error' in result) return result;
      // An action may start play (a Hearts pass), so it meets the same agreement gate as a move
      if (result.state.started && awaitingAgreement(room)) return { error: 'Everyone must agree to the house rules first' };

      if (recorded) {
        // An open undo vote was for the move before this one, so the action cancels it
        record(roomId, room, { ...result.state, started: true, undoVote: null });
      } else {
        room.state = result.state;
        save(roomId, room);
      }
      return { state: view(room, seat) };
    },

    // Takes back the seat's own last move at once, recorded as a new step so the history stays truthful
    undoOwn(roomId: string, seat: Seat): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      if (!room.game.undoOwn) return { error: 'This game has no own-move undo' };
      if (room.state.paused) return { error: 'The game is paused' };
      if (room.state.isGameOver) return { error: 'The game is over' };

      const result = room.game.undoOwn(room.state, seat);
      if ('error' in result) return result;
      record(roomId, room, { ...result.state, undoVote: null });
      return { state: view(room, seat) };
    },

    requestUndo(roomId: string, seat: Seat): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;

      if (!allowsUndoVote(room)) return { error: 'Use Undo my last move in this mode' };
      if (state.paused) return { error: 'The game is paused' };
      if (state.pauseVote) return { error: 'A pause vote is in progress' };
      if (state.rematchVote) return { error: 'A rematch vote is in progress' };
      if (room.history.length === 0) return { error: 'Nothing to undo' };
      if (state.undoVote) return { error: 'An undo vote is already in progress' };
      if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
      if (connectedPlayers(state).length < undoQuorum(room)) return { error: 'Not enough players to vote' };

      room.state = {
        ...state,
        undoVote: { requestedBy: seat, votes: { [seat]: true } },
        gameStatus: `${state.playerNames[seat]} wants to undo the last turn`
      };
      save(roomId, room, resolveUndoVote(room)); // a lone player's own vote passes it at once
      return { state: view(room, seat) };
    },

    voteUndo(roomId: string, seat: Seat, approve: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;
      const vote = state.undoVote;

      if (!vote) return { error: 'No undo vote in progress' };
      if (vote.votes[seat]) return { error: 'You already voted' };

      if (approve !== true) {
        room.state = { ...state, undoVote: null, gameStatus: `${state.playerNames[seat]} declined the undo` };
        save(roomId, room);
        return { state: view(room, seat) };
      }

      room.state = { ...state, undoVote: { ...vote, votes: { ...vote.votes, [seat]: true } } };
      save(roomId, room, resolveUndoVote(room));
      return { state: view(room, seat) };
    },

    requestDismiss(roomId: string, seat: Seat, target: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;

      if (state.paused) return { error: 'The game is paused' };
      // During a rematch vote any seat that has not answered may be dismissed, connected or not
      const rematch = state.rematchVote;
      const held = rematch
        ? state.activePlayers.find(candidate => candidate === target && candidate !== seat && rematch.votes[candidate] === undefined)
        : state.disconnected.find(candidate => candidate === target);
      if (held === undefined) return { error: rematch ? 'That player already answered' : 'That player is not disconnected' };
      if (state.undoVote || state.dismissVote || state.pauseVote) return { error: 'A vote is already in progress' };

      const opened = {
        ...state,
        dismissVote: { target: held, requestedBy: seat, votes: { [seat]: true } },
        gameStatus: `${state.playerNames[seat]} wants to dismiss ${state.playerNames[held]}`
      };
      settleDismissVote(room, opened); // a lone connected player passes it at once
      settleRematch(roomId, room);
      return { state: view(room, seat) };
    },

    voteDismiss(roomId: string, seat: Seat, approve: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;
      const vote = state.dismissVote;

      if (!vote) return { error: 'No dismiss vote in progress' };
      if (seat === vote.target) return { error: 'You cannot vote on your own dismissal' }; // else a silent player could hold a rematch vote open
      if (vote.votes[seat]) return { error: 'You already voted' };
      if (!dismissVoters(state).includes(seat)) return { error: 'Only players who joined the rematch vote on this' };

      if (approve !== true) {
        const gameStatus = `${state.playerNames[seat]} declined to dismiss ${state.playerNames[vote.target]}`;
        room.state = { ...state, dismissVote: null, gameStatus };
        save(roomId, room);
        return { state: view(room, seat) };
      }

      const approved = { ...state, dismissVote: { ...vote, votes: { ...vote.votes, [seat]: true } } };
      settleDismissVote(room, approved);
      settleRematch(roomId, room);
      return { state: view(room, seat) };
    },

    requestRematch(roomId: string, seat: Seat): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;

      if (state.paused) return { error: 'The game is paused' };
      if (!state.isGameOver) return { error: 'The game is not over yet' };
      if (state.rematchVote) return { error: 'A rematch vote is already in progress' };
      if (state.undoVote || state.dismissVote || state.pauseVote) return { error: 'A vote is already in progress' };

      room.state = {
        ...state,
        rematchVote: { requestedBy: seat, votes: { [seat]: true } },
        gameStatus: `${state.playerNames[seat]} wants a rematch`
      };
      settleRematch(roomId, room); // a player left alone at the table starts the lobby at once
      return { state: view(room, seat) };
    },

    voteRematch(roomId: string, seat: Seat, join: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;
      const vote = state.rematchVote;

      if (typeof join !== 'boolean') return { error: 'Invalid vote' };
      if (!vote) return { error: 'No rematch vote in progress' };
      if (vote.votes[seat] !== undefined) return { error: 'You already voted' };

      // An answer settles a dismiss vote against this player, which would otherwise overwrite it
      const dismissVote = state.dismissVote?.target === seat ? null : state.dismissVote;
      room.state = { ...state, dismissVote, rematchVote: { ...vote, votes: { ...vote.votes, [seat]: join } } };
      settleRematch(roomId, room);
      return { state: view(room, seat) };
    },

    requestPause(roomId: string, seat: Seat): Result<BasePublicState> {
      return changePause(roomId, seat, state => openPauseVote(state, seat));
    },

    votePause(roomId: string, seat: Seat, approve: unknown): Result<BasePublicState> {
      return changePause(roomId, seat, state => castPauseVote(state, seat, approve));
    },

    // Not a move: play picks up on the same turn, with a fresh turn clock, once every seat is back
    resumeGame(roomId: string, seat: Seat): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { pause: _pause, pausedAt: _pausedAt, ...state } = room.state;
      if (!state.paused) return { error: 'The game is not paused' };
      if (state.disconnected.length > 0) {
        return { error: `Waiting for ${state.disconnected.map(missing => state.playerNames[missing]).join(', ')}` };
      }
      let next: BaseGameState = { ...state, pauseVote: null, paused: false, turnStartedAt: null };
      if (room.game.resumeClock) next = room.game.resumeClock(next, now());
      room.state = { ...next, gameStatus: 'Play resumed' };
      save(roomId, room);
      return { state: view(room, seat) };
    },

    // One seat's pause file, for that seat's key or remembered device only; any other ask is NOT_AVAILABLE
    pauseFile(gameType: unknown, gameId: unknown, seat: unknown, credential: unknown, now: Date): { file: PauseFile } | { error: string } {
      const game = findGame(gameType);
      const room = game && rooms.get(`${game.info.id}/${cleanName(gameId)}`);
      const state = room?.state;
      if (!room || !state?.paused || !state.pause || typeof credential !== 'string') return { error: NOT_AVAILABLE };
      if (typeof seat !== 'number' || !state.activePlayers.includes(seat)) return { error: NOT_AVAILABLE };
      const key = state.seatKeys?.[seat];
      const device = hashDeviceId(credential);
      const hash = state.seatDevices?.[seat];
      const allowed = (key !== undefined && sameSecret(key, credential)) || (!!device && hash !== undefined && sameSecret(hash, device));
      if (!allowed) return { error: NOT_AVAILABLE };
      // From the seal, not the live room: presence and status change while paused, and every file must match the seal
      const sealed = openSeal(state.pause.seal, state.pause.shares);
      if (!sealed) return { error: NOT_AVAILABLE };
      const images = embedImages(imageIdsOf(room.game, roomStates(sealed)), loadImage);
      return { file: buildPauseFile(room.game, sealed, seat, state.pause, now, images) };
    },

    // An untrusted upload: to its paused room here, else to the resume lobby for its game ID, which restores the room
    // once every seat's file is in and checks out. The answer carries only the uploader's own new key
    uploadPauseFile(upload: unknown, deviceId: unknown): ResumeUpload | { error: string } {
      const text = JSON.stringify(upload) ?? '';
      const parsed = parsePauseFile(text, games.map(game => game.info.id));
      if ('error' in parsed) return parsed;
      const { file } = parsed;
      const game = findGame(file.gameType)!;
      if (cleanName(file.gameId) !== file.gameId || !seatsAgree(game, file)) return { error: NOT_A_PAUSE_FILE };
      const roomId = `${game.info.id}/${file.gameId}`;
      const device = hashDeviceId(deviceId);
      const room = rooms.get(roomId);
      if (room) return takePausedSeat(roomId, room, file, device);

      // Refused before it is stored, so the lobby holds one file per seat of its own game
      let lobby = lobbies.get(roomId);
      if (lobby && lobby.fingerprint !== file.seal.fingerprint) return { error: ANOTHER_GAME };
      if (lobby && canonicalJson(lobby.players) !== canonicalJson(file.players)) return { error: doesNotMatch(file.playerName) };
      // A share the lobby's seal does not know is a forged claim on the seat, so it never holds the seat
      const shareHashes = lobby?.shareHashes ?? file.seal.shareHashes;
      if (shareHash(file.share) !== shareHashes[file.seat]) return { error: doesNotMatch((lobby?.players ?? file.players)[file.seat]) };
      if (lobby?.uploads.has(file.seat)) return { error: `${lobby.players[file.seat]}'s file is already in` };
      if (resumeBytes + text.length > maxResumeBytes) return { error: SERVER_BUSY };
      lobby ??= {
        game, gameId: file.gameId, fingerprint: file.seal.fingerprint, shareHashes: { ...shareHashes }, players: { ...file.players },
        uploads: new Map(), error: null
      };
      lobbies.set(roomId, lobby);
      const seatKey = randomUUID();
      lobby.uploads.set(file.seat, { file, seatKey, device, bytes: text.length });
      resumeBytes += text.length;
      lobby.error = null;
      touchLobby(roomId, lobby);
      const mine = { seat: file.seat, seatKey, playerName: file.playerName };
      if (lobby.uploads.size < Object.keys(lobby.players).length) return { ...lobbyStatus(lobby), ...mine };

      const files = [...lobby.uploads.values()].map(entry => entry.file);
      // a throw (too deep to compare, say) refuses every file, so the lobby never stays full
      let checked: ReturnType<typeof checkPauseFiles>;
      try {
        checked = checkPauseFiles(game, files);
      } catch {
        checked = pauseFilesMismatch(files, files.map(entry => entry.seat));
      }
      if ('error' in checked) {
        for (const seat of checked.seats) dropUpload(lobby, seat);
        lobby.error = checked.error;
        if (lobby.uploads.size === 0) forgetLobby(roomId, lobby);
        return lobby.uploads.has(file.seat) ? { ...lobbyStatus(lobby), ...mine } : { error: checked.error };
      }
      restoreRoom(roomId, lobby, checked.room);
      return { ...roomStatus(rooms.get(roomId)!), ...mine };
    },

    // For a key an upload was given: the lobby's status (which keeps it), or the restored room's; anything else is NOT_AVAILABLE
    resumeStatus(gameType: unknown, gameId: unknown, credential: unknown): ResumeStatus | { error: typeof NOT_AVAILABLE } {
      const game = findGame(gameType);
      if (!game || typeof credential !== 'string') return { error: NOT_AVAILABLE };
      const roomId = `${game.info.id}/${cleanName(gameId)}`;
      const holds = (keys: string[]) => keys.some(key => sameSecret(key, credential));
      const lobby = lobbies.get(roomId);
      if (lobby && holds([...lobby.uploads.values()].map(upload => upload.seatKey))) {
        touchLobby(roomId, lobby);
        return lobbyStatus(lobby);
      }
      const room = rooms.get(roomId);
      return room && holds(Object.values(room.state.seatKeys ?? {})) ? roomStatus(room) : { error: NOT_AVAILABLE };
    },

    // Only for the end-to-end test hooks in e2e.ts
    removeRoom(roomId: string): boolean {
      if (!rooms.has(roomId)) return false;
      deleteRoom(roomId);
      return true;
    },

    // Not a move: only the log on the live state changes, so undo, the move count and the turn are untouched.
    // The sender is a seat or a spectator; a spectator may react to any player
    react(
      roomId: string, sender: Seat | { spectatorId: string }, target: unknown, emoji: unknown
    ): { reaction: Reaction } | { error: string } {
      const room = rooms.get(roomId);
      if (!room) return { error: 'Game not found' };
      const spectator = typeof sender === 'number'
        ? undefined
        : room.state.spectators?.find(candidate => candidate.id === sender.spectatorId);
      if (typeof sender === 'number' ? !room.state.activePlayers.includes(sender) : !spectator) {
        return { error: 'You are not in this game' };
      }
      const { state } = room;
      if (!state.started || state.isGameOver) return { error: 'Reactions open once the game starts' };
      if (typeof emoji !== 'string' || !isSingleEmoji(emoji)) return { error: 'Send a single emoji' };
      const to = state.activePlayers.find(candidate => candidate === target);
      if (to === undefined) return { error: 'That player is not in this game' };
      if (to === sender) return { error: 'Pick another player to react to' };
      const key = spectator ? `spectator:${spectator.id}` : `seat:${sender as Seat}`;
      const wait = (room.lastReactionAt.get(key) ?? -Infinity) + REACTION_COOLDOWN_MS - now();
      if (wait > 0) return { error: `You can react again in ${Math.ceil(wait / 1000)} s` };

      const from = spectator ? spectator.name : state.playerNames[sender as Seat];
      const reaction: Reaction = { from, fromSpectator: Boolean(spectator), target: to, emoji, at: now() };
      room.lastReactionAt.set(key, reaction.at);
      const reactions = [...(state.reactions ?? []), { ...reaction, moveCount: room.timeline.length }].slice(-MAX_REACTIONS);
      room.state = { ...state, reactions };
      save(roomId, room);
      return { reaction };
    },

    // The starting board, the state right after each move, and the live state when the game ended without a move
    // (everyone else left, a resignation); oldest first. Null when the game does not exist
    // Every caller sees the table, whatever they were
    history(gameType: unknown, gameId: unknown, credential: unknown, n?: number): { steps: HistoryStep[] } | { error: typeof NOT_AVAILABLE } {
      const found = findHistoryRoom(gameType, gameId, credential, n);
      if (!found) return { error: NOT_AVAILABLE };
      return { steps: historyMoments(found.room).map(moment => historyStep(found.room, moment, null)) };
    },

    // The finished game as a version 2 file: each step as the table sees it plus one view per seat
    // A spectator's file has only the seats that allowed them, each as the table plus that seat's private fields,
    // the same as their live view, so nothing a seat saw of another seat (an UNO challenge) reaches them
    gameFile(gameType: unknown, gameId: unknown, credential: unknown, now: Date, n?: number): { file: GameFile } | { error: string } {
      const found = findHistoryRoom(gameType, gameId, credential, n);
      if (!found) return { error: NOT_AVAILABLE };
      const { game, room, who } = found;
      if (!room.state.isGameOver) return { error: 'The game is not over yet' };
      const { privateSeatView } = room.game;
      const steps = historyMoments(room).map(moment => {
        const table = historyStep(room, moment, null);
        const seatView = (seat: Seat): HistoryStep => who.kind === 'player' || !privateSeatView
          ? historyStep(room, moment, seat)
          : { ...table, ...(privateSeatView(moment.state, seat) as object) };
        return {
          ...table,
          views: Object.fromEntries(
            Object.keys(moment.state.playerNames)
              .filter(seat => who.kind === 'player' || who.allowedSeats.includes(Number(seat)))
              .map(seat => [seat, seatView(Number(seat))])
          )
        };
      });
      const images = embedImages(imageIdsOf(game, roomStates(room)), loadImage);
      return { file: buildGameFile(game.info.id, cleanName(gameId), steps, now, images) };
    },

    // A picture from a seated player of an existing room, the lobby included; the seat key proves the seat.
    // It is kept until the room is deleted, or for as long as an archived game shows it
    uploadImage(gameType: unknown, gameId: unknown, seatKey: unknown, bytes: Buffer): { id: string } | { error: ImageUploadError } {
      const game = findGame(gameType);
      const roomId = game && `${game.info.id}/${cleanName(gameId)}`;
      const room = roomId && rooms.get(roomId);
      if (!room || !store) return { error: 'no-room' };
      const { state } = room;
      const seated = typeof seatKey === 'string' && state.activePlayers.some(seat => {
        const key = state.seatKeys?.[seat];
        return key !== undefined && sameSecret(key, seatKey);
      });
      if (!seated) return { error: 'not-seated' };
      const mime = imageMime(bytes);
      if (!mime || bytes.length > MAX_IMAGE_BYTES) return { error: 'not-an-image' };
      if (store.countRoomImages(roomId) >= MAX_ROOM_IMAGES) return { error: 'too-many' };
      const id = newImageId();
      store.saveImage(id, roomId, mime, bytes); // a failure throws, so no id is handed out for an image that is not there
      return { id };
    },

    loadImage,

    // Lobbies, then games in progress, with player names only; takes no `this` so it can be passed as a callback
    openGames(): OpenGame[] {
      const open: OpenGame[] = [];
      for (const room of rooms.values()) {
        const { state } = room;
        if (state.isGameOver || (state.started && connectedPlayers(state).length === 0)) continue;
        // Built field by field so no state field can leak
        open.push({
          gameType: room.game.info.id,
          gameId: state.gameId,
          players: state.activePlayers.map(seat => state.playerNames[seat]),
          playing: state.started
        });
      }
      return open.sort((a, b) =>
        Number(a.playing) - Number(b.playing) || a.gameType.localeCompare(b.gameType) || a.gameId.localeCompare(b.gameId));
    },

    // As `viewer` sees it; null sees no player's hidden information
    getState(roomId: string, viewer: Seat | null = null): BasePublicState | undefined {
      const room = rooms.get(roomId);
      return room && view(room, viewer);
    },

    // Only for the end-to-end test hooks in e2e.ts: the full state, secrets included
    rawState(roomId: string): BaseGameState | undefined {
      return rooms.get(roomId)?.state;
    },

    // Only for the end-to-end test hooks in e2e.ts: swaps in a crafted state, keeping each seat's key
    replaceState(roomId: string, state: BaseGameState): boolean {
      const room = rooms.get(roomId);
      if (!room) return false;
      room.state = { ...state, seatKeys: room.state.seatKeys, spectatorKeys: room.state.spectatorKeys };
      save(roomId, room);
      return true;
    },

    disconnectSpectator(roomId: string, spectatorId: string): void {
      const room = rooms.get(roomId);
      if (!room?.watching.delete(spectatorId)) return;
      if (!room.state.started) { // nothing to keep before the start, and the browser drops its key, so free the name
        const { [spectatorId]: _key, ...spectatorKeys } = room.state.spectatorKeys ?? {};
        room.state = { ...room.state, spectators: (room.state.spectators ?? []).filter(s => s.id !== spectatorId), spectatorKeys };
        if (room.state.activePlayers.length === 0 && !tableScreenWatching(room)) deleteRoom(roomId); // the TV was all that held it open
        else save(roomId, room);
        return;
      }
      room.state = { ...room.state, handRequests: (room.state.handRequests ?? []).filter(r => r.spectator !== spectatorId) };
      save(roomId, room);
    },

    // Only the asking spectator and the asked player are involved, so the table's status line stays as it is
    requestHand(roomId: string, spectatorId: string, seat: unknown): Result<BasePublicState> {
      const room = rooms.get(roomId);
      const spectator = room?.state.spectators?.find(candidate => candidate.id === spectatorId);
      if (!room || !spectator) return { error: 'You are not in this game' };
      const { state } = room;
      if (!room.game.privateSeatView) return { error: 'Nothing is hidden in this game' };
      if (spectator.tableScreen) return { error: 'A table screen never asks' };
      if (room.game.spectatorsSeeEverySeat) return { error: 'You already see every seat' };
      if (!state.started) return { error: 'Wait for the game to start' }; // seats are only fixed from then on
      if (state.isGameOver) return { error: 'The game is over' };
      if (typeof seat !== 'number' || !state.activePlayers.includes(seat)) return { error: 'That player is not in this game' };
      if (spectator.allowedSeats.includes(seat)) return { error: 'You can already see that hand' };
      const open = openHandRequests(state, room.watching);
      if (open.some(request => request.spectator === spectatorId && request.seat === seat)) return { error: 'You already asked' };

      room.state = { ...state, handRequests: [...open, { spectator: spectatorId, seat }] };
      save(roomId, room);
      return { state: spectatorViewOf(room, spectatorId)! };
    },

    answerHand(roomId: string, seat: Seat, spectatorId: unknown, allow: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;
      if (!room.game.privateSeatView) return { error: 'Nothing is hidden in this game' };
      const asked = openHandRequests(state, room.watching).some(r => r.spectator === spectatorId && r.seat === seat);
      if (!asked) return { error: 'No request to answer' };

      room.state = {
        ...state,
        handRequests: (state.handRequests ?? []).filter(r => r.spectator !== spectatorId || r.seat !== seat),
        spectators: (state.spectators ?? []).map(spectator =>
          allow === true && spectator.id === spectatorId
            ? { ...spectator, allowedSeats: [...spectator.allowedSeats, seat] }
            : spectator)
      };
      save(roomId, room);
      return { state: view(room, seat) };
    },

    getSpectatorState(roomId: string, spectatorId: string): BasePublicState | undefined {
      const room = rooms.get(roomId);
      return room && spectatorViewOf(room, spectatorId);
    },

    // Only before the first move; the spectator's entry goes and they are seated the usual way
    switchToPlayer(roomId: string, spectatorId: string, deviceId?: unknown): JoinResult {
      const room = rooms.get(roomId);
      const spectator = room?.state.spectators?.find(candidate => candidate.id === spectatorId);
      if (!room || !spectator) return { error: 'You are not in this game' };
      if (room.state.started) return { error: 'The game has started; keep watching until the rematch' };

      const { [spectatorId]: _key, ...spectatorKeys } = room.state.spectatorKeys ?? {};
      const spectators = (room.state.spectators ?? []).filter(candidate => candidate.id !== spectatorId);
      const result = addPlayer(room.game, { ...room.state, spectators, spectatorKeys }, spectator.name, random);
      if ('error' in result) return result;

      const key = randomUUID();
      room.watching.delete(spectatorId);
      room.state = withDevice({ ...result.state, seatKeys: { ...result.state.seatKeys, [result.seat]: key } }, result.seat, deviceId);
      save(roomId, room);
      return { roomId, seat: result.seat, seatKey: key, state: view(room, result.seat) };
    },

    // Only for the end-to-end test hooks in e2e.ts: runs `ticks` simulation ticks at once; false when there is no such game
    simulateTicks(roomId: string, ticks: number): boolean {
      const room = rooms.get(roomId);
      if (!room) return false;
      for (let tick = 0; tick < ticks && room.game.simulating?.(room.state); tick++) runSimulationTick(roomId, room);
      return true;
    }
  };
}
