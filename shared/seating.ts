import type { GameDefinition } from './gameDefinition.ts';
import type { BaseGameState, BasePublicState, Random, Result, Seat } from './types.ts';

export function baseGameState(gameId: string): BaseGameState {
  return {
    gameId,
    started: false,
    currentPlayer: null,
    activePlayers: [],
    playerNames: {},
    gameStatus: '',
    isGameOver: false,
    winners: [],
    undoVote: null
  };
}

export function nextActivePlayer(state: Pick<BaseGameState, 'activePlayers'>, fromSeat: Seat): Seat | null {
  return state.activePlayers.find(seat => seat > fromSeat) ?? state.activePlayers[0] ?? null;
}

function without(names: Record<Seat, string>, seat: Seat): Record<Seat, string> {
  const rest = { ...names };
  delete rest[seat];
  return rest;
}

export function addPlayer<S extends BaseGameState>(
  game: GameDefinition<S, BasePublicState>,
  state: S,
  name: string,
  random: Random = Math.random
): { state: S; seat: Seat } | { error: string } {
  const { maxPlayers } = game.info;
  if (state.started) return { error: 'Game already in progress' };
  if (state.activePlayers.length >= maxPlayers) return { error: 'Game is full' };

  let seat = 1;
  while (state.activePlayers.includes(seat)) seat++;
  const activePlayers = [...state.activePlayers, seat].sort((a, b) => a - b);
  const next = game.resetLobby({
    ...state,
    activePlayers,
    playerNames: { ...state.playerNames, [seat]: name },
    gameStatus: `${name} joined (${activePlayers.length}/${maxPlayers} players)`,
    currentPlayer: activePlayers[0]
  }, random);
  return { state: next, seat };
}

export function removePlayer<S extends BaseGameState>(
  game: GameDefinition<S, BasePublicState>,
  state: S,
  seat: Seat,
  random: Random = Math.random
): S {
  const name = state.playerNames[seat];
  const activePlayers = state.activePlayers.filter(s => s !== seat);

  if (!state.started) {
    return game.resetLobby({
      ...state,
      activePlayers,
      playerNames: without(state.playerNames, seat),
      gameStatus: `${name} left`,
      currentPlayer: activePlayers[0] ?? null
    }, random);
  }

  // Mid-game: the game stays and the seat is skipped from now on
  const next: S = { ...state, activePlayers, gameStatus: `${name} left the game` };
  if (state.isGameOver) return activePlayers.length < 2 ? { ...next, undoVote: null } : next;

  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    return {
      ...next,
      isGameOver: true,
      currentPlayer: null,
      winners: [winner],
      undoVote: null,
      gameStatus: `${state.playerNames[winner]} wins! Everyone else left.`
    };
  }

  if (state.currentPlayer === seat) {
    next.currentPlayer = nextActivePlayer(next, seat);
  }
  return game.onPlayerLeft ? game.onPlayerLeft(next, seat, random) : next;
}

export function applyMove<S extends BaseGameState>(
  game: GameDefinition<S, BasePublicState>,
  state: S,
  seat: Seat,
  move: unknown
): Result<S> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.activePlayers.length < game.info.minPlayers) return { error: 'Waiting for more players' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.currentPlayer !== seat) return { error: 'Not your turn' };

  const result = game.applyMove(state, seat, move);
  if ('error' in result) return result;
  return { state: { ...result.state, started: true } };
}
