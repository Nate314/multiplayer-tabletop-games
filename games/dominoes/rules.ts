// Dominoes rules shared by the browser (playable tiles) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, connectedPlayers, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type {
  End, GameState, LastMove, Move, Placed, PublicGameState, Result, RoundSummary, Seat, SetSize
} from './types.ts';

export const SETS: SetSize[] = [6, 9];
export const DEFAULT_SET: SetSize = 6;
export const TARGET_SCORE = 100;

// Wikipedia's Dominoes article, section "Variants" (Blocking game and its Middle Eastern version): each player draws seven
// tiles in the two-player game and in the four-player game, and the player holding the double-six starts. It gives no
// hand size for a larger set or for three players, so three players also draw seven and double-nine uses nine for every
// player count. Later rounds are led by the previous round's winner with any tile (same section).
export const HAND_SIZES: Record<SetSize, Record<number, number>> = {
  6: { 2: 7, 3: 7, 4: 7 },
  9: { 2: 9, 3: 9, 4: 9 }
};

// Every tile of a double-`set` set once, as [low, high] pips; a tile's id is its index
export function tilesOf(set: SetSize): [number, number][] {
  const tiles: [number, number][] = [];
  for (let low = 0; low <= set; low++) for (let high = low; high <= set; high++) tiles.push([low, high]);
  return tiles;
}

export const tilePips = (set: SetSize, tile: number): [number, number] => tilesOf(set)[tile];

export const pipTotal = (set: SetSize, tiles: number[]) =>
  tiles.reduce((sum, tile) => sum + tilePips(set, tile)[0] + tilePips(set, tile)[1], 0);

export const leftEnd = (line: Placed[]): number | null => line[0]?.left ?? null;
export const rightEnd = (line: Placed[]): number | null => line[line.length - 1]?.right ?? null;

export type Play = { tile: number; end: End };

// Every way a tile in `hand` can be played. The first tile of a round has no end to match, so it is listed once as 'left';
// a `leadTile` restricts it.
export function legalPlays(set: SetSize, hand: number[], line: Placed[], leadTile: number | null): Play[] {
  if (line.length === 0) return hand.filter(tile => leadTile === null || tile === leadTile).map(tile => ({ tile, end: 'left' }));
  const ends: [End, number | null][] = [['left', leftEnd(line)], ['right', rightEnd(line)]];
  return hand.flatMap(tile => ends
    .filter(([, pips]) => tilePips(set, tile).some(side => side === pips))
    .map(([end]): Play => ({ tile, end })));
}

// How `tile` lies on an end: its matching pips touch the line, the other pips face out
export function place(set: SetSize, tile: number, end: End, line: Placed[]): Placed {
  const [a, b] = tilePips(set, tile);
  if (line.length === 0) return { tile, left: a, right: b };
  const open = (end === 'left' ? leftEnd(line) : rightEnd(line)) as number;
  const other = a === open ? b : a;
  return end === 'left' ? { tile, left: other, right: open } : { tile, left: open, right: other };
}

// How the status line and the history name a tile: its pips as laid, e.g. '3-4'
export const pipsName = ([left, right]: [number, number]) => `${left}-${right}`;

// The tile that leads the first round: the highest double, else the heaviest tile (ties go to the higher end)
export function openingTile(set: SetSize, hands: Record<Seat, number[]>): { seat: Seat; tile: number } {
  const worth = (tile: number) => {
    const [a, b] = tilePips(set, tile);
    return (a === b ? 1000 : 0) + (a + b) * 20 + b;
  };
  const held = Object.entries(hands).flatMap(([seat, hand]) => hand.map(tile => ({ seat: Number(seat), tile })));
  return held.reduce((best, next) => (worth(next.tile) > worth(best.tile) ? next : best));
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    set: DEFAULT_SET,
    roundNumber: 1,
    scores: {},
    hands: {},
    boneyard: [],
    line: [],
    leadTile: null,
    lastWinner: null,
    roundSummary: null,
    lastMove: null
  };
}

// Everyone draws their tiles from a shuffled set and the rest is the boneyard. The first round is led by the holder of the
// highest double; after that the previous round's winner leads with any tile.
export function dealRound(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const deck = shuffle(tilesOf(state.set).map((_, tile) => tile), random);
  const size = HAND_SIZES[state.set][players.length];
  const hands = Object.fromEntries(players.map((seat, index) => [seat, deck.slice(index * size, (index + 1) * size)]));
  const opening = state.lastWinner !== null && players.includes(state.lastWinner) ? null : openingTile(state.set, hands);
  return {
    ...state,
    hands,
    boneyard: deck.slice(players.length * size),
    line: [],
    leadTile: opening?.tile ?? null,
    currentPlayer: opening?.seat ?? state.lastWinner,
    roundSummary: null,
    lastMove: null
  };
}

// Before the first move, the tiles are dealt afresh for the current players, keeping the lobby's choice of set.
// Nothing is dealt until two players are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const empty: GameState = {
    ...state,
    roundNumber: 1,
    scores: Object.fromEntries(players.map(seat => [seat, 0])),
    hands: Object.fromEntries(players.map(seat => [seat, []])),
    boneyard: [],
    line: [],
    leadTile: null,
    lastWinner: null,
    roundSummary: null,
    lastMove: null
  };
  return players.length < 2 ? empty : dealRound(empty, random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, boneyard, ...view } = state;
  return {
    ...view,
    hand: viewer === null ? [] : hands[viewer] ?? [],
    handCounts: Object.fromEntries(Object.entries(hands).map(([seat, hand]) => [seat, hand.length])),
    boneyardCount: boneyard.length,
    undoAvailable
  };
}

function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'draw':
    case 'pass':
      return { type: input.type };
    case 'play':
      if (!Number.isInteger(input.tile) || (input.end !== 'left' && input.end !== 'right')) return null;
      return { type: 'play', tile: input.tile as number, end: input.end };
    default:
      return null;
  }
}

// How the status line and the history describe a move, e.g. 'Alice played 3-4 on the left'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'draw': return `${name} drew a tile`;
    case 'pass': return `${name} passed`;
    case 'play': {
      const where = lastMove.end === null ? '' : ` on the ${lastMove.end}`;
      return `${name} played ${pipsName(lastMove.pips)}${where}${lastMove.wentOut ? ' and went out' : ''}`;
    }
  }
}

const canMove = (state: GameState, seat: Seat) =>
  legalPlays(state.set, state.hands[seat] ?? [], state.line, state.leadTile).length > 0;

// Nobody can play and there is nothing left to draw
function isBlocked(state: GameState): boolean {
  return state.boneyard.length === 0 && state.line.length > 0 && !state.activePlayers.some(seat => canMove(state, seat));
}

// A round ends in a win for the player who went out, who scores the pips in every other hand and in the boneyard (Wikipedia,
// "Scoring": the score is the pips in the losing hands plus the stock). A blocked round (`wentOut` null) goes to the lowest pip
// total, who scores the other hands (Middle Eastern version); a tie for the lowest scores nothing.
// The first to TARGET_SCORE wins the game.
function endRound(state: GameState, wentOut: Seat | null): GameState {
  const players = state.activePlayers;
  const pips = Object.fromEntries(players.map(seat => [seat, pipTotal(state.set, state.hands[seat])]));
  const boneyardPips = pipTotal(state.set, state.boneyard);
  const lowest = Math.min(...players.map(seat => pips[seat]));
  const lowSeats = players.filter(seat => pips[seat] === lowest);
  const winner = wentOut ?? (lowSeats.length === 1 ? lowSeats[0] : null);
  const points = winner === null ? 0
    : players.filter(seat => seat !== winner).reduce((sum, seat) => sum + pips[seat], 0) + (wentOut === null ? 0 : boneyardPips);

  const summary: RoundSummary = {
    roundNumber: state.roundNumber,
    winner,
    blocked: wentOut === null,
    points,
    pipsLeft: pips,
    tilesLeft: Object.fromEntries(players.map(seat => [seat, state.hands[seat].length])),
    boneyardPips,
    acknowledged: []
  };
  const scored: GameState = {
    ...state,
    currentPlayer: null,
    lastWinner: winner,
    scores: winner === null ? state.scores : { ...state.scores, [winner]: (state.scores[winner] ?? 0) + points },
    roundSummary: summary
  };
  if (winner === null) return { ...scored, gameStatus: 'The round is blocked and tied, nobody scores. Waiting for everyone to continue.' };

  const name = state.playerNames[winner];
  const total = scored.scores[winner];
  if (total >= TARGET_SCORE) return { ...scored, isGameOver: true, winners: [winner], gameStatus: `${name} wins with ${total} points!` };
  const cause = wentOut === null ? `The round is blocked: ${name} has the lowest total and` : `${name} went out and`;
  return { ...scored, gameStatus: `${cause} scores ${points} points. Waiting for everyone to continue.` };
}

// A move that may have blocked the game: the round ends, else the turn moves on (or stays, after a draw)
function settle(state: GameState, seat: Seat, lastMove: LastMove, advance: boolean): GameState {
  if (isBlocked(state)) return { ...endRound(state, null), lastMove };
  const turn = advance ? nextActivePlayer(state, seat) : state.currentPlayer;
  return { ...state, currentPlayer: turn, lastMove, gameStatus: describeMove(lastMove, state.playerNames) };
}

function play(state: GameState, seat: Seat, tile: number, end: End): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.includes(tile)) return { error: 'You do not have that tile' };
  const first = state.line.length === 0;
  if (first && state.leadTile !== null && tile !== state.leadTile) {
    return { error: 'Lead with the highest double, or the heaviest tile if nobody has a double' };
  }
  // The first tile has no end to match; afterwards the tile must match the end it is played on
  if (!first && !legalPlays(state.set, [tile], state.line, null).some(option => option.end === end)) {
    return { error: 'That tile does not match that end' };
  }

  const placed = place(state.set, tile, end, state.line);
  const rest = hand.filter(held => held !== tile);
  const next: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: rest },
    line: end === 'left' ? [placed, ...state.line] : [...state.line, placed],
    leadTile: null
  };
  const lastMove: LastMove = {
    type: 'play', playerNumber: seat, tile, pips: [placed.left, placed.right], end: first ? null : end, wentOut: rest.length === 0
  };
  if (rest.length === 0) return { state: { ...endRound(next, seat), lastMove } };
  return { state: settle(next, seat, lastMove, true) };
}

// Only when nothing in the hand fits; the turn stays with the player
function draw(state: GameState, seat: Seat): Result<GameState> {
  if (canMove(state, seat)) return { error: 'You have a tile that fits' };
  if (state.boneyard.length === 0) return { error: 'The boneyard is empty' };
  const tile = state.boneyard[state.boneyard.length - 1];
  const next: GameState = {
    ...state,
    boneyard: state.boneyard.slice(0, -1),
    hands: { ...state.hands, [seat]: [...state.hands[seat], tile] }
  };
  return { state: settle(next, seat, { type: 'draw', playerNumber: seat }, false) };
}

// Only when nothing fits and the boneyard is empty
function pass(state: GameState, seat: Seat): Result<GameState> {
  if (canMove(state, seat)) return { error: 'You have a tile that fits' };
  if (state.boneyard.length > 0) return { error: 'Draw from the boneyard first' };
  return { state: settle(state, seat, { type: 'pass', playerNumber: seat }, true) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (state.roundSummary) return { error: 'The round is over' };
  if (parsed.type === 'draw') return draw(state, seat);
  if (parsed.type === 'pass') return pass(state, seat);
  return play(state, seat, parsed.tile, parsed.end);
}

// Deals the next round once every connected player has acknowledged the summary
function startNextRoundIfReady(state: GameState, random: Random): GameState {
  const summary = state.roundSummary;
  if (!summary || state.isGameOver) return state;
  if (!connectedPlayers(state).every(seat => summary.acknowledged.includes(seat))) return state;
  const roundNumber = state.roundNumber + 1;
  const next = dealRound({ ...state, roundNumber }, random);
  return { ...next, gameStatus: `Round ${roundNumber}: ${state.playerNames[next.currentPlayer as Seat]} leads` };
}

function acknowledgeRound(state: GameState, seat: Seat, random: Random): Result<GameState> {
  const summary = state.roundSummary;
  if (!summary) return { error: 'Nothing to continue' };
  if (summary.acknowledged.includes(seat)) return { state };
  const next: GameState = {
    ...state,
    roundSummary: { ...summary, acknowledged: [...summary.acknowledged, seat] },
    gameStatus: `${state.playerNames[seat]} is ready for the next round`
  };
  return { state: startNextRoundIfReady(next, random) };
}

// Any seated player may choose the set until the first move; the tiles are dealt again
function chooseSet(state: GameState, seat: Seat, set: unknown, random: Random): Result<GameState> {
  if (state.started) return { error: 'The set can only be chosen before the first move' };
  if (!state.activePlayers.includes(seat)) return { error: 'Only seated players can choose the set' };
  if (!SETS.some(size => size === set)) return { error: 'Choose double-six or double-nine' };
  const next = resetLobby({ ...state, set: set as SetSize }, random);
  return { state: { ...next, gameStatus: `${state.playerNames[seat]} chose double-${set === 6 ? 'six' : 'nine'}` } };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  const input = asRecord(action);
  switch (input?.type) {
    case 'chooseSet': return chooseSet(state, seat, input.set, random);
    case 'acknowledgeRound': return acknowledgeRound(state, seat, random);
    default: return { error: 'Unknown action' };
  }
}

// The leaver's tiles go back into the boneyard. The platform has already moved a held turn on (play runs up the seats too),
// but the round may now be blocked, and the next round may have been waiting only for them.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: hand = [], ...hands } = state.hands;
  const returned: GameState = {
    ...state,
    hands,
    boneyard: shuffle([...state.boneyard, ...hand], random),
    lastWinner: state.lastWinner === seat ? null : state.lastWinner
  };
  if (returned.roundSummary) return startNextRoundIfReady(returned, random);
  return isBlocked(returned) ? endRound(returned, null) : returned;
}

// The next round may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextRoundIfReady(state, random);
}

// Reshuffles the boneyard, so an undone draw cannot show which tile comes next
export function onUndo(state: GameState, random: Random): GameState {
  return { ...state, boneyard: shuffle(state.boneyard, random) };
}
