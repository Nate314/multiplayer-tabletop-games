import type { GameDefinition } from '../shared/gameDefinition.ts';
import { addPlayer, applyMove, nextActivePlayer, removePlayer } from '../shared/seating.ts';
import type { BaseGameState, BasePublicState, Random, Result, Seat } from '../shared/types.ts';

const MAX_NAME_LENGTH = 20; // applies to player names and game IDs

// `history` holds the state before each move, for undo. It never leaves this module.
// Games differ in their state types, so a room holds its game's state type-erased.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Room = { game: GameDefinition<any, any>; state: BaseGameState; history: BaseGameState[] };

export type JoinResult = { roomId: string; seat: Seat; state: BasePublicState } | { error: string };

// Holds every game in memory, keyed by game type and game ID. Only the public view of a game ever leaves this module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGameManager(games: readonly GameDefinition<any, any>[], random: Random = Math.random) {
  const rooms = new Map<string, Room>();

  function view(room: Room): BasePublicState {
    return room.game.toPublicState(room.state, room.history.length > 0);
  }

  function findPlayer(roomId: string, seat: Seat): { room: Room } | { error: string } {
    const room = rooms.get(roomId);
    if (!room) return { error: 'Game not found' };
    if (!room.state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
    return { room };
  }

  // Applies the undo once every connected player has approved
  function resolveUndoVote(room: Room): void {
    const { state } = room;
    const vote = state.undoVote;
    if (!vote || !state.activePlayers.every(seat => vote.votes[seat])) return;

    const previous = room.history.pop();
    if (!previous) return; // Unreachable: a vote only opens when there is history

    const restored: BaseGameState = {
      ...previous,
      started: true,
      activePlayers: state.activePlayers,
      playerNames: state.playerNames,
      undoVote: null,
      gameStatus: 'Last turn undone'
    };
    const current = restored.currentPlayer;
    if (current !== null && !restored.activePlayers.includes(current)) {
      restored.currentPlayer = nextActivePlayer(restored, current);
    }
    room.state = restored;
  }

  return {
    join(gameType: unknown, gameId: unknown, playerName: unknown): JoinResult {
      const game = games.find(candidate => candidate.info.id === gameType);
      if (!game) return { error: 'Unknown game' };

      const id = String(gameId ?? '').trim().slice(0, MAX_NAME_LENGTH);
      const name = String(playerName ?? '').trim().slice(0, MAX_NAME_LENGTH);
      if (!id) return { error: 'Please enter a game ID' };
      if (!name) return { error: 'Please enter your name' };

      const roomId = `${game.info.id}/${id}`;
      const room: Room = rooms.get(roomId) ?? { game, state: game.createGameState(id), history: [] };
      const result = addPlayer(game, room.state, name, random);
      if ('error' in result) return result;

      room.state = result.state;
      rooms.set(roomId, room);
      return { roomId, seat: result.seat, state: view(room) };
    },

    leave(roomId: string, seat: Seat): { state: BasePublicState } | null {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return null;
      const { room } = found;

      room.state = removePlayer(room.game, room.state, seat, random);
      if (room.state.activePlayers.length === 0) {
        rooms.delete(roomId);
        return null;
      }
      resolveUndoVote(room);
      return { state: view(room) };
    },

    move(roomId: string, seat: Seat, move: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;

      const result = applyMove(room.game, room.state, seat, move);
      if ('error' in result) return result;

      room.history.push(room.state);
      room.state = result.state;
      return { state: view(room) };
    },

    // Not turn-bound and never pushed to `history`, so an undo skips over it
    action(roomId: string, seat: Seat, action: unknown): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      if (!room.game.applyAction) return { error: 'This game has no actions' };

      const result = room.game.applyAction(room.state, seat, action, random);
      if ('error' in result) return result;

      room.state = result.state;
      return { state: view(room) };
    },

    requestUndo(roomId: string, seat: Seat): Result<BasePublicState> {
      const found = findPlayer(roomId, seat);
      if ('error' in found) return found;
      const { room } = found;
      const { state } = room;

      if (room.history.length === 0) return { error: 'Nothing to undo' };
      if (state.undoVote) return { error: 'An undo vote is already in progress' };
      if (state.activePlayers.length < 2) return { error: 'Not enough players to vote' };

      room.state = {
        ...state,
        undoVote: { requestedBy: seat, votes: { [seat]: true } },
        gameStatus: `${state.playerNames[seat]} wants to undo the last turn`
      };
      return { state: view(room) };
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
        return { state: view(room) };
      }

      room.state = { ...state, undoVote: { ...vote, votes: { ...vote.votes, [seat]: true } } };
      resolveUndoVote(room);
      return { state: view(room) };
    },

    getState(roomId: string): BasePublicState | undefined {
      const room = rooms.get(roomId);
      return room && view(room);
    }
  };
}
