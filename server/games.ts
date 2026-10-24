import { randomUUID } from 'node:crypto';
import type { GameDefinition } from '../shared/gameDefinition.ts';
import {
  addPlayer, applyMove, connectedPlayers, disconnectPlayer, findSeatByName, reconnectPlayer, removePlayer,
  resolveDismissVote
} from '../shared/seating.ts';
import { agreeToHouseRules, everyoneAgreed, houseRulesOf, needsAgreement, setHouseRules } from '../shared/houseRules.ts';
import { buildGameFile, type GameFile } from '../shared/gameFile.ts';
import type { GameStore, SavedRoom, StepChange } from './store.ts';
import { MAX_NAME_LENGTH } from '../shared/types.ts';
import type { BaseGameState, BasePublicState, HistoryStep, Random, Result, Seat } from '../shared/types.ts';

export const EMPTY_ROOM_TIMEOUT_MS = 10 * 60 * 1000; // how long a started game waits with nobody connected

// `history` holds the state before each move, for undo; `timeline` holds the state right after each move.
// Neither leaves this module except through the game's public view.
// Games differ in their state types, so a room holds its game's state type-erased.
type Room = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  game: GameDefinition<any, BasePublicState>;
  state: BaseGameState;
  history: BaseGameState[];
  timeline: BaseGameState[];
  emptyTimer?: ReturnType<typeof setTimeout>; // set while a started game has nobody connected
  deadlineTimer?: ReturnType<typeof setTimeout>; // set while the game has a deadline
};

// `now` is the server clock (tests set their own); `changed` hears of a change no player made, a timeout
export type ManagerHooks = { now?: () => number; changed?: (roomId: string) => void };

type HistoryMoment = { state: BaseGameState; moveCount: number; historyStep: HistoryStep['historyStep'] };

export type JoinResult = { roomId: string; seat: Seat; seatKey: string; state: BasePublicState } | { error: string };

function cleanName(value: unknown): string {
  return String(value ?? '').trim().slice(0, MAX_NAME_LENGTH);
}

// Holds every game in memory, keyed by game type and game ID. Only the public view of a game ever leaves this module.
// With a `store`, started games are saved after every change and come back on creation with every seat held.
export function createGameManager(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  games: readonly GameDefinition<any, any>[], random: Random = Math.random, store?: GameStore, hooks: ManagerHooks = {}
) {
  const rooms = new Map<string, Room>();
  const now = hooks.now ?? Date.now;

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

  // Only a started game is kept: a lobby lost in a restart is just joined again.
  // `step` is how this change moved `history` and `timeline`, so only that step is written
  // Every change passes through here, so this is also where the room's deadline is rescheduled
  function save(roomId: string, room: Room, step?: StepChange): void {
    const { game, state } = room;
    writeStore(roomId, target => {
      if (state.started) target.save(roomId, game.info.id, state, step);
      else target.remove(roomId);
    });
    scheduleDeadline(roomId, room);
  }

  // Records `next` as a move after the current state, for undo, history and the store
  function record(roomId: string, room: Room, next: BaseGameState): void {
    const index = room.history.push(room.state) - 1;
    room.timeline.push(next);
    room.state = next;
    save(roomId, room, { type: 'push', index, before: room.history[index], after: next });
  }

  // Open votes and disconnects do not pause a clock; only the game's own deadline does
  function scheduleDeadline(roomId: string, room: Room): void {
    clearTimeout(room.deadlineTimer);
    room.deadlineTimer = undefined;
    const deadline = room.state.isGameOver ? null : room.game.deadline?.(room.state) ?? null;
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
    hooks.changed?.(roomId);
  }

  function deleteRoom(roomId: string): void {
    clearTimeout(rooms.get(roomId)?.deadlineTimer);
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
    const { seatKeys: _seatKeys, ...view } = room.game.toPublicState(state, undoAvailable, viewer);
    return { ...view, moveCount, houseRules: houseRulesOf(room.game.info, state) };
  }

  // The current state as `viewer` may see it, stamped with the server time for countdowns
  function view(room: Room, viewer: Seat | null): BasePublicState {
    return { ...publicView(room, room.state, room.history.length > 0, room.timeline.length, viewer), serverTime: now() };
  }

  function findHistoryRoom(gameType: unknown, gameId: unknown) {
    const game = findGame(gameType);
    const room = game && rooms.get(`${game.info.id}/${cleanName(gameId)}`);
    return room ? { game, room } : null;
  }

  // The states a history shows, oldest first: the start, each move, and the live state when the game ended without one
  function historyMoments(room: Room): HistoryMoment[] {
    const moments: HistoryMoment[] = [
      { state: room.history[0] ?? room.state, moveCount: 0, historyStep: 'start' },
      ...room.timeline.map((state, index): HistoryMoment => ({ state, moveCount: index + 1, historyStep: 'move' }))
    ];
    if (room.state.isGameOver && !room.timeline.at(-1)?.isGameOver) {
      moments.push({ state: room.state, moveCount: room.timeline.length, historyStep: 'end' });
    }
    return moments;
  }

  function historyStep(room: Room, { state, moveCount, historyStep }: HistoryMoment, viewer: Seat | null): HistoryStep {
    return { ...publicView(room, state, false, moveCount, viewer), historyStep };
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
      undoVote: null,
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
    room.state = { ...restored, gameStatus };
    return { type: 'pop', index: room.history.length };
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
    let state: BaseGameState = { ...saved.state, undoVote: null, dismissVote: null, disconnected };
    if (game.resumeClock) state = game.resumeClock(state, now());
    const room: Room = { game, state, history: saved.history, timeline: saved.timeline };
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
    join(gameType: unknown, gameId: unknown, playerName: unknown, rejoin?: unknown, seatKey?: unknown): JoinResult {
      const game = findGame(gameType);
      if (!game) return { error: 'Unknown game' };

      const id = cleanName(gameId);
      const name = cleanName(playerName);
      if (!id) return { error: 'Please enter a game ID' };
      if (!name) return { error: 'Please enter your name' };

      const roomId = `${game.info.id}/${id}`;
      const existing = rooms.get(roomId);
      if (!existing && rejoin === true) return { error: 'Game not found' };
      const room: Room = existing ?? { game, state: game.createGameState(id), history: [], timeline: [] };
      const { state } = room;

      const known = findSeatByName(state, name);
      if (known !== undefined) {
        if (!state.activePlayers.includes(known)) return { error: 'You were removed from this game' };
        if (!state.disconnected.includes(known)) return { error: `${state.playerNames[known]} is already in this game` };
        // A game saved before seat keys existed has none, so its first rejoin by name is given one
        const expected = state.seatKeys?.[known];
        if (expected !== undefined && seatKey !== expected) return { error: 'That name is taken in this game' };
        const key = expected ?? randomUUID();
        room.state = { ...reconnectPlayer(state, known), seatKeys: { ...state.seatKeys, [known]: key } };
        clearEmptyTimer(room);
        save(roomId, room);
        return { roomId, seat: known, seatKey: key, state: view(room, known) };
      }
      if (rejoin === true) return { error: 'You are not in this game' };

      const result = addPlayer(game, state, name, random);
      if ('error' in result) return result;

      const key = randomUUID();
      room.state = { ...result.state, seatKeys: { ...result.state.seatKeys, [result.seat]: key } };
      rooms.set(roomId, room);
      save(roomId, room);
      return { roomId, seat: result.seat, seatKey: key, state: view(room, result.seat) };
    },

    // Before the first move this frees the seat; after it the seat is held for a rejoin
    disconnect(roomId: string, seat: Seat): { state: BasePublicState } | null {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return null;
      const { room } = found;

      room.state = disconnectPlayer(room.game, room.state, seat, random);
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
      if (!room.state.started && needsAgreement(room.game.info) && !everyoneAgreed(room.game.info, room.state)) {
        return { error: 'Everyone must agree to the house rules first' };
      }
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

    // Not turn-bound and never pushed to `history` or `timeline`, so an undo skips over it
    action(roomId: string, seat: Seat, action: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      if (!room.game.applyAction) return { error: 'This game has no actions' };

      const result = room.game.applyAction(room.state, seat, action, random);
      if ('error' in result) return result;

      room.state = result.state;
      save(roomId, room);
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
      room.state = resolveDismissVote(room.game, opened, random); // a lone connected player passes it at once
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
      room.state = resolveDismissVote(room.game, approved, random);
      save(roomId, room);
      return { state: view(room, seat) };
    },

    // The starting board, the state right after each move, and the live state when the game ended without a move
    // (everyone else left, a resignation); oldest first. Null when the game does not exist
    history(gameType: unknown, gameId: unknown): HistoryStep[] | null {
      const found = findHistoryRoom(gameType, gameId);
      return found && historyMoments(found.room).map(moment => historyStep(found.room, moment, null));
    },

    // The finished game as a version 2 file: each step as the table sees it plus one view per seat
    gameFile(gameType: unknown, gameId: unknown, now: Date): { file: GameFile } | { error: string } | null {
      const found = findHistoryRoom(gameType, gameId);
      if (!found) return null;
      const { game, room } = found;
      if (!room.state.isGameOver) return { error: 'The game is not over yet' };
      const steps = historyMoments(room).map(moment => ({
        ...historyStep(room, moment, null),
        views: Object.fromEntries(
          Object.keys(moment.state.playerNames).map(seat => [seat, historyStep(room, moment, Number(seat))])
        )
      }));
      return { file: buildGameFile(game.info.id, cleanName(gameId), steps, now) };
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
      room.state = { ...state, seatKeys: room.state.seatKeys };
      save(roomId, room);
      return true;
    }
  };
}
