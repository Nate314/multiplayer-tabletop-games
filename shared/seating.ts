import type { GameDefinition } from './gameDefinition.ts';
import { afterSeatChange, minimumToStart, tableLimit } from './houseRules.ts';
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
    undoVote: null,
    disconnected: [],
    dismissVote: null
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

export function connectedPlayers(state: Pick<BaseGameState, 'activePlayers' | 'disconnected'>): Seat[] {
  return state.activePlayers.filter(seat => !state.disconnected.includes(seat));
}

// Matches every name in playerNames, so dismissed players are found too
export function findSeatByName(state: BaseGameState, name: string): Seat | undefined {
  const wanted = name.trim().toLowerCase();
  const found = Object.entries(state.playerNames).find(([, existing]) => existing.trim().toLowerCase() === wanted);
  return found ? Number(found[0]) : undefined;
}

export function addPlayer<S extends BaseGameState>(
  game: GameDefinition<S, BasePublicState>,
  state: S,
  name: string,
  random: Random = Math.random
): { state: S; seat: Seat } | { error: string } {
  const limit = tableLimit(game.info, state);
  if (state.started) return { error: 'Game already in progress' };
  if (state.activePlayers.length >= limit) return { error: 'Game is full' };

  let seat = 1;
  while (state.activePlayers.includes(seat)) seat++;
  const activePlayers = [...state.activePlayers, seat].sort((a, b) => a - b);
  const next = game.resetLobby({
    ...state,
    activePlayers,
    playerNames: { ...state.playerNames, [seat]: name },
    gameStatus: `${name} joined (${activePlayers.length}/${limit} players)`,
    currentPlayer: activePlayers[0],
    houseRules: afterSeatChange(game.info, state.houseRules, activePlayers)
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
      currentPlayer: activePlayers[0] ?? null,
      houseRules: afterSeatChange(game.info, state.houseRules, activePlayers)
    }, random);
  }

  // Mid-game: the game stays and the seat is skipped from now on.
  // Only a dismissal reaches here (a mid-game disconnect holds the seat), so any dismiss vote is settled.
  const next: S = {
    ...state,
    activePlayers,
    disconnected: state.disconnected.filter(s => s !== seat),
    dismissVote: null,
    gameStatus: `${name} was dismissed`
  };
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

// Before the first move the seat is freed; after it the seat is held for a rejoin
export function disconnectPlayer<S extends BaseGameState>(
  game: GameDefinition<S, BasePublicState>,
  state: S,
  seat: Seat,
  random: Random = Math.random
): S {
  if (!state.started) return removePlayer(game, state, seat, random);
  if (!state.activePlayers.includes(seat) || state.disconnected.includes(seat)) return state;

  let next: S = {
    ...state,
    disconnected: [...state.disconnected, seat].sort((a, b) => a - b),
    gameStatus: `${state.playerNames[seat]} disconnected`
  };
  if (next.undoVote?.requestedBy === seat) next = { ...next, undoVote: null };
  if (next.dismissVote) next = resolveDismissVote(game, next, random);
  const stillHeld = next.disconnected.includes(seat);
  return stillHeld && !next.isGameOver && game.onPlayerDisconnected
    ? game.onPlayerDisconnected(next, seat, random)
    : next;
}

export function reconnectPlayer<S extends BaseGameState>(state: S, seat: Seat): S {
  if (!state.disconnected.includes(seat)) return state;
  return {
    ...state,
    disconnected: state.disconnected.filter(s => s !== seat),
    dismissVote: state.dismissVote?.target === seat ? null : state.dismissVote,
    gameStatus: `${state.playerNames[seat]} is back`
  };
}

// Dismisses the target once every connected player has approved
export function resolveDismissVote<S extends BaseGameState>(
  game: GameDefinition<S, BasePublicState>,
  state: S,
  random: Random = Math.random
): S {
  const vote = state.dismissVote;
  if (!vote) return state;
  const voters = connectedPlayers(state);
  if (voters.length === 0 || !voters.every(seat => vote.votes[seat] === true)) return state;
  return removePlayer(game, { ...state, dismissVote: null }, vote.target, random);
}

export function applyMove<S extends BaseGameState>(
  game: GameDefinition<S, BasePublicState>,
  state: S,
  seat: Seat,
  move: unknown,
  random: Random = Math.random
): Result<S> {
  if (state.isGameOver) return { error: 'The game is over' };
  // Only the start needs the minimum: a game that loses players to dismissals plays on, or ends itself in onPlayerLeft
  if (!state.started && state.activePlayers.length < minimumToStart(game.info, state)) return { error: 'Waiting for more players' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  if (state.currentPlayer !== seat && !game.allowsOutOfTurn?.(state, seat, move)) return { error: 'Not your turn' };

  const result = game.applyMove(state, seat, move, random);
  if ('error' in result) return result;
  return { state: { ...result.state, started: true } };
}
