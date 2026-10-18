import type { GameDefinition } from '../shared/gameDefinition.ts';
import {
  addPlayer, applyMove, connectedPlayers, disconnectPlayer, findSeatByName, nextActivePlayer, reconnectPlayer,
  resolveDismissVote
} from '../shared/seating.ts';
import type { GameStore } from './store.ts';
import type { BaseGameState, BasePublicState, HistoryStep, Random, Result, Seat } from '../shared/types.ts';

const MAX_NAME_LENGTH = 20; // applies to player names and game IDs
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
};

export type JoinResult = { roomId: string; seat: Seat; state: BasePublicState } | { error: string };

function cleanName(value: unknown): string {
  return String(value ?? '').trim().slice(0, MAX_NAME_LENGTH);
}

// Holds every game in memory, keyed by game type and game ID. Only the public view of a game ever leaves this module.
// With a `store`, started games are saved after every change and come back on creation with every seat held.
export function createGameManager(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  games: readonly GameDefinition<any, any>[], random: Random = Math.random, store?: GameStore
) {
  const rooms = new Map<string, Room>();

  function findGame(gameType: unknown) {
    return games.find(candidate => candidate.info.id === gameType);
  }

  // Only a started game is kept: a lobby lost in a restart is just joined again
  function save(roomId: string, room: Room): void {
    const { game, state, history, timeline } = room;
    if (state.started) store?.save(roomId, { gameType: game.info.id, state, history, timeline });
    else store?.remove(roomId);
  }

  function deleteRoom(roomId: string): void {
    rooms.delete(roomId);
    store?.remove(roomId);
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
    return { ...room.game.toPublicState(state, undoAvailable, viewer), moveCount };
  }

  // The current state as `viewer` may see it
  function view(room: Room, viewer: Seat | null): BasePublicState {
    return publicView(room, room.state, room.history.length > 0, room.timeline.length, viewer);
  }

  function findPlayer(roomId: string, seat: Seat): { room: Room } | { error: string } {
    const room = rooms.get(roomId);
    if (!room) return { error: 'Game not found' };
    if (!room.state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
    return { room };
  }

  // Applies the undo once every connected player has approved; an undo always needs two connected players,
  // so a vote left with fewer (after a disconnect) is canceled instead
  function resolveUndoVote(room: Room): void {
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

    const restored: BaseGameState = {
      ...previous,
      started: true,
      activePlayers: state.activePlayers,
      playerNames: state.playerNames,
      undoVote: null,
      disconnected: state.disconnected,
      dismissVote: null,
      gameStatus: 'Last turn undone'
    };
    const current = restored.currentPlayer;
    if (current !== null && !restored.activePlayers.includes(current)) {
      restored.currentPlayer = nextActivePlayer(restored, current);
    }
    room.state = restored;
  }

  function clearEmptyTimer(room: Room): void {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = undefined;
  }

  // Nobody is connected after a restart, so every seat is held for a rejoin. Open votes are cleared first:
  // disconnecting the voters one by one could otherwise pass a vote nobody finished
  for (const [roomId, saved] of store?.loadAll() ?? []) {
    const game = findGame(saved.gameType);
    if (!game) {
      store?.remove(roomId);
      continue;
    }
    let state: BaseGameState = { ...saved.state, undoVote: null, dismissVote: null };
    for (const seat of connectedPlayers(state)) state = disconnectPlayer(game, state, seat, random);
    const room: Room = { game, state, history: saved.history, timeline: saved.timeline };
    rooms.set(roomId, room);
    save(roomId, room);
    startEmptyTimer(roomId, room);
  }

  return {
    // `rejoin` only takes back a held seat; it never creates a game or takes a new seat
    join(gameType: unknown, gameId: unknown, playerName: unknown, rejoin?: unknown): JoinResult {
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
        room.state = reconnectPlayer(state, known);
        clearEmptyTimer(room);
        save(roomId, room);
        return { roomId, seat: known, state: view(room, known) };
      }
      if (rejoin === true) return { error: 'You are not in this game' };

      const result = addPlayer(game, state, name, random);
      if ('error' in result) return result;

      room.state = result.state;
      rooms.set(roomId, room);
      save(roomId, room);
      return { roomId, seat: result.seat, state: view(room, result.seat) };
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
      resolveUndoVote(room);
      save(roomId, room);
      startEmptyTimer(roomId, room);
      return { state: view(room, seat) };
    },

    move(roomId: string, seat: Seat, move: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;

      const result = applyMove(room.game, room.state, seat, move, random);
      if ('error' in result) return result;

      room.history.push(room.state);
      room.timeline.push(result.state);
      room.state = result.state;
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
      resolveUndoVote(room);
      save(roomId, room);
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
      const game = findGame(gameType);
      const room = game && rooms.get(`${game.info.id}/${cleanName(gameId)}`);
      if (!room) return null;
      const step = (state: BaseGameState, moveCount: number, historyStep: HistoryStep['historyStep']): HistoryStep =>
        ({ ...publicView(room, state, false, moveCount, null), historyStep });
      const steps = [
        step(room.history[0] ?? room.state, 0, 'start'),
        ...room.timeline.map((state, index) => step(state, index + 1, 'move'))
      ];
      const last = room.timeline.at(-1);
      if (room.state.isGameOver && !last?.isGameOver) steps.push(step(room.state, room.timeline.length, 'end'));
      return steps;
    },

    // As `viewer` sees it; null sees no player's hidden information
    getState(roomId: string, viewer: Seat | null = null): BasePublicState | undefined {
      const room = rooms.get(roomId);
      return room && view(room, viewer);
    }
  };
}
