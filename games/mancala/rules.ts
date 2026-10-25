// Mancala rules (Avalanche or Kalah, with or without play from the other side) shared by the browser (board layout,
// playable pits, move animation) and the server (validation).
import { houseRule, type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Board, GameState, LastMove, PublicGameState, Result, Seat, Transfer } from './types.ts';

export const PITS_PER_SIDE = 6;
export const STONES_PER_PIT = 4;
const HOLES = 2 * (PITS_PER_SIDE + 1);
const SEATS: Seat[] = [1, 2];

const OTHER_SIDE_RULE: ToggleRule = {
  id: 'otherSide', label: 'When your side is empty, play from the other side', kind: 'toggle', standard: true,
  help: 'You sow from any non-empty pit on the other side, and the game ends only when every pit is empty'
};
const AVALANCHE_RULE: ToggleRule = {
  id: 'avalanche', label: 'Avalanche (off plays Kalah, with captures)', kind: 'toggle', standard: true,
  help: 'Off: no relays, and a last stone in an empty pit of yours captures the pit opposite'
};
export const MANCALA_RULES: HouseRule[] = [OTHER_SIDE_RULE, AVALANCHE_RULE];

export type Rules = { otherSide: boolean; avalanche: boolean };

export function rulesOf(state: Pick<GameState, 'houseRules'>): Rules {
  return { otherSide: houseRule(state, OTHER_SIDE_RULE), avalanche: houseRule(state, AVALANCHE_RULE) };
}

type Side = { firstPit: number; bank: number };

export const SIDES: Record<Seat, Side> = {
  1: { firstPit: 0, bank: PITS_PER_SIDE },
  2: { firstPit: PITS_PER_SIDE + 1, bank: HOLES - 1 }
};

export function opponentOf(seat: Seat): Seat {
  return seat === 1 ? 2 : 1;
}

// A side's pits in the order stones are dropped into them, which is left to right as their owner sees them
export function pitsOf(seat: Seat): number[] {
  const { firstPit } = SIDES[seat];
  return Array.from({ length: PITS_PER_SIDE }, (_, index) => firstPit + index);
}

export function bankOf(seat: Seat): number {
  return SIDES[seat].bank;
}

export function stoneCount(count: number): string {
  return count === 1 ? '1 stone' : `${count} stones`;
}

// Every pit starts with four stones in the color of the player whose side it is on
export function initialBoard(): Board {
  return Array.from({ length: HOLES }, (_, hole) => {
    const seat: Seat = hole < SIDES[2].firstPit ? 1 : 2;
    return hole === bankOf(seat) ? [] : Array<Seat>(STONES_PER_PIT).fill(seat);
  });
}

function stonesOnSide(board: Board, seat: Seat): number {
  return pitsOf(seat).reduce((sum, pit) => sum + board[pit].length, 0);
}

// The non-empty pits on your side, or when it is empty and `otherSide` is on, the non-empty pits on the other side
export function playablePits(board: Board, seat: Seat, otherSide: boolean): number[] {
  const own = pitsOf(seat).filter(pit => board[pit].length > 0);
  if (own.length > 0 || !otherSide) return own;
  return pitsOf(opponentOf(seat)).filter(pit => board[pit].length > 0);
}

export function isPlayablePit(board: Board, seat: Seat, pit: unknown, otherSide: boolean): pit is number {
  return typeof pit === 'number' && playablePits(board, seat, otherSide).includes(pit);
}

// The pit across the board from `pit`: pits 0 to 5 face 12 down to 7
const oppositeOf = (pit: number): number => HOLES - 2 - pit;

// Applies the transfers in order, changing the board in place
export function applyTransfers(board: Board, transfers: Transfer[]): void {
  for (const { from, to } of transfers) board[to].push(board[from].shift()!);
}

// Every stone in `holes`, hole by hole, into `to`
function emptyInto(board: Board, holes: number[], to: number): Transfer[] {
  return holes.flatMap(from => board[from].map(() => ({ from, to })));
}

// A turn's stones go from hole to hole one step at a time, never into the opponent's bank, so the 13 holes they do visit
// come round in a fixed order and every 13 steps put one stone in the mover's bank. That bank can never hold more than
// all 48 stones, so a turn takes fewer than 13 * 49 steps, and each lap is at least one step. The limit is therefore
// never reached; if it ever were, the turn would simply end where the last lap did.
const MAX_LAPS = (HOLES - 1) * (2 * PITS_PER_SIDE * STONES_PER_PIT + 1);

export type Turn = {
  board: Board; // after the whole turn
  end: number; // where the last stone of the last lap landed
  laps: Transfer[][]; // each pickup's stones, one into each following hole; every lap starts where the one before ended
  capture: Transfer[]; // Kalah: the last stone and the pit opposite into the mover's bank, after the laps
  endedOnStones: boolean; // Kalah: the last stone landed in a pit that already had stones, outside the bank
  sweep: Transfer[]; // the end-of-game sweep of both rows into their banks
  isGameOver: boolean;
};

// Picks up every stone in `pit` and drops one into each following hole counter-clockwise, skipping the opponent's bank.
// Avalanche: while the last stone lands in a pit that already had stones, that whole pit is picked up and dropped the same way.
// Kalah: there is one lap, and a last stone in an empty pit on the mover's side captures it with the pit opposite.
// Then the rows are swept if the game is over (every pit empty with `otherSide`, else either row empty).
// The move animation replays the same transfers, so every stone follows these rules.
export function playPit(board: Board, seat: Seat, pit: number, { otherSide, avalanche }: Rules): Turn {
  const next = board.map(hole => [...hole]);
  const skipped = bankOf(opponentOf(seat));
  const laps: Transfer[][] = [];
  let end = pit;
  do {
    const from = end;
    const drops: Transfer[] = [];
    for (let left = next[from].length; left > 0; left--) {
      do end = (end + 1) % HOLES; while (end === skipped);
      drops.push({ from, to: end });
    }
    applyTransfers(next, drops);
    laps.push(drops);
  } while (avalanche && end !== bankOf(seat) && next[end].length > 1 && laps.length < MAX_LAPS);

  const endedOnStones = !avalanche && end !== bankOf(seat) && next[end].length > 1;
  const captures = !avalanche && pitsOf(seat).includes(end) && next[end].length === 1 && next[oppositeOf(end)].length > 0;
  const capture = captures ? emptyInto(next, [end, oppositeOf(end)], bankOf(seat)) : [];
  applyTransfers(next, capture);

  // When either row runs out, each player moves the stones left on their side into their own bank. With `otherSide`
  // a player with an empty row plays from the other side, so the game goes on until every pit is empty and nothing is swept.
  const [one, two] = [stonesOnSide(next, 1), stonesOnSide(next, 2)];
  const isGameOver = otherSide ? one + two === 0 : one === 0 || two === 0;
  const sweep = isGameOver && !otherSide ? SEATS.flatMap(owner => emptyInto(next, pitsOf(owner), bankOf(owner))) : [];
  applyTransfers(next, sweep);
  return { board: next, end, laps, capture, endedOnStones, sweep, isGameOver };
}

// One line about the turn, e.g. 'Alice picked up 4 stones and kept going 3 times, ending in an empty pit'.
// `pitNumber` (1 to 6 from its owner's left) names the first pit, as in ' from pit 2'.
export function describeTurn(
  { playerNumber, pickedUp, laps, end, extraTurn, captured, fromOpponent, endedOnStones }: LastMove,
  playerNames: GameState['playerNames'], pitNumber?: number
): string {
  const name = playerNames[playerNumber];
  const opponentName = playerNames[opponentOf(playerNumber)];
  const relays = laps - 1;
  const keptGoing = relays === 0 ? '' : ` and kept going ${relays === 1 ? 'once' : `${relays} times`}`;
  let start = '';
  if (fromOpponent) start = pitNumber === undefined ? ` from ${opponentName}'s side` : ` from ${opponentName}'s pit ${pitNumber}`;
  else if (pitNumber !== undefined) start = ` from pit ${pitNumber}`;
  let ending = endedOnStones ? 'a pit with stones' : 'an empty pit';
  if (end === bankOf(playerNumber)) ending = extraTurn ? `${name}'s bank for an extra turn` : `${name}'s bank`;
  const capturing = captured ? ` and capturing ${stoneCount(captured)}` : '';
  return `${name} picked up ${stoneCount(pickedUp)}${start}${keptGoing}, ending in ${ending}${capturing}`;
}

function finalStatus(state: GameState, board: Board): Pick<GameState, 'winners' | 'gameStatus'> {
  const [one, two] = [board[bankOf(1)].length, board[bankOf(2)].length];
  if (one === two) return { winners: [], gameStatus: `Draw, ${stoneCount(one)} each` };
  const winner = one > two ? 1 : 2;
  return {
    winners: [winner],
    gameStatus: `${state.playerNames[winner]} wins ${Math.max(one, two)} to ${Math.min(one, two)}!`
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), board: initialBoard(), lastMove: null };
}

// Before the first move the board is always the starting one
export function resetLobby(state: GameState): GameState {
  return { ...state, board: initialBoard(), lastMove: null };
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const pit = asRecord(move)?.pit;
  const rules = rulesOf(state);
  if (!isPlayablePit(state.board, seat, pit, rules.otherSide)) return { error: 'Invalid move' };
  const { board, end, laps, capture, endedOnStones, isGameOver } = playPit(state.board, seat, pit, rules);
  const extraTurn = end === bankOf(seat) && !isGameOver;
  const lastMove: LastMove = { playerNumber: seat, pit, end, pickedUp: laps[0].length, laps: laps.length, extraTurn };
  if (capture.length > 0) lastMove.captured = capture.length;
  if (!pitsOf(seat).includes(pit)) lastMove.fromOpponent = true;
  if (endedOnStones) lastMove.endedOnStones = true;
  if (isGameOver) {
    return { state: { ...state, board, lastMove, isGameOver, currentPlayer: null, ...finalStatus(state, board) } };
  }
  return {
    state: {
      ...state,
      board,
      lastMove,
      gameStatus: describeTurn(lastMove, state.playerNames),
      currentPlayer: extraTurn ? seat : nextActivePlayer(state, seat)
    }
  };
}
