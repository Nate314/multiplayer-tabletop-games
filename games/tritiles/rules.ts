// Tri-Tiles rules shared by the browser (playable tiles) and the server (validation)
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, awaiting, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random, Standing } from '../../shared/types.ts';
import { cellKey, fits, openPlacements, rotations } from './grid.ts';
import type { Board, Cell } from './grid.ts';
import { DRAW_PENALTY, MAX_DRAWS, STUCK_PENALTY, openingScore, playScore, roundEndScores } from './scoring.ts';
import { BRIDGE_RULE, HEXAGON_RULE, TARGET_RULE } from './options.ts';
import { TILES, isTriple, tileSum } from './tiles.ts';
import type { GameState, LastMove, Move, PublicGameState, Result, RoundSummary, Seat } from './types.ts';

type Corners = [number, number, number];

export const HAND_SIZES: Record<number, number> = { 2: 9, 3: 7, 4: 7, 5: 6, 6: 6 };

// Every way a tile in `hand` can be laid on `board`, each fitting rotation once
export function legalPlays(board: Board, hand: number[]): Move[] {
  return hand.flatMap(tile => openPlacements(board, tile).map(({ cell, corners }): Move => ({ type: 'play', tile, cell, corners })));
}

// What a player with nothing that fits must do; null when a tile fits
export function stuckMove(board: Board, hand: number[], poolCount: number, drawsThisTurn: number): 'draw' | 'pass' | null {
  if (legalPlays(board, hand).length > 0) return null;
  return poolCount > 0 && drawsThisTurn < MAX_DRAWS ? 'draw' : 'pass';
}

// The tile that opens a round: the highest triple (5-5-5 first), else the highest sum. A tile's index breaks a tie in sum
export function openingTile(hands: Record<Seat, number[]>): { seat: Seat; tile: number } {
  const worth = (tile: number) => (isTriple(tile) ? 10000 : 0) + tileSum(tile) * 100 + tile;
  const held = Object.entries(hands).flatMap(([seat, hand]) => hand.map(tile => ({ seat: Number(seat), tile })));
  return held.reduce((best, next) => (worth(next.tile) > worth(best.tile) ? next : best));
}

// The tiles `seat` may play now: only the lead tile while the board is empty
function playable(state: GameState, seat: Seat): number[] {
  const hand = state.hands[seat] ?? [];
  return state.board.length === 0 && state.leadTile !== null ? hand.filter(tile => tile === state.leadTile) : hand;
}

const canMove = (state: GameState, seat: Seat) => legalPlays(state.board, playable(state, seat)).length > 0;

const isBlocked = (state: GameState) =>
  state.pool.length === 0 && state.board.length > 0 && !state.activePlayers.some(seat => canMove(state, seat));

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    roundNumber: 1,
    scores: {},
    hands: {},
    pool: [],
    board: [],
    drawsThisTurn: 0,
    leadTile: null,
    roundSummary: null,
    lastMove: null
  };
}

// Every round opens with the opening rule (see openingTile)
function openRound(state: GameState): GameState {
  const opening = openingTile(state.hands);
  return { ...state, leadTile: opening.tile, currentPlayer: opening.seat };
}

function dealRound(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const deck = shuffle(TILES.map((_, tile) => tile), random);
  const size = HAND_SIZES[players.length];
  const hands = Object.fromEntries(players.map((seat, index) => [seat, deck.slice(index * size, (index + 1) * size)]));
  return openRound({
    ...state, hands, pool: deck.slice(players.length * size), board: [], drawsThisTurn: 0, roundSummary: null, lastMove: null
  });
}

// Before the first move, the tiles are dealt afresh for the current players. Nothing is dealt until two players are seated
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const empty: GameState = {
    ...state,
    roundNumber: 1,
    scores: Object.fromEntries(players.map(seat => [seat, 0])),
    hands: Object.fromEntries(players.map(seat => [seat, []])),
    pool: [],
    board: [],
    drawsThisTurn: 0,
    leadTile: null,
    roundSummary: null,
    lastMove: null
  };
  return players.length < 2 ? empty : dealRound(empty, random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, pool, ...view } = state;
  return { ...view, hand: viewHand(hands, viewer), handCounts: handCounts(hands), poolCount: pool.length, undoAvailable };
}

const isCorners = (value: unknown): value is Corners =>
  Array.isArray(value) && value.length === 3 && value.every(n => Number.isInteger(n));

function parseCell(value: unknown): Cell | null {
  const input = asRecord(value);
  if (!input || !Number.isInteger(input.x) || !Number.isInteger(input.y) || typeof input.up !== 'boolean') return null;
  return { x: input.x as number, y: input.y as number, up: input.up };
}

function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'draw':
    case 'pass':
      return { type: input.type };
    case 'play': {
      const cell = parseCell(input.cell);
      if (!Number.isInteger(input.tile) || !cell || !isCorners(input.corners)) return null;
      return { type: 'play', tile: input.tile as number, cell, corners: [...input.corners] };
    }
    default:
      return null;
  }
}

// How the status line and the history describe a move, e.g. 'Alice played 1-2-3 for 6 points'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'draw': return `${name} drew a tile (-${lastMove.penalty})`;
    case 'pass': return `${name} passed (-${lastMove.penalty})`;
    case 'play':
      return `${name} played ${lastMove.corners.join('-')} for ${pointsText(lastMove.score.points)}${lastMove.wentOut ? ' and went out' : ''}`;
  }
}

const addPoints = (state: GameState, seat: Seat, points: number): GameState =>
  ({ ...state, scores: { ...state.scores, [seat]: (state.scores[seat] ?? 0) + points } });

// The round ends when someone goes out or nobody can play (`wentOut` null). The target is checked only here: if anyone has
// reached it, the highest total wins and equal totals share the win
function endRound(state: GameState, wentOut: Seat | null): GameState {
  const players = state.activePlayers;
  const hands = Object.fromEntries(players.map(seat => [seat, state.hands[seat] ?? []]));
  const points = roundEndScores(hands, wentOut);
  const winner = wentOut ?? players.find(seat => points[seat] > 0) ?? null;
  const scores = { ...state.scores };
  for (const seat of players) scores[seat] = (scores[seat] ?? 0) + points[seat];
  const summary: RoundSummary = {
    roundNumber: state.roundNumber,
    winner,
    blocked: wentOut === null,
    points,
    sumsLeft: Object.fromEntries(players.map(seat => [seat, hands[seat].reduce((sum, tile) => sum + tileSum(tile), 0)])),
    acknowledged: []
  };
  const scored: GameState = { ...state, currentPlayer: null, scores, roundSummary: summary };

  const best = Math.max(...players.map(seat => scores[seat]));
  if (best >= houseRule(state, TARGET_RULE)) {
    const winners = players.filter(seat => scores[seat] === best);
    const names = winners.map(seat => state.playerNames[seat]).join(' and ');
    return { ...scored, isGameOver: true, winners, gameStatus: `${names} ${winners.length > 1 ? 'share the win' : 'wins'} with ${best} points!` };
  }
  if (winner === null) return { ...scored, gameStatus: 'The round is blocked and tied, nobody scores. Waiting for everyone to continue.' };
  const name = state.playerNames[winner];
  const cause = wentOut === null ? `The round is blocked: ${name} has the lowest total and` : `${name} went out and`;
  return { ...scored, gameStatus: `${cause} scores ${points[winner]} points. Waiting for everyone to continue.` };
}

// After a move: the round ends if nobody can play, else the turn moves on (or stays, after a draw)
function settle(state: GameState, seat: Seat, lastMove: LastMove, advance: boolean): GameState {
  if (isBlocked(state)) return { ...endRound(state, null), lastMove };
  return {
    ...state,
    currentPlayer: advance ? nextActivePlayer(state, seat) : state.currentPlayer,
    drawsThisTurn: advance ? 0 : state.drawsThisTurn,
    lastMove,
    gameStatus: describeMove(lastMove, state.playerNames)
  };
}

function play(state: GameState, seat: Seat, tile: number, cell: Cell, corners: Corners): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.includes(tile)) return { error: 'You do not have that tile' };
  const first = state.board.length === 0;
  if (first && state.leadTile !== null && tile !== state.leadTile) {
    return { error: 'Open the round with the highest triple, or the highest sum if nobody holds a triple' };
  }
  if (!rotations(tile).some(rotation => rotation.join() === corners.join())) return { error: 'Those corners are not that tile' };
  // The opening tile goes on the origin cell, where openPlacements offers it
  const placed = first ? cellKey(cell) === cellKey({ x: 0, y: 0, up: true }) : fits(state.board, cell, corners);
  if (!placed) return { error: 'That tile does not fit there' };

  const score = first ? openingScore(tile)
    : playScore(state.board, cell, tile, { hexagon: houseRule(state, HEXAGON_RULE), bridge: houseRule(state, BRIDGE_RULE) });
  const rest = hand.filter(held => held !== tile);
  const next = addPoints({
    ...state, hands: { ...state.hands, [seat]: rest }, board: [...state.board, { tile, cell, corners }], leadTile: null
  }, seat, score.points);
  const lastMove: LastMove = { type: 'play', playerNumber: seat, tile, cell, corners, score, wentOut: rest.length === 0 };
  if (rest.length === 0) return { state: { ...endRound(next, seat), lastMove } };
  return { state: settle(next, seat, lastMove, true) };
}

// Only when nothing fits, at most 3 a turn; each costs 5 and the turn stays with the player
function draw(state: GameState, seat: Seat): Result<GameState> {
  if (canMove(state, seat)) return { error: 'You have a tile that fits' };
  if (state.drawsThisTurn >= MAX_DRAWS) return { error: `You have drawn ${MAX_DRAWS} tiles this turn` };
  if (state.pool.length === 0) return { error: 'You have nothing to draw' };
  const tile = state.pool[state.pool.length - 1];
  const next = addPoints({
    ...state, pool: state.pool.slice(0, -1), hands: { ...state.hands, [seat]: [...state.hands[seat], tile] }, drawsThisTurn: state.drawsThisTurn + 1
  }, seat, -DRAW_PENALTY);
  return { state: settle(next, seat, { type: 'draw', playerNumber: seat, penalty: DRAW_PENALTY }, false) };
}

// Only when nothing fits and drawing is not allowed; costs 10
function pass(state: GameState, seat: Seat): Result<GameState> {
  if (canMove(state, seat)) return { error: 'You have a tile that fits' };
  if (stuckMove(state.board, state.hands[seat], state.pool.length, state.drawsThisTurn) === 'draw') return { error: 'Draw from the pool first' };
  const next = addPoints(state, seat, -STUCK_PENALTY);
  return { state: settle(next, seat, { type: 'pass', playerNumber: seat, penalty: STUCK_PENALTY }, true) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (state.roundSummary) return { error: 'The round is over' };
  if (parsed.type === 'draw') return draw(state, seat);
  if (parsed.type === 'pass') return pass(state, seat);
  return play(state, seat, parsed.tile, parsed.cell, parsed.corners);
}

const ROUND: RoundAccess<GameState, RoundSummary> = {
  get: state => state.roundSummary,
  set: (state, roundSummary) => ({ ...state, roundSummary }),
  noun: 'round'
};

// Deals the next round once every connected player has acknowledged the summary
function startNextRoundIfReady(state: GameState, random: Random): GameState {
  if (!everyoneReady(state, ROUND)) return state;
  const roundNumber = state.roundNumber + 1;
  const next = dealRound({ ...state, roundNumber }, random);
  return { ...next, gameStatus: `Round ${roundNumber}: ${state.playerNames[next.currentPlayer as Seat]} leads` };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  const input = asRecord(action);
  switch (input?.type) {
    case 'acknowledgeRound': return acknowledge(state, seat, ROUND, next => startNextRoundIfReady(next, random));
    default: return { error: 'Unknown action' };
  }
}

// The leaver's tiles go back into the pool. The platform has already moved a held turn on, but the round may now be
// blocked, and the next round may have been waiting only for them.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: hand = [], ...hands } = state.hands;
  const returned: GameState = {
    ...state,
    hands,
    pool: shuffle([...state.pool, ...hand], random),
    // Draws this turn were the leaver's when their draw is the last move; the next player has not drawn
    drawsThisTurn: state.lastMove?.playerNumber === seat ? 0 : state.drawsThisTurn
  };
  if (returned.roundSummary) return startNextRoundIfReady(returned, random);
  // Nobody else can open with a lead tile the leaver held
  if (returned.board.length === 0 && returned.leadTile !== null && hand.includes(returned.leadTile)) return openRound(returned);
  return isBlocked(returned) ? endRound(returned, null) : returned;
}

// The next round may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextRoundIfReady(state, random);
}

// Reshuffles the pool, so an undone draw cannot show which tile comes next
export function onUndo(state: GameState, random: Random): GameState {
  return { ...state, pool: shuffle(state.pool, random) };
}

export function finalStandings(state: GameState): Standing[] {
  const points = (seat: Seat) => state.scores[seat] ?? 0;
  return rankStandings(state, (a, b) => points(b) - points(a), seat => pointsText(points(seat)));
}

export const waitingOn = (state: GameState) => awaiting(state, ROUND);
