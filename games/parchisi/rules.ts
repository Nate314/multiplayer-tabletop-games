// Parchisi rules shared by the browser (move hints) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type {
  DieChoice, GameState, LastMove, LegalMove, PawnRef, Progress, PublicGameState, Random, Result, Seat
} from './types.ts';

export const PAWN_COUNT = 4;
export const TRACK_LENGTH = 68;
export const SIDE_LENGTH = TRACK_LENGTH / 4; // each side of the cross owns 17 track squares
export const NEST = -1;
export const LAST_TRACK = 63; // a pawn's own home entrance, 63 squares past its entry square
export const HOME = 71; // after the 7 squares of the home column
export const ENTER_ROLL = 5;
export const CAPTURE_BONUS = 20;
export const HOME_BONUS = 10;
const ENTRY_OFFSET = 5;
const SAFE_OFFSETS = [0, ENTRY_OFFSET, 12]; // per side: its home entrance, its entry square and one more
const MAX_DOUBLES = 3;
// Every roll has a chance to give a move, so the automatic passing ends; the cap only guards against a broken random.
// Should it ever be reached, the player is left without a move and an undo rolls again.
const MAX_ROLLS = 100;

// Side of the cross, counterclockwise from the bottom; two players get opposite sides
const SIDES: Record<Seat, number> = { 1: 0, 2: 2, 3: 1, 4: 3 };

export function sideOf(seat: Seat): number {
  return SIDES[seat];
}

// Track squares are numbered 0-67, counterclockwise from the bottom side's home entrance
export function entryIndex(seat: Seat): number {
  return sideOf(seat) * SIDE_LENGTH + ENTRY_OFFSET;
}

export function trackIndex(seat: Seat, progress: Progress): number {
  return (entryIndex(seat) + progress) % TRACK_LENGTH;
}

export function isSafe(index: number): boolean {
  return SAFE_OFFSETS.includes(index % SIDE_LENGTH);
}

export function isOnTrack(progress: Progress): boolean {
  return progress >= 0 && progress <= LAST_TRACK;
}

// Pawns in the nest and at home have no square, so any number of them fit
function squareKey(seat: Seat, progress: Progress): string | null {
  if (isOnTrack(progress)) return `track-${trackIndex(seat, progress)}`;
  if (progress > LAST_TRACK && progress < HOME) return `home-${seat}-${progress}`;
  return null;
}

function occupants(state: Pick<GameState, 'pawns'>, key: string): PawnRef[] {
  return Object.entries(state.pawns).flatMap(([seat, pawns]) =>
    pawns.flatMap((progress, pawn) => squareKey(Number(seat), progress) === key ? [{ seat: Number(seat), pawn }] : [])
  );
}

// Two pawns of one color on a square: nobody can pass or land there
function isBlockade(there: PawnRef[]): boolean {
  return there.length === 2 && there[0].seat === there[1].seat;
}

type DieOption = { die: DieChoice; steps: number };

function dieOptions({ dice, bonuses }: Pick<GameState, 'dice' | 'bonuses'>): DieOption[] {
  const options: DieOption[] = [];
  dice.forEach((die, index) => {
    if (!die.used) options.push({ die: index as 0 | 1, steps: die.value });
  });
  if (dice.length === 2 && !dice[0].used && !dice[1].used && dice[0].value + dice[1].value === ENTER_ROLL) {
    options.push({ die: 'sum', steps: ENTER_ROLL });
  }
  if (bonuses.length > 0) options.push({ die: 'bonus', steps: bonuses[0] });
  return options;
}

// Entering takes a 5 from the dice and captures an opponent on the entry square, even though it is safe
function enterMove(state: GameState, seat: Seat, pawn: number, { die, steps }: DieOption): LegalMove | null {
  if (steps !== ENTER_ROLL || die === 'bonus') return null;
  const there = occupants(state, squareKey(seat, 0)!);
  if (there.filter(other => other.seat === seat).length >= 2) return null;
  const captured = there.find(other => other.seat !== seat) ?? null;
  return { pawn, die, steps, to: 0, captured };
}

function advanceMove(state: GameState, seat: Seat, pawn: number, { die, steps }: DieOption): LegalMove | null {
  const from = state.pawns[seat][pawn];
  const to = from + steps;
  if (die === 'sum' || to > HOME) return null;

  for (let progress = from + 1; progress <= to; progress++) {
    const key = squareKey(seat, progress);
    if (key && isBlockade(occupants(state, key))) return null;
  }
  const key = squareKey(seat, to);
  if (!key) return { pawn, die, steps, to, captured: null };

  const there = occupants(state, key);
  if (there.length >= 2) return null;
  const opponent = there.find(other => other.seat !== seat);
  // On a safe square an opponent's pawn shares the square instead of being captured
  const captured = opponent && !isSafe(trackIndex(seat, to)) ? opponent : null;
  return { pawn, die, steps, to, captured };
}

export function getLegalMoves(state: GameState, seat: Seat): LegalMove[] {
  const pawns = state.pawns[seat];
  if (!pawns) return [];
  return dieOptions(state).flatMap(option => pawns.flatMap((progress, pawn) => {
    if (progress === HOME) return [];
    const move = progress === NEST ? enterMove(state, seat, pawn, option) : advanceMove(state, seat, pawn, option);
    return move ? [move] : [];
  }));
}

export function describeLastMove({ playerNumber, from, to, steps, captured }: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[playerNumber];
  let text = from === NEST ? `${name} entered a pawn`
    : to === HOME ? `${name} moved a pawn home (+${HOME_BONUS})`
      : `${name} moved a pawn ${steps} ${steps === 1 ? 'square' : 'squares'}`;
  if (captured) text += ` and captured ${playerNames[captured.seat]}'s pawn (+${CAPTURE_BONUS})`;
  return text;
}

function rollDie(random: Random): number {
  return Math.min(6, 1 + Math.floor(random() * 6));
}

// Three doubles in a row send the pawn furthest along the track (not in its home column) back to the nest
function sendFurthestHome(state: GameState, seat: Seat): GameState {
  const pawns = state.pawns[seat];
  const furthest = pawns.reduce((best, progress, pawn) =>
    isOnTrack(progress) && (best < 0 || progress > pawns[best]) ? pawn : best, -1);
  if (furthest < 0) return state;
  return { ...state, pawns: { ...state.pawns, [seat]: pawns.map((progress, pawn) => pawn === furthest ? NEST : progress) } };
}

// Rolls for `seat` and, while the roll gives no move, passes the turn on (a double rolls again).
// `doublesRolled` counts the doubles already rolled this turn; `notes` start the status line.
function startTurn(state: GameState, seat: Seat, doublesRolled: number, random: Random, notes: string[]): GameState {
  let next = state;
  let roller = seat;
  let doubles = doublesRolled;
  const status = [...notes];

  for (let roll = 0; roll < MAX_ROLLS; roll++) {
    const values = [rollDie(random), rollDie(random)];
    const name = next.playerNames[roller];
    const isDouble = values[0] === values[1];
    doubles = isDouble ? doubles + 1 : 0;

    if (doubles === MAX_DOUBLES) {
      const penalized = sendFurthestHome(next, roller);
      status.push(`${name} rolled a third double in a row and lost the turn${penalized === next ? '' : ' and a pawn to the nest'}`);
      next = penalized;
      roller = nextActivePlayer(next, roller) ?? roller;
      doubles = 0;
      continue;
    }

    next = {
      ...next,
      currentPlayer: roller,
      roller,
      dice: values.map(value => ({ value, used: false })),
      bonuses: [],
      doublesRolled: doubles
    };
    const rolled = `${name} rolled ${values[0]} and ${values[1]}`;
    if (getLegalMoves(next, roller).length > 0) {
      status.push(isDouble ? `${rolled}, doubles, and rolls again after this turn` : rolled);
      break;
    }
    status.push(isDouble ? `${rolled} and cannot move, but rolls again for the doubles` : `${rolled} and cannot move`);
    if (!isDouble) {
      roller = nextActivePlayer(next, roller) ?? roller;
      doubles = 0;
    }
  }
  return { ...next, gameStatus: status.join('. ') };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), pawns: {}, dice: [], bonuses: [], roller: null, doublesRolled: 0, lastMove: null };
}

// Before the first move every pawn is in its nest, and once two players are seated the first player has rolled
export function resetLobby(state: GameState, random: Random): GameState {
  const reset: GameState = {
    ...state,
    pawns: Object.fromEntries(state.activePlayers.map(seat => [seat, Array<Progress>(PAWN_COUNT).fill(NEST)])),
    dice: [],
    bonuses: [],
    roller: null,
    doublesRolled: 0,
    lastMove: null
  };
  if (state.activePlayers.length < 2 || state.currentPlayer === null) return reset;
  return startTurn(reset, state.currentPlayer, 0, random, [state.gameStatus]);
}

// The leaver's pawns come off the board; if it was their turn, the next player rolls
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const pawns = { ...state.pawns };
  delete pawns[seat];
  const next = { ...state, pawns };
  if (next.currentPlayer === null || next.roller === next.currentPlayer) return next;
  return startTurn(next, next.currentPlayer, 0, random, [next.gameStatus]);
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

function spendDie(state: GameState, die: DieChoice): Pick<GameState, 'dice' | 'bonuses'> {
  if (die === 'bonus') return { dice: state.dice, bonuses: state.bonuses.slice(1) };
  return {
    dice: state.dice.map((value, index) => die === 'sum' || die === index ? { ...value, used: true } : value),
    bonuses: state.bonuses
  };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'move') return { error: 'Unknown move type' };
  const legal = getLegalMoves(state, seat).find(option => option.pawn === input.pawn && option.die === input.die);
  if (!legal) return { error: 'Invalid move' };

  const { pawn, steps, to, captured } = legal;
  const pawns = { ...state.pawns, [seat]: state.pawns[seat].map((progress, index) => index === pawn ? to : progress) };
  if (captured) {
    pawns[captured.seat] = pawns[captured.seat].map((progress, index) => index === captured.pawn ? NEST : progress);
  }
  const spent = spendDie(state, legal.die);
  const earned = [...(captured ? [CAPTURE_BONUS] : []), ...(to === HOME ? [HOME_BONUS] : [])];
  const lastMove: LastMove = { playerNumber: seat, pawn, from: state.pawns[seat][pawn], to, steps, captured };
  const next: GameState = {
    ...state,
    pawns,
    dice: spent.dice,
    bonuses: [...spent.bonuses, ...earned],
    lastMove,
    gameStatus: describeLastMove(lastMove, state.playerNames)
  };

  if (pawns[seat].every(progress => progress === HOME)) {
    return { state: { ...next, isGameOver: true, winners: [seat], currentPlayer: null, gameStatus: `${state.playerNames[seat]} wins!` } };
  }
  if (getLegalMoves(next, seat).length > 0) return { state: next };

  // The turn is over: a double rolls again, anything else passes the dice on
  const rolledDouble = next.dice[0].value === next.dice[1].value;
  const roller = rolledDouble ? seat : nextActivePlayer(next, seat) ?? seat;
  return { state: startTurn(next, roller, rolledDouble ? next.doublesRolled : 0, random, [next.gameStatus]) };
}
