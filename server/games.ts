import { randomUUID, timingSafeEqual } from 'node:crypto';
import { SIMULATION_TICK_MS, type GameDefinition } from '../shared/gameDefinition.ts';
import {
  addPlayer, applyMove, connectedPlayers, disconnectPlayer, findSeatByName, reconnectPlayer, removePlayer,
  resolveDismissVote
} from '../shared/seating.ts';
import {
  agreeToHouseRules, agreementPending, everyoneAgreed, houseRulesOf, minimumToStart, setHouseRules
} from '../shared/houseRules.ts';
import { stampTurn, turnLimitMs } from '../shared/turnTimer.ts';
import { buildGameFile, type GameFile } from '../shared/gameFile.ts';
import { isSingleEmoji, MAX_REACTIONS, REACTION_COOLDOWN_MS, type Reaction } from '../shared/reactions.ts';
import type { ArchivedGame, GameStore, SavedRoom, StepChange } from './store.ts';
import { hashDeviceId } from './devices.ts';
import { MAX_SPECTATORS, openHandRequests, spectatorView } from '../shared/spectators.ts';
import { standingsOf } from '../shared/standings.ts';
import { MAX_NAME_LENGTH } from '../shared/types.ts';
import type { HandRequest, JoinRole } from '../shared/types.ts';
import type {
  BaseGameState, BasePublicState, GameResult, HistoryStep, OpenGame, Random, Result, Seat
} from '../shared/types.ts';

export const EMPTY_ROOM_TIMEOUT_MS = 10 * 60 * 1000; // how long a started game waits with nobody connected
export const ARCHIVE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // how long a finished game stays in the archive
const ARCHIVE_PRUNE_MS = 24 * 60 * 60 * 1000;

// `history` holds the state before each move, for undo; `timeline` holds the state right after each move.
// Neither leaves this module except through the game's public view.
// Games differ in their state types, so a room holds its game's state type-erased.
type Room = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  game: GameDefinition<any, BasePublicState>;
  state: BaseGameState;
  history: BaseGameState[];
  timeline: BaseGameState[];
  clockSeat?: Seat | null; // whose turn the turn timer was stamped for; memory only
  emptyTimer?: ReturnType<typeof setTimeout>; // set while a started game has nobody connected
  deadlineTimer?: ReturnType<typeof setTimeout>; // set while the game has a deadline
  simTimer?: ReturnType<typeof setInterval>; // set while the game is simulating
  watching: Set<string>; // ids of the connected spectators; in memory only, like sockets
  lastReactionAt: Map<string, number>; // by sender key; kept off the state, so a restart clears every cooldown
};

// `now` is the server clock (tests set their own); `changed` hears of a change no player made, a timeout or a tick;
// `onGameFinished` hears of each game once, when it first ends.
// `manualSimulation` runs no timer: the end-to-end tests step the simulation with simulateTicks
export type ManagerHooks = {
  now?: () => number;
  changed?: (roomId: string) => void;
  onGameFinished?: (result: GameResult) => void;
  manualSimulation?: boolean;
};

const STAMP_KEYS = ['turnStartedAt', 'turnPausedAt'] as const;

type HistoryMoment = { state: BaseGameState; moveCount: number; historyStep: HistoryStep['historyStep'] };

export type JoinResult =
  | { roomId: string; seat: Seat | null; spectatorId?: string; seatKey: string; state: BasePublicState }
  | { error: string };

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
  state: BaseGameState, credential: string | undefined
): { kind: 'player' } | { kind: 'spectator'; allowedSeats: Seat[] } | null {
  if (typeof credential !== 'string' || credential === '') return null;
  const device = hashDeviceId(credential);
  if (Object.values(state.seatKeys ?? {}).some(key => sameSecret(key, credential))) return { kind: 'player' };
  if (device && Object.values(state.seatDevices ?? {}).some(hash => sameSecret(hash, device))) return { kind: 'player' };
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
  const now = hooks.now ?? Date.now;

  function pruneArchive(): void {
    writeStore('archive', target => { target.pruneArchive(now() - ARCHIVE_TTL_MS); });
  }
  pruneArchive();
  setInterval(pruneArchive, ARCHIVE_PRUNE_MS).unref();

  function findGame(gameType: unknown) {
    return games.find(candidate => candidate.info.id === gameType);
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

  // Keeps the room's finished game; archiving again replaces it, so an undo and replay leave the final game
  function archiveRoom(roomId: string, room: Room): void {
    const { game, state } = room;
    writeStore(roomId, target => target.archive({
      id: archiveIdOf(roomId, state), gameType: game.info.id, gameId: state.gameId, n: state.gameNumber ?? 1,
      finishedAt: state.finishedAt ?? now(), state, history: room.history, timeline: room.timeline
    }));
  }

  // Stamps the first start and the first end; a game already stamped finished never reports again, even after an undo
  function stamp(roomId: string, room: Room): void {
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
    // Fewer than two left means the platform ended it after leaves or dismissals, not the game's own rules
    if (state.activePlayers.length < 2) result.abandoned = true;
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
    if (hooks.manualSimulation || !room.game.simulating?.(room.state)) {
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
    if (rooms.get(roomId) !== room || !game.simulate || !game.simulating?.(state)) return;
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
  // A join or leave clears the agreements, so it stops the clock until the last Agree restarts it
  function clockMayRun(room: Room): boolean {
    const { game, state } = room;
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
    writeStore(roomId, target => target.remove(roomId));
  }

  // Deletes a started game once nobody has been connected for EMPTY_ROOM_TIMEOUT_MS
  function startEmptyTimer(roomId: string, room: Room): void {
    if (!room.state.started || room.emptyTimer || connectedPlayers(room.state).length > 0) return;
    room.emptyTimer = setTimeout(() => {
      if (rooms.get(roomId) === room) deleteRoom(roomId);
    }, EMPTY_ROOM_TIMEOUT_MS);
    room.emptyTimer.unref(); // never keeps the process alive on its own
  }

  // The one place a public state is built: the game hides its secrets and the platform adds the move count
  function publicView(
    room: Room, state: BaseGameState, undoAvailable: boolean, moveCount: number, viewer: Seat | null
  ): BasePublicState {
    return platformView(room, state, room.game.toPublicState(state, undoAvailable, viewer), moveCount);
  }

  // Secrets and per-viewer lists are never part of a stored or shared view; the live view adds back what its viewer may see
  function platformView(
    room: Room, state: BaseGameState, raw: Omit<BasePublicState, 'moveCount'>, moveCount: number
  ): BasePublicState {
    const {
      seatKeys: _seatKeys, seatDevices: _seatDevices, spectatorKeys: _spectatorKeys, handRequests: _handRequests, spectators: _spectators,
      seatViews: _seatViews, reactions: _reactions, ...view
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

  // The current state as `viewer` may see it, stamped with the server time for countdowns
  function view(room: Room, viewer: Seat | null): BasePublicState {
    const base = publicView(room, room.state, room.history.length > 0, room.timeline.length, viewer);
    return live(room, base, request => request.seat === viewer);
  }

  // Adds what changes by the minute and is never stored: who is watching, and the open hand requests `wanted` picks
  function live(room: Room, base: BasePublicState, wanted: (request: HandRequest) => boolean): BasePublicState {
    return {
      ...base,
      spectators: (room.state.spectators ?? []).filter(spectator => room.watching.has(spectator.id)),
      handRequests: openHandRequests(room.state, room.watching).filter(wanted),
      serverTime: now()
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
    const who = room && access(room.state, typeof credential === 'string' ? credential : undefined);
    return room && who ? { game, room, who } : null;
  }

  function hasEndMoment(room: Room): boolean {
    return room.state.isGameOver && !room.timeline.at(-1)?.isGameOver;
  }

  // The states a history shows, oldest first: the start, each move, and the live state when the game ended without one
  function historyMoments(room: Room): HistoryMoment[] {
    const moments: HistoryMoment[] = [
      { state: room.history[0] ?? room.state, moveCount: 0, historyStep: 'start' },
      ...room.timeline.map((state, index): HistoryMoment => ({ state, moveCount: index + 1, historyStep: 'move' }))
    ];
    if (hasEndMoment(room)) {
      moments.push({ state: room.state, moveCount: room.timeline.length, historyStep: 'end' });
    }
    return moments;
  }

  function historyStep(room: Room, { state, moveCount, historyStep }: HistoryMoment, viewer: Seat | null): HistoryStep {
    // The last moment with a move count owns its reactions, so the end moment takes the count it shares with the last move or the start
    const shared = historyStep !== 'end' && moveCount === room.timeline.length && hasEndMoment(room);
    const reactions = shared ? [] : (room.state.reactions ?? [])
      .filter(reaction => reaction.moveCount === moveCount)
      .map(({ at, emoji, from, fromSpectator, target }): Reaction => ({ from, fromSpectator, target, emoji, at }));
    const { turnStartedAt: _started, turnPausedAt: _paused, ...past } = state; // a past turn has no live clock
    return { ...publicView(room, past, false, moveCount, viewer), historyStep, ...(reactions.length > 0 && { reactions }) };
  }

  function findPlayer(roomId: string, seat: Seat): { room: Room } | { error: string } {
    const room = rooms.get(roomId);
    if (!room) return { error: 'Game not found' };
    if (!room.state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
    return { room };
  }

  // Applies the undo once every connected player has approved; an undo always needs two connected players,
  // so a vote left with fewer (after a disconnect) is canceled instead. Returns the popped step when it undid a move
  function resolveUndoVote(room: Room): StepChange | undefined {
    const { state } = room;
    const vote = state.undoVote;
    if (!vote) return;
    const voters = connectedPlayers(state);
    if (voters.length < 2) {
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
      restored = removePlayer(room.game, restored, seat, random);
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
    room.state = resumeIfTurnMoved(room, voted, resolveDismissVote(room.game, voted, random));
  }

  function resumeIfTurnMoved(room: Room, before: BaseGameState, next: BaseGameState): BaseGameState {
    const turnMoved = next.started && !next.isGameOver && next.currentPlayer !== before.currentPlayer;
    return turnMoved && room.game.resumeClock ? room.game.resumeClock(next, now()) : next;
  }

  function clearEmptyTimer(room: Room): void {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = undefined;
  }

  // Nobody is connected after a restart, so every seat is held for a rejoin and open votes are cleared.
  // No game hook runs but `resumeClock`: a game's disconnect hook may deal the next round once nobody is waiting,
  // and a clock restarts from now, so the time the server was down is never charged
  function loadRoom(roomId: string, saved: SavedRoom): void {
    const game = findGame(saved.gameType);
    if (!game) throw new Error(`this site has no ${saved.gameType} game`);
    const disconnected = [...saved.state.activePlayers].sort((a, b) => a - b);
    // Nobody is watching either, so no hand request is still open; downtime is never charged to the turn timer
    let state: BaseGameState = {
      ...saved.state, undoVote: null, dismissVote: null, disconnected, handRequests: [], turnStartedAt: null, turnPausedAt: null
    };
    if (game.resumeClock) state = game.resumeClock(state, now());
    // A room saved before these stamps existed gets them now, so loading it never reports it as just finished
    if (state.startedAt === undefined) state = { ...state, startedAt: now() };
    if (state.isGameOver && state.finishedAt === undefined) state = { ...state, finishedAt: now() };
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
      writeStore(roomId, target => target.remove(roomId));
    }
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
      const name = cleanName(playerName);
      if (!id) return { error: 'Please enter a game ID' };
      if (!name) return { error: 'Please enter your name' };

      const roomId = `${game.info.id}/${id}`;
      const existing = rooms.get(roomId);
      if (!existing && (rejoin === true || role === 'spectator')) return { error: 'Game not found' };
      const room: Room = existing ?? {
        game, state: game.createGameState(id), history: [], timeline: [], watching: new Set(), lastReactionAt: new Map()
      };
      if (!existing) room.state = { ...room.state, gameNumber: nextGameNumber(game.info.id, id) };
      const { state } = room;
      const spectator = state.spectators?.find(candidate => candidate.name.toLowerCase() === name.toLowerCase());

      if (role === 'spectator') {
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
        const added = { id: randomUUID(), name, tableScreen: false, allowedSeats: [] };
        const key = randomUUID();
        room.state = {
          ...state,
          spectators: [...(state.spectators ?? []), added],
          spectatorKeys: { ...state.spectatorKeys, [added.id]: key }
        };
        room.watching.add(added.id);
        save(roomId, room);
        return { roomId, seat: null, spectatorId: added.id, seatKey: key, state: spectatorViewOf(room, added.id)! };
      }

      const known = findSeatByName(state, name);
      if (known !== undefined) {
        if (!state.activePlayers.includes(known)) return { error: 'You were removed from this game' };
        if (!state.disconnected.includes(known)) return { error: `${state.playerNames[known]} is already in this game` };
        // A game saved before seat keys existed has none, so its first rejoin by name is given one
        const expected = state.seatKeys?.[known];
        if (expected !== undefined && seatKey !== expected) return { error: 'That name is taken in this game' };
        const key = expected ?? randomUUID();
        room.state = withDevice({ ...reconnectPlayer(state, known), seatKeys: { ...state.seatKeys, [known]: key } }, known, deviceId);
        clearEmptyTimer(room);
        save(roomId, room);
        return { roomId, seat: known, seatKey: key, state: view(room, known) };
      }
      if (rejoin === true) return { error: 'You are not in this game' };
      if (spectator) return { error: 'That name is taken in this game' };

      const result = addPlayer(game, state, name, random);
      if ('error' in result) return result;

      const key = randomUUID();
      room.state = withDevice({ ...result.state, seatKeys: { ...result.state.seatKeys, [result.seat]: key } }, result.seat, deviceId);
      rooms.set(roomId, room);
      save(roomId, room);
      return { roomId, seat: result.seat, seatKey: key, state: view(room, result.seat) };
    },

    // Before the first move this frees the seat; after it the seat is held for a rejoin
    disconnect(roomId: string, seat: Seat): { state: BasePublicState } | null {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return null;
      const { room } = found;

      // A disconnect can settle a dismiss vote, which may move the turn on like any other dismissal
      room.state = resumeIfTurnMoved(room, room.state, disconnectPlayer(room.game, room.state, seat, random));
      if (room.state.activePlayers.length === 0) {
        deleteRoom(roomId);
        return null;
      }
      const step = resolveUndoVote(room);
      save(roomId, room, step);
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

    requestUndo(roomId: string, seat: Seat): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;

      if (room.history.length === 0) return { error: 'Nothing to undo' };
      if (state.undoVote) return { error: 'An undo vote is already in progress' };
      if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
      if (connectedPlayers(state).length < 2) return { error: 'Not enough players to vote' };

      room.state = {
        ...state,
        undoVote: { requestedBy: seat, votes: { [seat]: true } },
        gameStatus: `${state.playerNames[seat]} wants to undo the last turn`
      };
      save(roomId, room);
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

      const held = state.disconnected.find(candidate => candidate === target);
      if (held === undefined) return { error: 'That player is not disconnected' };
      if (state.undoVote || state.dismissVote) return { error: 'A vote is already in progress' };

      const opened = {
        ...state,
        dismissVote: { target: held, requestedBy: seat, votes: { [seat]: true } },
        gameStatus: `${state.playerNames[seat]} wants to dismiss ${state.playerNames[held]}`
      };
      settleDismissVote(room, opened); // a lone connected player passes it at once
      save(roomId, room);
      return { state: view(room, seat) };
    },

    voteDismiss(roomId: string, seat: Seat, approve: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;
      const vote = state.dismissVote;

      if (!vote) return { error: 'No dismiss vote in progress' };
      if (vote.votes[seat]) return { error: 'You already voted' };

      if (approve !== true) {
        const gameStatus = `${state.playerNames[seat]} declined to dismiss ${state.playerNames[vote.target]}`;
        room.state = { ...state, dismissVote: null, gameStatus };
        save(roomId, room);
        return { state: view(room, seat) };
      }

      const approved = { ...state, dismissVote: { ...vote, votes: { ...vote.votes, [seat]: true } } };
      settleDismissVote(room, approved);
      save(roomId, room);
      return { state: view(room, seat) };
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
    // A spectator's file has only the seats that allowed them
    gameFile(gameType: unknown, gameId: unknown, credential: unknown, now: Date, n?: number): { file: GameFile } | { error: string } {
      const found = findHistoryRoom(gameType, gameId, credential, n);
      if (!found) return { error: NOT_AVAILABLE };
      const { game, room, who } = found;
      if (!room.state.isGameOver) return { error: 'The game is not over yet' };
      const steps = historyMoments(room).map(moment => ({
        ...historyStep(room, moment, null),
        views: Object.fromEntries(
          Object.keys(moment.state.playerNames)
            .filter(seat => who.kind === 'player' || who.allowedSeats.includes(Number(seat)))
            .map(seat => [seat, historyStep(room, moment, Number(seat))])
        )
      }));
      return { file: buildGameFile(game.info.id, cleanName(gameId), steps, now) };
    },

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
        save(roomId, room);
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
    switchToPlayer(roomId: string, spectatorId: string): JoinResult {
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
      room.state = { ...result.state, seatKeys: { ...result.state.seatKeys, [result.seat]: key } };
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
