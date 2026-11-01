// Naval Battle rules shared by the browser and the server. A fleet stays in the raw state until the game is over.
import { applyEndingAction, drawOfferAnswerers, endGame, lapseDrawOffer } from '../../shared/drawOffer.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { FLEET, GRID_SIZE, cellName, fleetError, shipAt, shipCells, shotsText } from './fleet.ts';
import { SALVO } from './options.ts';
import type { Cell, GameState, PublicGameState, Result, Seat, Ship, Shot } from './types.ts';

// Seating changes start the setup over: no fleet is kept
export function resetLobby(state: GameState): GameState {
  return {
    ...state,
    phase: 'placing',
    fleets: {},
    shots: { 1: [], 2: [] },
    drawOffer: null,
    lastMove: null,
    gameStatus: 'Place your fleets'
  };
}

export function createGameState(gameId: string): GameState {
  return resetLobby({ ...baseGameState(gameId), phase: 'placing', fleets: {}, shots: { 1: [], 2: [] }, drawOffer: null, lastMove: null });
}

const opponentOf = (seat: Seat): Seat => (seat === 1 ? 2 : 1);

// One shot per turn, or with Salvo one per ship still afloat (the opponent's sinking shots count them), never more than the squares left
export function shotsAllowed(state: Pick<GameState, 'shots' | 'houseRules'>, seat: Seat): number {
  if (!houseRule(state, SALVO)) return 1;
  const sunk = state.shots[opponentOf(seat)].filter(shot => shot.result === 'sunk').length;
  return Math.min(FLEET.length - sunk, GRID_SIZE ** 2 - state.shots[seat].length);
}

export function waitingOn(state: GameState): Seat[] {
  if (state.isGameOver) return [];
  return state.phase === 'placing' ? state.activePlayers.filter(seat => !state.fleets[seat]) : drawOfferAnswerers(state);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { fleets, ...rest } = state;
  return {
    ...rest,
    undoAvailable,
    ready: state.activePlayers.filter(seat => fleets[seat]),
    myFleet: viewer === null ? null : fleets[viewer] ?? null,
    revealed: state.isGameOver ? { ...fleets } : {}
  };
}

function place(state: GameState, seat: Seat, action: Record<string, unknown>): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote || state.dismissVote) return { error: 'A vote is in progress' };
  if (state.activePlayers.length < 2) return { error: 'Waiting for another player' };
  if (state.fleets[seat]) return { error: 'Your fleet is already placed' };
  const error = fleetError(action.ships);
  if (error) return { error };
  const fleets = { ...state.fleets, [seat]: action.ships as Ship[] };
  const next: GameState = { ...state, started: true, fleets, gameStatus: `${state.playerNames[seat]} is ready` };
  if (!state.activePlayers.every(other => fleets[other])) return { state: next };
  const first = state.activePlayers[0];
  return {
    state: { ...next, phase: 'firing', currentPlayer: first, gameStatus: `Both fleets are ready. ${state.playerNames[first]} fires first` }
  };
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const input = asRecord(action);
  return input?.type === 'place' ? place(state, seat, input) : applyEndingAction(state, seat, action);
}

const isOnGrid = (cell: Cell) => Number.isInteger(cell.row) && Number.isInteger(cell.col)
  && cell.row >= 0 && cell.row < GRID_SIZE && cell.col >= 0 && cell.col < GRID_SIZE;

const countRefusal = (n: number) => (n === 1 ? 'Fire at 1 square' : `Fire at ${n} different squares`);

// The targets as cells, or why they cannot be fired at
function asTargets(state: GameState, seat: Seat, value: unknown): Cell[] | string {
  const wanted = shotsAllowed(state, seat);
  if (!Array.isArray(value) || value.length !== wanted) return countRefusal(wanted);
  const targets = value.map(item => ({ row: asRecord(item)?.row as number, col: asRecord(item)?.col as number }));
  if (!targets.every(isOnGrid)) return 'That square is off the grid';
  const fired = new Set(state.shots[seat].map(cellName));
  if (targets.some(target => fired.has(cellName(target)))) return 'You already fired there';
  if (new Set(targets.map(cellName)).size !== wanted) return countRefusal(wanted);
  return targets;
}

// The answer to one shot, given the shots already fired at the fleet
function answer(fleet: Ship[], earlier: Shot[], target: Cell): Shot {
  const index = shipAt(fleet, target);
  if (index === -1) return { ...target, result: 'miss' };
  const hit = new Set([...earlier, target].map(cellName));
  const ship = fleet[index];
  return shipCells(ship).every(c => hit.has(cellName(c)))
    ? { ...target, result: 'sunk', sunkLength: ship.length }
    : { ...target, result: 'hit' };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'fire') return { error: 'Unknown move' };
  if (state.phase !== 'firing') return { error: 'Wait for both fleets to be placed' };
  const targets = asTargets(state, seat, input.targets);
  if (typeof targets === 'string') return { error: targets };

  const fleet = state.fleets[opponentOf(seat)] as Ship[];
  const fired: Shot[] = [];
  for (const target of targets) fired.push(answer(fleet, [...state.shots[seat], ...fired], target));
  const name = state.playerNames[seat];
  const next: GameState = lapseDrawOffer({
    ...state,
    shots: { ...state.shots, [seat]: [...state.shots[seat], ...fired] },
    lastMove: { type: 'fire', playerNumber: seat, shots: fired },
    gameStatus: `${name} fired at ${shotsText(fired)}`
  }, seat);

  const sunk = next.shots[seat].filter(shot => shot.result === 'sunk').length;
  if (sunk === FLEET.length) return { state: endGame(next, [seat], `${name} sank every ship. ${name} wins!`) };
  return { state: { ...next, currentPlayer: nextActivePlayer(next, seat) } };
}
