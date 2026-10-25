// Scrabble rules shared by the browser (score preview) and the server (validation).
// There is no dictionary: any placement that follows the rules below is accepted, and players dispute a word with Undo.
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule, type ChoiceRule, type HouseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type {
  Board,
  BoardTile,
  GameState,
  Move,
  Placement,
  Premium,
  PublicGameState,
  RackTile,
  Result,
  ScoredPlay,
  ScoredWord,
  Seat
} from './types.ts';

export const BOARD_SIZE = 15;
export const CENTER = 7;
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;
export const MAX_SCORELESS_TURNS = 6;
export const BLANK = '?';
export const TURN_MINUTES: ChoiceRule<'off' | 1 | 2 | 3 | 5> = {
  id: 'turnMinutes', label: 'Turn timer', kind: 'choice', standard: 'off',
  choices: [
    { value: 'off', label: 'Off' },
    { value: 1, label: '1 minute' },
    { value: 2, label: '2 minutes' },
    { value: 3, label: '3 minutes' },
    { value: 5, label: '5 minutes' }
  ]
};
export const SCRABBLE_RULES: HouseRule[] = [TURN_MINUTES];
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// The standard English set: how many of each tile, and what each is worth
const TILE_SET: Record<RackTile, { count: number; value: number }> = {
  A: { count: 9, value: 1 }, B: { count: 2, value: 3 }, C: { count: 2, value: 3 }, D: { count: 4, value: 2 },
  E: { count: 12, value: 1 }, F: { count: 2, value: 4 }, G: { count: 3, value: 2 }, H: { count: 2, value: 4 },
  I: { count: 9, value: 1 }, J: { count: 1, value: 8 }, K: { count: 1, value: 5 }, L: { count: 4, value: 1 },
  M: { count: 2, value: 3 }, N: { count: 6, value: 1 }, O: { count: 8, value: 1 }, P: { count: 2, value: 3 },
  Q: { count: 1, value: 10 }, R: { count: 6, value: 1 }, S: { count: 4, value: 1 }, T: { count: 6, value: 1 },
  U: { count: 4, value: 1 }, V: { count: 2, value: 4 }, W: { count: 2, value: 4 }, X: { count: 1, value: 8 },
  Y: { count: 2, value: 4 }, Z: { count: 1, value: 10 }, [BLANK]: { count: 2, value: 0 }
};

// The premium squares: T triple word, D double word (the center star too), t triple letter, d double letter
const PREMIUM_MAP = [
  'T..d...T...d..T',
  '.D...t...t...D.',
  '..D...d.d...D..',
  'd..D...d...D..d',
  '....D.....D....',
  '.t...t...t...t.',
  '..d...d.d...d..',
  'T..d...D...d..T',
  '..d...d.d...d..',
  '.t...t...t...t.',
  '....D.....D....',
  'd..D...d...D..d',
  '..D...d.d...D..',
  '.D...t...t...D.',
  'T..d...T...d..T'
];

const PREMIUMS: Record<string, Premium> = { T: 'TW', D: 'DW', t: 'TL', d: 'DL' };
const LETTER_MULTIPLIER: Record<Premium, number> = { DL: 2, TL: 3, DW: 1, TW: 1 };
const WORD_MULTIPLIER: Record<Premium, number> = { DL: 1, TL: 1, DW: 2, TW: 3 };

export function premiumAt(row: number, col: number): Premium | null {
  return PREMIUMS[PREMIUM_MAP[row]?.[col] ?? '.'] ?? null;
}

// What a rack tile is worth; a blank is worth 0
export function tileValue(tile: RackTile): number {
  return TILE_SET[tile]?.value ?? 0;
}

export function rackValue(rack: RackTile[]): number {
  return rack.reduce((sum, tile) => sum + tileValue(tile), 0);
}

function boardTileValue(tile: BoardTile): number {
  return tile.blank ? 0 : tileValue(tile.letter);
}

// The rack tile a placement uses up
export function rackTileFor(placement: Placement): RackTile {
  return placement.blank ? BLANK : placement.letter;
}

export function fullBag(): RackTile[] {
  return Object.entries(TILE_SET).flatMap(([tile, { count }]) => Array<RackTile>(count).fill(tile));
}

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array<BoardTile | null>(BOARD_SIZE).fill(null));
}

export function isBoardEmpty(board: Board): boolean {
  return board.every(row => row.every(cell => cell === null));
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

// Takes `count` tiles from random places in the bag, or as many as are left
export function drawTiles(bag: RackTile[], count: number, random: Random): { drawn: RackTile[]; bag: RackTile[] } {
  const rest = [...bag];
  const drawn: RackTile[] = [];
  while (drawn.length < count && rest.length > 0) {
    drawn.push(rest.splice(Math.floor(random() * rest.length), 1)[0]);
  }
  return { drawn, bag: rest };
}

// The rack without `tiles`, or null if the rack does not hold all of them
export function removeFromRack(rack: RackTile[], tiles: RackTile[]): RackTile[] | null {
  const rest = [...rack];
  for (const tile of tiles) {
    const index = rest.indexOf(tile);
    if (index < 0) return null;
    rest.splice(index, 1);
  }
  return rest;
}

type Cell = BoardTile & { row: number; col: number; isNew: boolean };

// The full run of tiles through (row, col) along one direction, existing and new together
function wordThrough(cellAt: (row: number, col: number) => Cell | null, row: number, col: number, rowStep: number, colStep: number): Cell[] {
  let r = row;
  let c = col;
  while (cellAt(r - rowStep, c - colStep)) {
    r -= rowStep;
    c -= colStep;
  }
  const cells: Cell[] = [];
  for (let cell = cellAt(r, c); cell; cell = cellAt(r, c)) {
    cells.push(cell);
    r += rowStep;
    c += colStep;
  }
  return cells;
}

// Premium squares count only under the tiles placed this turn
function scoreWord(cells: Cell[]): ScoredWord {
  let sum = 0;
  let multiplier = 1;
  for (const cell of cells) {
    const premium = cell.isNew ? premiumAt(cell.row, cell.col) : null;
    sum += boardTileValue(cell) * (premium ? LETTER_MULTIPLIER[premium] : 1);
    multiplier *= premium ? WORD_MULTIPLIER[premium] : 1;
  }
  return { word: cells.map(cell => cell.letter).join(''), points: sum * multiplier };
}

// Checks where the tiles go (not whose rack they come from) and scores every word they form.
// The browser calls this for the live score preview; the server calls it to validate a play.
export function evaluatePlacement(board: Board, tiles: Placement[]): Result<ScoredPlay> {
  if (tiles.length === 0) return { error: 'Place at least one tile' };
  if (tiles.length > RACK_SIZE) return { error: 'You can place at most 7 tiles' };
  const placed = new Map<string, Placement>();
  for (const tile of tiles) {
    if (!inBounds(tile.row, tile.col) || board[tile.row][tile.col]) return { error: 'Place tiles on empty squares' };
    const key = `${tile.row},${tile.col}`;
    if (placed.has(key)) return { error: 'Place one tile per square' };
    placed.set(key, tile);
  }

  const rows = new Set(tiles.map(tile => tile.row));
  const cols = new Set(tiles.map(tile => tile.col));
  const horizontal = rows.size === 1;
  if (!horizontal && cols.size !== 1) return { error: 'Place your tiles in one row or one column' };

  const cellAt = (row: number, col: number): Cell | null => {
    if (!inBounds(row, col)) return null;
    const existing = board[row][col];
    if (existing) return { ...existing, row, col, isNew: false };
    const tile = placed.get(`${row},${col}`);
    return tile ? { letter: tile.letter, blank: tile.blank === true, row, col, isNew: true } : null;
  };

  // One unbroken line: every square from the first new tile to the last is filled
  const [rowStep, colStep] = horizontal ? [0, 1] : [1, 0];
  const first = tiles.reduce((a, b) => (a.row + a.col <= b.row + b.col ? a : b));
  const main = wordThrough(cellAt, first.row, first.col, rowStep, colStep);
  if (main.filter(cell => cell.isNew).length !== tiles.length) return { error: 'Your tiles must form one unbroken line' };

  if (isBoardEmpty(board)) {
    if (!placed.has(`${CENTER},${CENTER}`)) return { error: 'The first word must cover the center star' };
    if (tiles.length < 2) return { error: 'The first word needs at least two letters' };
  } else {
    const touches = tiles.some(({ row, col }) =>
      [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => cellAt(row + dr, col + dc)?.isNew === false));
    if (!touches) return { error: 'Your word must connect to tiles on the board' };
  }

  const crossWords = tiles.map(tile => wordThrough(cellAt, tile.row, tile.col, colStep, rowStep));
  const words = [main, ...crossWords].filter(cells => cells.length >= 2).map(scoreWord);
  const bingo = tiles.length === RACK_SIZE;
  const points = words.reduce((sum, word) => sum + word.points, 0) + (bingo ? BINGO_BONUS : 0);
  return { state: { words, bingo, points } };
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    board: emptyBoard(),
    racks: {},
    bag: [],
    scores: {},
    scorelessTurns: 0,
    turnStartedAt: null,
    lastMove: null,
    endAdjustments: null
  };
}

// Closest to A ranks lowest, and a blank beats every letter
function drawRank(tile: RackTile): number {
  return tile === BLANK ? -1 : LETTERS.indexOf(tile);
}

function tileName(tile: RackTile): string {
  return tile === BLANK ? 'a blank' : tile;
}

// Each player draws a tile and the one closest to A goes first; tied players draw again.
// Drawn tiles stay out until the order is settled, so the draw always ends.
function drawForFirst(state: GameState, random: Random): { first: Seat; status: string } {
  let bag = fullBag();
  let contenders = state.activePlayers;
  const rounds: string[] = [];
  while (contenders.length > 1 && bag.length >= contenders.length) {
    const draw = drawTiles(bag, contenders.length, random);
    bag = draw.bag;
    rounds.push(contenders.map((seat, index) => `${state.playerNames[seat]} drew ${tileName(draw.drawn[index])}`).join(', '));
    const best = Math.min(...draw.drawn.map(drawRank));
    contenders = contenders.filter((_, index) => drawRank(draw.drawn[index]) === best);
  }
  const first = contenders[0];
  return { first, status: `${rounds.join('; tie, so they draw again: ')}. ${state.playerNames[first]} goes first.` };
}

// Before the first move, the players draw for who goes first, the tiles go back,
// and a full bag is dealt afresh to everyone seated
export function resetLobby(state: GameState, random: Random): GameState {
  const opening = state.activePlayers.length >= 2 ? drawForFirst(state, random) : null;
  let bag = fullBag();
  const racks: Record<Seat, RackTile[]> = {};
  for (const seat of state.activePlayers) {
    const draw = drawTiles(bag, RACK_SIZE, random);
    racks[seat] = draw.drawn;
    bag = draw.bag;
  }
  return {
    ...state,
    board: emptyBoard(),
    racks,
    bag,
    scores: Object.fromEntries(state.activePlayers.map(seat => [seat, 0])),
    scorelessTurns: 0,
    lastMove: null,
    endAdjustments: null,
    turnStartedAt: null,
    currentPlayer: opening ? opening.first : state.currentPlayer,
    gameStatus: opening ? `${state.gameStatus}. ${opening.status}` : state.gameStatus
  };
}

// A player who leaves mid-game puts their tiles back in the bag; their score stays on the board
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const { [seat]: rack = [], ...racks } = state.racks;
  return { ...state, racks, bag: [...state.bag, ...rack] };
}

// Each player sees only their own rack; the history (viewer null) sees none
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { racks, bag, ...view } = state;
  return {
    ...view,
    undoAvailable,
    rack: viewHand(racks, viewer),
    rackCounts: handCounts(racks),
    bagCount: bag.length
  };
}

function isLetter(value: unknown): value is string {
  return typeof value === 'string' && LETTERS.includes(value);
}

function isRackTile(value: unknown): value is RackTile {
  return value === BLANK || isLetter(value);
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < BOARD_SIZE;
}

function parsePlacement(value: unknown): Placement | null {
  const input = asRecord(value);
  if (!input || !isIndex(input.row) || !isIndex(input.col) || !isLetter(input.letter)) return null;
  if (input.blank !== undefined && typeof input.blank !== 'boolean') return null;
  return { row: input.row, col: input.col, letter: input.letter, blank: input.blank === true };
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  if (input?.type === 'pass') return { type: 'pass' };
  if (input?.type === 'exchange') {
    const letters = input.letters;
    if (!Array.isArray(letters) || letters.length === 0 || letters.length > RACK_SIZE || !letters.every(isRackTile)) return null;
    return { type: 'exchange', letters };
  }
  if (input?.type === 'play' && Array.isArray(input.tiles) && input.tiles.length <= RACK_SIZE) {
    const tiles = input.tiles.map(parsePlacement);
    return tiles.every(tile => tile !== null) ? { type: 'play', tiles } : null;
  }
  return null;
}

function winnerStatus(state: GameState, winners: Seat[], scores: Record<Seat, number>): string {
  const names = winners.map(seat => state.playerNames[seat]);
  const points = scores[winners[0]];
  return winners.length === 1
    ? `${names[0]} wins with ${points} points!`
    : `${names.join(' and ')} share the win with ${points} points!`;
}

// Each player still in the game loses what is left on their rack. A player who went out gains everyone else's.
function endGame(state: GameState, wentOut: Seat | null): GameState {
  const seats = state.activePlayers;
  const endAdjustments: Record<Seat, number> = {};
  for (const seat of seats) endAdjustments[seat] = -rackValue(state.racks[seat] ?? []);
  if (wentOut !== null) {
    endAdjustments[wentOut] = seats.reduce((sum, seat) => sum - (seat === wentOut ? 0 : endAdjustments[seat]), 0);
  }
  const scores = { ...state.scores };
  for (const seat of seats) scores[seat] = (scores[seat] ?? 0) + endAdjustments[seat];

  const top = Math.max(...seats.map(seat => scores[seat]));
  const winners = seats.filter(seat => scores[seat] === top);
  return {
    ...state,
    scores,
    endAdjustments,
    isGameOver: true,
    currentPlayer: null,
    winners,
    gameStatus: winnerStatus(state, winners, scores)
  };
}

export function canEndGame(state: Pick<GameState, 'scorelessTurns' | 'isGameOver'>): boolean {
  return !state.isGameOver && state.scorelessTurns >= MAX_SCORELESS_TURNS;
}

// Passes the turn on. After six scoreless turns in a row play goes on until a player chooses to end the game.
function finishTurn(state: GameState, seat: Seat, scored: boolean): GameState {
  const next = { ...state, scorelessTurns: scored ? 0 : state.scorelessTurns + 1, currentPlayer: nextActivePlayer(state, seat) };
  if (!canEndGame(next)) return next;
  return { ...next, gameStatus: `${next.gameStatus}. ${next.scorelessTurns} scoreless turns in a row: any player may end the game.` };
}

// Any player may end the game once six scoreless turns in a row have been played
export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  if (asRecord(action)?.type !== 'endGame') return { error: 'Unknown action' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (!canEndGame(state)) return { error: `The game can end only after ${MAX_SCORELESS_TURNS} scoreless turns in a row` };
  const ended = endGame(state, null);
  return { state: { ...ended, gameStatus: `${state.playerNames[seat]} ended the game. ${ended.gameStatus}` } };
}

function play(state: GameState, seat: Seat, tiles: Placement[], random: Random): Result<GameState> {
  const rest = removeFromRack(state.racks[seat] ?? [], tiles.map(rackTileFor));
  if (!rest) return { error: 'You do not have those tiles' };
  const result = evaluatePlacement(state.board, tiles);
  if ('error' in result) return result;
  const scored = result.state;

  const board = state.board.map(row => [...row]);
  for (const tile of tiles) board[tile.row][tile.col] = { letter: tile.letter, blank: tile.blank === true };
  const draw = drawTiles(state.bag, RACK_SIZE - rest.length, random);
  const rack = [...rest, ...draw.drawn];
  const name = state.playerNames[seat];

  const next: GameState = {
    ...state,
    board,
    bag: draw.bag,
    racks: { ...state.racks, [seat]: rack },
    scores: { ...state.scores, [seat]: (state.scores[seat] ?? 0) + scored.points },
    lastMove: { type: 'play', playerNumber: seat, tiles, ...scored },
    gameStatus: `${name} played ${scored.words[0]?.word ?? ''} for ${scored.points} points${scored.bingo ? ' (bingo!)' : ''}`
  };
  if (rack.length === 0) return { state: endGame(next, seat) };
  return { state: finishTurn(next, seat, scored.points > 0) };
}

function exchange(state: GameState, seat: Seat, letters: RackTile[], random: Random): Result<GameState> {
  if (state.bag.length < RACK_SIZE) return { error: 'You can exchange only while the bag has at least 7 tiles' };
  const rest = removeFromRack(state.racks[seat] ?? [], letters);
  if (!rest) return { error: 'You do not have those tiles' };
  // The new tiles are drawn before the old ones go back, so nobody draws back what they gave up
  const draw = drawTiles(state.bag, letters.length, random);
  const next: GameState = {
    ...state,
    bag: [...draw.bag, ...letters],
    racks: { ...state.racks, [seat]: [...rest, ...draw.drawn] },
    lastMove: { type: 'exchange', playerNumber: seat, count: letters.length },
    gameStatus: `${state.playerNames[seat]} exchanged ${letters.length} ${letters.length === 1 ? 'tile' : 'tiles'}`
  };
  return { state: finishTurn(next, seat, false) };
}

const MINUTE_MS = 60_000;

// The turn timer starts afresh for whoever is to move, and stops when the game is over or the timer is off
function startTurn(state: GameState, now: number): GameState {
  const running = houseRule(state, TURN_MINUTES) !== 'off' && !state.isGameOver;
  return { ...state, turnStartedAt: running ? now : null };
}

// Everyone has agreed, an undo was approved, or the server restarted: the current turn gets its full time from `now`
export function resumeClock(state: GameState, now: number): GameState {
  return state.isGameOver ? state : startTurn(state, now);
}

// When the player to move runs out of time, in server ms
export function deadline(state: Pick<GameState, 'houseRules' | 'turnStartedAt' | 'isGameOver' | 'currentPlayer'>): number | null {
  const minutes = houseRule(state, TURN_MINUTES);
  if (minutes === 'off' || (state.turnStartedAt ?? null) === null || state.isGameOver || state.currentPlayer === null) return null;
  return (state.turnStartedAt as number) + minutes * MINUTE_MS;
}

// Tiles placed but not played are only in the browser, so the turn simply passes, as a scoreless turn
function timeOut(state: GameState, seat: Seat, now: number): GameState {
  const passed: GameState = {
    ...state,
    lastMove: { type: 'pass', playerNumber: seat, timedOut: true },
    gameStatus: `${state.playerNames[seat]} ran out of time`
  };
  return startTurn(finishTurn(passed, seat, false), now);
}

export function onDeadline(state: GameState, now: number): GameState {
  return timeOut(state, state.currentPlayer as Seat, now);
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random, now: number): Result<GameState> {
  const limit = deadline(state);
  if (limit !== null && now >= limit) return { state: timeOut(state, seat, now) }; // the move came too late
  const result = playMove(state, seat, move, random);
  return 'error' in result ? result : { state: startTurn(result.state, now) };
}

function playMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (parsed.type === 'play') return play(state, seat, parsed.tiles, random);
  if (parsed.type === 'exchange') return exchange(state, seat, parsed.letters, random);
  const passed: GameState = {
    ...state,
    lastMove: { type: 'pass', playerNumber: seat },
    gameStatus: `${state.playerNames[seat]} passed`
  };
  return { state: finishTurn(passed, seat, false) };
}
