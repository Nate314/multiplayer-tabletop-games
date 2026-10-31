// Rummikub rules shared by the browser (group checks and the play preview) and the server (validation).
// A play is the whole table as it should be at the end of the turn; the server works out which rack tiles it adds.
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random, Standing } from '../../shared/types.ts';
import { ADD_ON_FIRST_MELD_RULE, FREE_JOKERS_RULE } from './options.ts';
import type { GameState, LastMove, Move, PublicGameState, Result, RoundResult, Seat, Table, Tile, TileColor } from './types.ts';

export const COLORS: readonly TileColor[] = ['black', 'blue', 'orange', 'red'];
export const MAX_VALUE = 13;
export const TILE_COUNT = 106;
export const JOKERS: readonly number[] = [104, 105];
export const RACK_SIZE = 14;
export const INITIAL_MELD = 30;
export const JOKER_PENALTY = 30;

// Ids 0 to 103 are the numbered tiles, two copies of 1 to 13 in each color; 104 and 105 are the jokers
export function tileOf(id: number): Tile {
  if (id >= JOKERS[0]) return { id, kind: 'joker' };
  const index = id % 52;
  return { id, kind: 'number', color: COLORS[Math.floor(index / MAX_VALUE)], value: (index % MAX_VALUE) + 1 };
}

export function isJoker(id: number): boolean {
  return JOKERS.includes(id);
}

export function tileName(id: number): string {
  const tile = tileOf(id);
  return tile.kind === 'joker' ? 'a joker' : `${tile.color} ${tile.value}`;
}

export function fullPool(): number[] {
  return Array.from({ length: TILE_COUNT }, (_, id) => id);
}

// What a tile left on a rack costs at the end: its number, or 30 for a joker
export function tilePenalty(id: number): number {
  const tile = tileOf(id);
  return tile.kind === 'joker' ? JOKER_PENALTY : tile.value;
}

export function rackTotal(rack: number[]): number {
  return rack.reduce((sum, id) => sum + tilePenalty(id), 0);
}

// A valid group, its tiles in order, the number each place stands for, and the colors a tile there may have
// (one for a run; for a joker in a set, the colors the set is missing)
export type GroupInfo = {
  kind: 'set' | 'run';
  tiles: number[];
  values: number[];
  colors: TileColor[][];
  points: number;
};

type NumberTile = Extract<Tile, { kind: 'number' }>;

function naturals(ids: number[]): NumberTile[] {
  return ids.map(tileOf).filter((tile): tile is NumberTile => tile.kind === 'number');
}

function runInfo(tiles: number[], start: number, color: TileColor): GroupInfo {
  const values = tiles.map((_, index) => start + index);
  return { kind: 'run', tiles, values, colors: tiles.map(() => [color]), points: values.reduce((a, b) => a + b, 0) };
}

// A run as given: every number in its place after the first, one color, inside 1 to 13
function runInOrder(ids: number[]): GroupInfo | null {
  const index = ids.findIndex(id => !isJoker(id));
  const firstTile = tileOf(ids[index]) as NumberTile;
  const start = firstTile.value - index;
  if (start < 1 || start + ids.length - 1 > MAX_VALUE) return null;
  const fits = ids.every((id, place) => {
    const tile = tileOf(id);
    return tile.kind === 'joker' || (tile.color === firstTile.color && tile.value === start + place);
  });
  return fits ? runInfo(ids, start, firstTile.color) : null;
}

// A run given out of order: numbers sorted, jokers filling the gaps, then the top end, then below once 13 is reached
function runSorted(ids: number[]): GroupInfo | null {
  const numbers = naturals(ids).sort((a, b) => a.value - b.value);
  const values = numbers.map(tile => tile.value);
  if (new Set(values).size !== values.length || numbers.some(tile => tile.color !== numbers[0].color)) return null;
  if (values[values.length - 1] - values[0] > ids.length - 1) return null;
  const start = Math.min(values[0], MAX_VALUE - ids.length + 1);
  const jokers = ids.filter(isJoker);
  const tiles = Array.from({ length: ids.length }, (_, place) => numbers.find(tile => tile.value === start + place)?.id ?? jokers.shift()!);
  return runInfo(tiles, start, numbers[0].color);
}

function setInfo(ids: number[]): GroupInfo | null {
  const numbers = naturals(ids);
  const value = numbers[0].value;
  const present = numbers.map(tile => tile.color);
  if (ids.length > COLORS.length || numbers.some(tile => tile.value !== value) || new Set(present).size !== present.length) return null;
  const missing = COLORS.filter(color => !present.includes(color));
  const colors = ids.map(id => {
    const tile = tileOf(id);
    return tile.kind === 'number' ? [tile.color] : missing;
  });
  return { kind: 'set', tiles: ids, values: ids.map(() => value), colors, points: value * ids.length };
}

// Checks one group of tile ids. A run keeps the order it was given when that order works, so a joker
// stands for the number of its place; otherwise its tiles are put in order. A set keeps its order.
// Three tiles that make both a run and a set (a number and two jokers) count as a run.
export function analyzeGroup(ids: number[]): GroupInfo | null {
  if (ids.length < 3 || ids.length > MAX_VALUE || naturals(ids).length === 0) return null;
  return runInOrder(ids) ?? runSorted(ids) ?? setInfo(ids);
}


// Where each joker on the table stands, and in which group
type JokerPlace = { value: number; colors: TileColor[]; group: GroupInfo };

function jokerPlaces(groups: GroupInfo[]): Map<number, JokerPlace> {
  const places = new Map<number, JokerPlace>();
  for (const group of groups) {
    group.tiles.forEach((id, index) => {
      if (isJoker(id)) places.set(id, { value: group.values[index], colors: group.colors[index], group });
    });
  }
  return places;
}

function sharesNatural(a: GroupInfo, b: GroupInfo): boolean {
  return a.tiles.some(id => !isJoker(id) && b.tiles.includes(id));
}

// A joker that no longer stands for the same tile alongside the same tiles has been taken. In a set it may
// stand for any missing color, so it stays put while one of the colors it could stand for is still missing.
// A taken joker needs the tile it stood for, from the rack, to sit with the tiles it was with, and one tile
// never frees two jokers. The joker must then be in a group with two more rack tiles, which jokers may share.
function takenJokerError(before: GroupInfo[], after: GroupInfo[], added: ReadonlySet<number>): string | null {
  const old = jokerPlaces(before);
  const now = jokerPlaces(after);
  const replacing = new Set<number>();
  const taken: JokerPlace[] = [];
  for (const [id, was] of old) {
    const is = now.get(id)!;
    const stayed = is.value === was.value && is.colors.some(color => was.colors.includes(color)) && sharesNatural(is.group, was.group);
    if (stayed) continue;
    const candidates = after.filter(group => sharesNatural(group, was.group)).flatMap(group => group.tiles).filter(tileId => {
      const tile = tileOf(tileId);
      return tile.kind === 'number' && !replacing.has(tileId) && !was.group.tiles.includes(tileId) &&
        tile.value === was.value && was.colors.includes(tile.color);
    });
    if (candidates.length === 0) return 'A joker taken from the table must be replaced by the tile it stands for';
    const replacement = candidates.find(tileId => added.has(tileId));
    if (replacement === undefined) return 'The tile that replaces a joker must come from your rack';
    replacing.add(replacement);
    taken.push(is);
  }
  const fromRack = (group: GroupInfo) => group.tiles.filter(tileId => added.has(tileId) && !replacing.has(tileId)).length;
  if (taken.some(is => fromRack(is.group) < 2)) return 'A joker taken from the table must be played again with at least two tiles from your rack';
  return null;
}

// What a play would do, checked against the table and the player's rack. The browser calls it for the preview.
export type CheckedPlay = { table: Table; added: number[]; meld: number | null };

export type PlayRules = { freeJokers: boolean; addOnFirstMeld: boolean };

// A game saved before house rules has none set, so both read as off
export function playRulesOf(state: Pick<GameState, 'houseRules'>): PlayRules {
  return { freeJokers: houseRule(state, FREE_JOKERS_RULE), addOnFirstMeld: houseRule(state, ADD_ON_FIRST_MELD_RULE) };
}

export function checkPlay(table: Table, melded: boolean, rack: number[], proposed: Table, rules: PlayRules): Result<CheckedPlay> {
  const tiles = proposed.flat();
  if (new Set(tiles).size !== tiles.length) return { error: 'A tile can be in only one group' };
  const onTable = new Set(table.flat());
  if ([...onTable].some(id => !tiles.includes(id))) return { error: 'Tiles on the table must stay on the table' };
  const added = tiles.filter(id => !onTable.has(id));
  if (added.some(id => !rack.includes(id))) return { error: 'You do not have those tiles' };
  if (added.length === 0) return { error: 'Play at least one tile from your rack' };

  const groups: GroupInfo[] = [];
  for (const [index, ids] of proposed.entries()) {
    const group = analyzeGroup(ids);
    if (!group) return { error: `Group ${index + 1} is not a valid set or run` };
    groups.push(group);
  }

  let meld: number | null = null;
  if (!melded) {
    // In exact order, since reordering a group can change what its jokers stand for
    const keys = groups.map(group => group.tiles.join(','));
    const unchanged = table.every(ids => {
      const at = keys.indexOf(ids.join(','));
      if (at >= 0) keys[at] = '';
      return at >= 0;
    });
    if (!unchanged) return { error: 'Your first meld may not use or change the tiles on the table' };
    meld = groups.filter(group => group.tiles.every(id => !onTable.has(id))).reduce((sum, group) => sum + group.points, 0);
    if (meld < INITIAL_MELD) return { error: `Your first meld must total at least ${INITIAL_MELD} points (this one totals ${meld})` };
  } else if (!rules.freeJokers) {
    const error = takenJokerError(table.map(ids => analyzeGroup(ids)).filter(group => group !== null), groups, new Set(added));
    if (error) return { error };
  }
  return { state: { table: groups.map(group => group.tiles), added, meld } };
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    table: [],
    racks: {},
    pool: [],
    melded: [],
    emptyPoolPasses: 0,
    lastMove: null,
    result: null
  };
}

// A joker counts lowest when drawing for the first turn
function drawRank(id: number): number {
  const tile = tileOf(id);
  return tile.kind === 'joker' ? 0 : tile.value;
}

// Each player draws a tile and the highest number goes first; tied players draw again.
// Drawn tiles stay out until the order is settled, so the draw always ends.
function drawForFirst(state: GameState, random: Random): { first: Seat; status: string } {
  const pool = fullPool();
  let contenders = state.activePlayers;
  const rounds: string[] = [];
  while (contenders.length > 1 && pool.length >= contenders.length) {
    const drawn = contenders.map(() => pool.splice(Math.floor(random() * pool.length), 1)[0]);
    rounds.push(contenders.map((seat, index) => `${state.playerNames[seat]} drew ${tileName(drawn[index])}`).join(', '));
    const best = Math.max(...drawn.map(drawRank));
    contenders = contenders.filter((_, index) => drawRank(drawn[index]) === best);
  }
  const first = contenders[0];
  return { first, status: `${rounds.join('; tie, so they draw again: ')}. ${state.playerNames[first]} goes first.` };
}

// Before the first move, the players draw for who goes first, the tiles go back,
// and a shuffled pool deals 14 tiles to everyone seated. Nothing is dealt until two players are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const seats = state.activePlayers;
  const fresh = { ...state, table: [], melded: [], emptyPoolPasses: 0, lastMove: null, result: null };
  if (seats.length < 2) return { ...fresh, racks: {}, pool: [] };
  const opening = drawForFirst(state, random);
  const pool = shuffle(fullPool(), random);
  const racks = Object.fromEntries(seats.map(seat => [seat, pool.splice(pool.length - RACK_SIZE, RACK_SIZE)]));
  return { ...fresh, racks, pool, currentPlayer: opening.first, gameStatus: `${state.gameStatus}. ${opening.status}` };
}

// Each player sees only their own rack; the table view (viewer null) sees none, and nobody sees the pool
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { racks, pool, ...view } = state;
  return {
    ...view,
    undoAvailable,
    rack: viewHand(racks, viewer),
    rackCounts: handCounts(racks),
    poolCount: pool.length
  };
}

function isTileId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < TILE_COUNT;
}

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  if (input?.type === 'draw') return { type: 'draw' };
  if (input?.type !== 'play' || !Array.isArray(input.table) || input.table.length > TILE_COUNT) return null;
  const groups = input.table.every(group => Array.isArray(group) && group.length <= TILE_COUNT && group.every(isTileId));
  return groups ? { type: 'play', table: input.table as Table } : null;
}

function names(state: GameState, seats: Seat[]): string {
  return seats.map(seat => state.playerNames[seat]).join(' and ');
}

// The round is over. Everyone else loses what is left on their rack (a joker 30), and the winners gain the sum
// of the others' losses: the player who went out, or the lowest rack when the pool ran out and nobody could play.
function endRound(state: GameState, wentOut: Seat | null): GameState {
  const seats = state.activePlayers;
  const rackTotals = Object.fromEntries(seats.map(seat => [seat, rackTotal(state.racks[seat] ?? [])]));
  const tileCounts = Object.fromEntries(seats.map(seat => [seat, (state.racks[seat] ?? []).length]));
  const lowest = Math.min(...seats.map(seat => rackTotals[seat]));
  const winners = wentOut === null ? seats.filter(seat => rackTotals[seat] === lowest) : [wentOut];
  const lost = seats.filter(seat => !winners.includes(seat)).reduce((sum, seat) => sum + rackTotals[seat], 0);
  const points = Object.fromEntries(seats.map(seat => [seat, winners.includes(seat) ? lost : -rackTotals[seat]]));
  const result: RoundResult = { wentOut, rackTotals, tileCounts, points };

  let gameStatus: string;
  if (wentOut !== null) gameStatus = `${state.playerNames[wentOut]} went out and wins with ${lost} points!`;
  else {
    const shared = winners.length > 1;
    gameStatus = `The pool is empty and nobody can play. ${names(state, winners)} ${shared ? 'share the win' : 'wins'} with the lowest rack ` +
      `(${lowest} points) and ${shared ? 'score' : 'scores'} ${lost}!`;
  }
  return { ...state, result, winners, isGameOver: true, currentPlayer: null, gameStatus };
}

function finishTurn(state: GameState, seat: Seat): GameState {
  return { ...state, currentPlayer: nextActivePlayer(state, seat) };
}

function play(state: GameState, seat: Seat, proposed: Table): Result<GameState> {
  const rack = state.racks[seat] ?? [];
  const checked = checkPlay(state.table, state.melded.includes(seat), rack, proposed, playRulesOf(state));
  if ('error' in checked) return checked;
  const { table, added, meld } = checked.state;
  const rest = rack.filter(id => !added.includes(id));
  const lastMove: LastMove = { type: 'play', playerNumber: seat, added, meld, wentOut: rest.length === 0 };
  const name = state.playerNames[seat];
  const next: GameState = {
    ...state,
    table,
    racks: { ...state.racks, [seat]: rest },
    melded: meld === null ? state.melded : [...state.melded, seat],
    emptyPoolPasses: 0,
    lastMove,
    gameStatus: meld === null
      ? `${name} played ${added.length} ${added.length === 1 ? 'tile' : 'tiles'}`
      : `${name} made their first meld of ${meld} points`
  };
  return { state: rest.length === 0 ? endRound(next, seat) : finishTurn(next, seat) };
}

// With an empty pool a draw is a pass; once everyone has passed in a row, the round ends
function draw(state: GameState, seat: Seat): GameState {
  const name = state.playerNames[seat];
  if (state.pool.length === 0) {
    const passed: GameState = {
      ...state,
      emptyPoolPasses: state.emptyPoolPasses + 1,
      lastMove: { type: 'draw', playerNumber: seat, drew: false },
      gameStatus: `${name} passed (the pool is empty)`
    };
    return passed.emptyPoolPasses >= state.activePlayers.length ? endRound(passed, null) : finishTurn(passed, seat);
  }
  return finishTurn({
    ...state,
    pool: state.pool.slice(0, -1),
    racks: { ...state.racks, [seat]: [...(state.racks[seat] ?? []), state.pool[state.pool.length - 1]] },
    emptyPoolPasses: 0,
    lastMove: { type: 'draw', playerNumber: seat, drew: true },
    gameStatus: `${name} drew a tile`
  }, seat);
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  return parsed.type === 'play' ? play(state, seat, parsed.table) : { state: draw(state, seat) };
}

// A player who leaves mid-game puts their tiles back in the pool, which is shuffled again. With the pool
// empty, those tiles refill it and the passes start again; otherwise the passes may now cover everyone left.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: rack = [], ...racks } = state.racks;
  const pool = shuffle([...state.pool, ...rack], random);
  const next: GameState = { ...state, racks, pool, emptyPoolPasses: pool.length > 0 ? 0 : state.emptyPoolPasses };
  return pool.length === 0 && next.emptyPoolPasses >= next.activePlayers.length ? endRound(next, null) : next;
}

// What the round gained or lost; the winners gain the others' rack totals
export function finalStandings(state: GameState): Standing[] {
  const change = (seat: Seat) => state.result?.points[seat] ?? 0;
  return rankStandings(state, (a, b) => change(b) - change(a), seat => state.result ? `${change(seat) > 0 ? '+' : ''}${pointsText(change(seat))}` : undefined);
}
