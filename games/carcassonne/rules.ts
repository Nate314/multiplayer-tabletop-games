// Carcassonne rules: the game's hooks for the platform, reading untrusted moves, and the public view.
// A turn is two moves: place the drawn tile, then place a meeple on it or none. Scoring follows the second move,
// so a half-finished turn (the tile down, the meeple not yet chosen) lives in the state and survives a refresh.
// Placement and features live in board.ts, the scores in scoring.ts and the tiles in tiles.ts.
import { pointsText, rankStandings } from '../../shared/standings.ts';
import type { Standing } from '../../shared/types.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { analyze, canPlace, meeplesOnBoard, placementError, tileFeatures } from './board.ts';
import { scoreCompleted, scoreFinal } from './scoring.ts';
import { MEEPLES_PER_PLAYER, START_TILE, drawTiles, tileName } from './tiles.ts';
import type { FeatureKind, FeatureRef, GameState, Move, Placement, PublicGameState, Random, Result, Seat, TileType } from './types.ts';

const START: Placement = { x: 0, y: 0, tile: START_TILE, rotation: 0, by: null, meeple: null };
const MAX_COORDINATE = 100; // 72 tiles never reach this far from the start tile

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    board: [START],
    drawPile: [],
    currentTile: null,
    placed: false,
    scores: {},
    discarded: [],
    finalScores: null,
    finalEvents: [],
    lastMove: null
  };
}

const nameOf = (state: GameState, seat: Seat) => state.playerNames[seat] ?? `Player ${seat}`;

function names(state: GameState, seats: Seat[]): string {
  return seats.map(seat => nameOf(state, seat)).join(' and ');
}

// Draws the next tile that fits somewhere. A tile that fits nowhere leaves the game, as the official rules say.
function drawNext(board: Placement[], pile: TileType[]): { tile: TileType | null; pile: TileType[]; discarded: TileType[] } {
  const rest = [...pile];
  const discarded: TileType[] = [];
  while (rest.length > 0) {
    const tile = rest.pop()!;
    if (canPlace(board, tile)) return { tile, pile: rest, discarded };
    discarded.push(tile);
  }
  return { tile: null, pile: rest, discarded };
}

// Before the first move: the start tile alone on the board, the other 71 shuffled, and the first tile drawn.
// The youngest player starts in the rules; here the first seat does.
export function resetLobby(state: GameState, random: Random): GameState {
  const seats = state.activePlayers;
  const pile = shuffle(drawTiles(), random);
  const drawn = seats.length < 2 ? { tile: null, pile, discarded: [] } : drawNext([START], pile);
  return {
    ...state,
    board: [START],
    drawPile: drawn.pile,
    currentTile: drawn.tile,
    placed: false,
    scores: Object.fromEntries(seats.map(seat => [seat, 0])),
    discarded: drawn.discarded,
    finalScores: null,
    finalEvents: [],
    lastMove: null
  };
}

// Everyone sees the board, the scores and the tile being placed; nobody sees the order of the tiles still to come
export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  const { drawPile, ...view } = state;
  return { ...view, undoAvailable, tilesLeft: drawPile.length };
}

const KINDS: FeatureKind[] = ['city', 'road', 'field', 'monastery'];

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= MAX_COORDINATE;
}

function parseFeature(value: unknown): FeatureRef | null | undefined {
  if (value === null) return null;
  const input = asRecord(value);
  const kind = KINDS.find(candidate => candidate === input?.kind);
  const index = input?.index;
  if (!kind || typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 3) return undefined;
  return { kind, index };
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  if (input?.type === 'place') {
    const { x, y, rotation } = input;
    if (!isCoordinate(x) || !isCoordinate(y) || typeof rotation !== 'number' || ![0, 1, 2, 3].includes(rotation)) return null;
    return { type: 'place', x, y, rotation };
  }
  if (input?.type === 'meeple') {
    const feature = parseFeature(input.feature);
    return feature === undefined ? null : { type: 'meeple', feature };
  }
  return null;
}

function place(state: GameState, seat: Seat, x: number, y: number, rotation: number): Result<GameState> {
  const tile = state.currentTile;
  if (tile === null) return { error: 'There is no tile to place' };
  if (state.placed) return { error: 'Your tile is placed: choose a meeple or none' };
  const error = placementError(state.board, tile, x, y, rotation);
  if (error) return { error };
  return {
    state: {
      ...state,
      board: [...state.board, { x, y, tile, rotation, by: seat, meeple: null }],
      placed: true,
      lastMove: { type: 'place', playerNumber: seat, tile, x, y, rotation },
      gameStatus: `${nameOf(state, seat)} placed ${tileName(tile)}`
    }
  };
}

// Why a meeple cannot stand on this feature of the tile just placed, or null when it can
export function meepleError(state: Pick<GameState, 'board' | 'placed'>, seat: Seat, feature: FeatureRef): string | null {
  if (!state.placed) return 'Place your tile first';
  const tile = state.board.length - 1;
  const { tile: type } = state.board[tile];
  if (!tileFeatures(type).some(ref => ref.kind === feature.kind && ref.index === feature.index)) return 'That tile has no such feature';
  if (meeplesOnBoard(state.board, seat) >= MEEPLES_PER_PLAYER) return 'All your meeples are on the board';
  const connected = analyze(state.board).of(tile, feature);
  if (connected && connected.meeples.length > 0) return 'That feature already has a meeple on it';
  return null;
}

const KIND_NAMES: Record<FeatureKind, string> = { city: 'city', road: 'road', field: 'field', monastery: 'monastery' };

function scoredText(state: GameState, events: ReturnType<typeof scoreCompleted>['events']): string[] {
  return events.map(({ kind, points, seats }) => seats.length === 0
    ? `A ${KIND_NAMES[kind]} was completed`
    : `${names(state, seats)} ${seats.length > 1 ? 'each score' : 'scores'} ${points} for a ${KIND_NAMES[kind]}`);
}

// The end of the game: the remaining features score, and the highest total wins (ties share)
function endGame(state: GameState): GameState {
  const players = state.activePlayers;
  const { scores, events, final } = scoreFinal(state.board, state.scores, players);
  const best = Math.max(...players.map(seat => scores[seat] ?? 0));
  const winners = players.filter(seat => (scores[seat] ?? 0) === best);
  return {
    ...state,
    scores,
    finalScores: final,
    finalEvents: events,
    isGameOver: true,
    winners,
    currentTile: null,
    currentPlayer: null,
    gameStatus: `${state.gameStatus}. The last tile is placed. ${names(state, winners)} ${winners.length > 1 ? 'share the win' : 'wins'} with ${best} points`
  };
}

// Completed features score, then the next tile is drawn for `next`, or the game ends when none is left
function finishTurn(state: GameState, mover: Seat, feature: FeatureRef | null, next: Seat | null): GameState {
  const tile = state.board.length - 1;
  const scored = scoreCompleted(state.board, state.scores, tile, state.activePlayers);
  const drawn = drawNext(scored.board, state.drawPile);
  const parts = [state.gameStatus, ...scoredText(state, scored.events)];
  if (drawn.discarded.length > 0) parts.push(`${drawn.discarded.length === 1 ? 'A tile' : `${drawn.discarded.length} tiles`} fit nowhere and left the game`);
  const after: GameState = {
    ...state,
    board: scored.board,
    scores: scored.scores,
    drawPile: drawn.pile,
    currentTile: drawn.tile,
    placed: false,
    discarded: [...state.discarded, ...drawn.discarded],
    currentPlayer: next,
    lastMove: { type: 'meeple', playerNumber: mover, feature, scored: scored.events, discarded: drawn.discarded },
    gameStatus: parts.join('. ')
  };
  return drawn.tile === null ? endGame(after) : after;
}

function placeMeeple(state: GameState, seat: Seat, feature: FeatureRef | null): Result<GameState> {
  if (!state.placed) return { error: 'Place your tile first' };
  let next = state;
  if (feature !== null) {
    const error = meepleError(state, seat, feature);
    if (error) return { error };
    const tile = state.board.length - 1;
    next = {
      ...state,
      board: state.board.map((placement, index) => (index === tile ? { ...placement, meeple: { seat, feature } } : placement)),
      gameStatus: `${state.gameStatus} and a meeple on its ${KIND_NAMES[feature.kind]}`
    };
  }
  return { state: finishTurn(next, seat, feature, nextActivePlayer(state, seat)) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  return parsed.type === 'place'
    ? place(state, seat, parsed.x, parsed.y, parsed.rotation)
    : placeMeeple(state, seat, parsed.feature);
}

// A dismissed player's meeples stay on the board but count for nobody, and they score nothing more.
// If they had placed their tile and not yet chosen a meeple, the turn ends as if they placed none; if they had not
// placed it, the next player places the same tile. The platform has already moved the turn on.
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const leaving = state.board[state.board.length - 1];
  if (!state.placed || leaving.by !== seat) return state;
  return finishTurn({ ...state, gameStatus: `${nameOf(state, seat)} left before choosing a meeple` }, seat, null, state.currentPlayer);
}

export function finalStandings(state: GameState): Standing[] {
  const points = (seat: Seat) => state.scores[seat] ?? 0;
  return rankStandings(state, (a, b) => points(b) - points(a), seat => pointsText(points(seat)));
}
