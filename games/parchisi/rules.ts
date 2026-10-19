// Parchisi rules shared by the browser (move hints) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import type {
  Die, DieChoice, GameState, LastMove, LegalMove, PawnRef, Progress, PublicGameState, Random, Result, Seat
} from './types.ts';

export const PAWN_COUNT = 4;
export const TRACK_LENGTH = 68;
const SIDE_COUNT = 4;
export const SIDE_LENGTH = TRACK_LENGTH / SIDE_COUNT; // each side of the cross owns 17 track squares
export const NEST = -1;
export const LAST_TRACK = 63; // a pawn's own home entrance, 63 squares past its entry square
export const HOME = 71; // after the 7 squares of the home column
export const ENTER_ROLL = 5;
export const CAPTURE_BONUS = 20;
export const HOME_BONUS = 10;
const ENTRY_OFFSET = 5;
const SAFE_OFFSETS = [0, ENTRY_OFFSET, 12]; // per side: its home entrance, its entry square and one more
const MAX_DOUBLES = 3;
const DIE_FACES = 6;
const OPPOSITE_FACES = 7; // a face and the face underneath it add up to 7
// Every roll has a chance to give a move, so the automatic passing ends; the cap only guards against a broken random.
// Should it ever be reached, the player is left without a move and an undo rolls again.
const MAX_ROLLS = 100;

// Side of the cross, counterclockwise from the bottom; two players get opposite sides
const SIDES: Record<Seat, number> = { 1: 0, 2: 2, 3: 1, 4: 3 };

export function sideOf(seat: Seat): number {
  return SIDES[seat];
}

// Turns pass to the player on the left, clockwise around the board: bottom, left, top, right
function turnRank(seat: Seat): number {
  return (SIDE_COUNT - sideOf(seat)) % SIDE_COUNT;
}

export function inTurnOrder(seats: Seat[]): Seat[] {
  return [...seats].sort((a, b) => turnRank(a) - turnRank(b));
}

// The player after `seat`, who may have just left
export function nextPlayer(state: Pick<GameState, 'activePlayers'>, seat: Seat): Seat | null {
  const order = inTurnOrder(state.activePlayers);
  return order.find(other => turnRank(other) > turnRank(seat)) ?? order[0] ?? null;
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

export function isDoubles(dice: Die[]): boolean {
  return dice.length > 0 && dice[0].value === dice[1].value;
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

type Landing = { to: Progress; captured: PawnRef | null };

// A square holds at most two pawns, which are then a blockade of one color. A lone opponent is captured,
// except on a safe square, where it keeps the square; a pawn entering captures one on its own entry square.
function landOn(state: GameState, seat: Seat, to: Progress, entering: boolean): Landing | null {
  const key = squareKey(seat, to);
  if (!key) return { to, captured: null };
  const there = occupants(state, key);
  if (there.length >= 2) return null;
  const opponent = there.find(other => other.seat !== seat) ?? null;
  if (opponent && !entering && isSafe(trackIndex(seat, to))) return null;
  return { to, captured: opponent };
}

// Nobody passes a blockade, including its owner
function advance(state: GameState, seat: Seat, from: Progress, steps: number): Landing | null {
  const to = from + steps;
  if (to > HOME) return null;
  for (let progress = from + 1; progress < to; progress++) {
    const key = squareKey(seat, progress);
    if (key && occupants(state, key).length >= 2) return null;
  }
  return landOn(state, seat, to, false);
}

function placePawn(pawns: GameState['pawns'], seat: Seat, pawn: number, to: Progress, captured: PawnRef[]): GameState['pawns'] {
  const next = { ...pawns, [seat]: pawns[seat].map((progress, index) => index === pawn ? to : progress) };
  for (const ref of captured) next[ref.seat] = next[ref.seat].map((progress, index) => index === ref.pawn ? NEST : progress);
  return next;
}

function capturedBy(...landings: Landing[]): PawnRef[] {
  return landings.flatMap(({ captured }) => captured ? [captured] : []);
}

// The dice a move spends
function diceUsedBy(die: DieChoice): number[] {
  if (die === 'bonus') return [];
  return die === 'total' ? [0, 1] : [die];
}

type DieOption = { die: DieChoice; steps: number };

// Equal dice give the same moves, so only the first unused die of each value is offered.
// Two different dice can also move one pawn by their total.
function dieOptions(dice: Die[]): DieOption[] {
  const open = dice.flatMap((die, index) => die.used ? [] : [index]);
  const options: DieOption[] = open
    .filter((index, position) => open.findIndex(other => dice[other].value === dice[index].value) === position)
    .map(index => ({ die: index, steps: dice[index].value }));
  if (dice.length === 2 && open.length === 2 && !isDoubles(dice)) {
    options.push({ die: 'total', steps: dice[0].value + dice[1].value });
  }
  return options;
}

// Entering takes a 5, from one die or the total. The total moves a pawn one die at a time,
// so it lands (and may capture) after the first die; either die may go first.
function dieMove(state: GameState, seat: Seat, pawn: number, { die, steps }: DieOption): LegalMove | null {
  const from = state.pawns[seat][pawn];
  if (from === HOME || state.splitBlockades.includes(from)) return null;
  if (from === NEST) {
    const landing = steps === ENTER_ROLL ? landOn(state, seat, 0, true) : null;
    return landing && { pawn, die, steps, to: 0, captured: capturedBy(landing) };
  }
  if (die !== 'total') {
    const landing = advance(state, seat, from, steps);
    return landing && { pawn, die, steps, to: landing.to, captured: capturedBy(landing) };
  }
  for (const [first, second] of [state.dice, [...state.dice].reverse()]) {
    const middle = advance(state, seat, from, first.value);
    if (!middle) continue;
    const between = { ...state, pawns: placePawn(state.pawns, seat, pawn, middle.to, capturedBy(middle)) };
    const end = advance(between, seat, middle.to, second.value);
    if (end) return { pawn, die, steps, to: end.to, captured: capturedBy(middle, end) };
  }
  return null;
}

function dieMoves(state: GameState, seat: Seat): LegalMove[] {
  return dieOptions(state.dice).flatMap(option =>
    state.pawns[seat].flatMap((_, pawn) => dieMove(state, seat, pawn, option) ?? [])
  );
}

// A bonus moves one pawn already out of the nest by its whole amount
function bonusMoves(state: GameState, seat: Seat): LegalMove[] {
  if (state.bonuses.length === 0) return [];
  const steps = state.bonuses[0];
  return state.pawns[seat].flatMap((from, pawn) => {
    const landing = from === NEST || from === HOME ? null : advance(state, seat, from, steps);
    return landing ? [{ pawn, die: 'bonus' as const, steps, to: landing.to, captured: capturedBy(landing) }] : [];
  });
}

// The board, dice and bonuses after a legal move. On doubles, a pawn leaving its blockade keeps the other one there.
function settle(state: GameState, seat: Seat, { pawn, die, to, captured }: LegalMove): GameState {
  const from = state.pawns[seat][pawn];
  const splits = die !== 'bonus' && isDoubles(state.dice) && from !== NEST &&
    state.pawns[seat].filter(progress => progress === from).length === 2;
  const used = diceUsedBy(die);
  const earned = [...captured.map(() => CAPTURE_BONUS), ...(to === HOME ? [HOME_BONUS] : [])];
  return {
    ...state,
    pawns: placePawn(state.pawns, seat, pawn, to, captured),
    dice: state.dice.map((value, index) => used.includes(index) ? { ...value, used: true } : value),
    bonuses: [...(die === 'bonus' ? state.bonuses.slice(1) : state.bonuses), ...earned],
    splitBlockades: splits ? [...state.splitBlockades, from] : state.splitBlockades
  };
}

type Usage = { dice: number; pips: number };

function isBetter(a: Usage, b: Usage): boolean {
  return a.dice > b.dice || (a.dice === b.dice && a.pips > b.pips);
}

// How much of the roll a move leads to at best: the most dice, then the largest dice, over every order of play
function usageAfter(state: GameState, seat: Seat, move: LegalMove): Usage {
  const next = settle(state, seat, move);
  const open = next.dice.filter(die => !die.used).length;
  let best: Usage = { dice: 0, pips: 0 };
  for (const option of dieMoves(next, seat)) {
    const usage = usageAfter(next, seat, option);
    if (isBetter(usage, best)) best = usage;
    if (best.dice === open) break; // every die is used, so no order uses more
  }
  return { dice: diceUsedBy(move.die).length + best.dice, pips: move.steps + best.pips };
}

// Every die that can be used must be: a move must keep the most dice usable, and when not all can be, the larger.
// Bonuses come only after the dice.
export function getLegalMoves(state: GameState, seat: Seat): LegalMove[] {
  if (!state.pawns[seat]) return [];
  const scored = dieMoves(state, seat).map(move => ({ move, usage: usageAfter(state, seat, move) }));
  if (scored.length === 0) return bonusMoves(state, seat);
  const best = scored.reduce((top, { usage }) => isBetter(usage, top) ? usage : top, scored[0].usage);
  return scored.filter(({ usage }) => !isBetter(best, usage)).map(({ move }) => move);
}

export function describeLastMove({ playerNumber, from, to, steps, captured }: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[playerNumber];
  let text = from === NEST ? `${name} entered a pawn`
    : to === HOME ? `${name} moved a pawn home (+${HOME_BONUS})`
      : `${name} moved a pawn ${steps} ${steps === 1 ? 'square' : 'squares'}`;
  for (const { seat } of captured) text += ` and captured ${playerNames[seat]}'s pawn (+${CAPTURE_BONUS})`;
  return text;
}

function rollDie(random: Random): number {
  return Math.min(DIE_FACES, 1 + Math.floor(random() * DIE_FACES));
}

// Three doubles in a row send the pawn closest to home (on the track or in the home column) back to the nest
function sendFurthestHome(state: GameState, seat: Seat): GameState {
  const pawns = state.pawns[seat];
  const furthest = pawns.reduce((best, progress, pawn) =>
    progress !== NEST && progress !== HOME && (best < 0 || progress > pawns[best]) ? pawn : best, -1);
  if (furthest < 0) return state;
  return { ...state, pawns: { ...state.pawns, [seat]: pawns.map((progress, pawn) => pawn === furthest ? NEST : progress) } };
}

// Rolls for `seat` and, while the roll gives no move, passes the turn on.
// Doubles with all four pawns out of the nest also give the two faces underneath.
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
      roller = nextPlayer(next, roller) ?? roller;
      doubles = 0;
      continue;
    }

    const underneath = isDouble && next.pawns[roller].every(progress => progress !== NEST)
      ? [OPPOSITE_FACES - values[0], OPPOSITE_FACES - values[0]] : [];
    next = {
      ...next,
      currentPlayer: roller,
      roller,
      dice: [...values, ...underneath].map(value => ({ value, used: false })),
      bonuses: [],
      doublesRolled: doubles,
      splitBlockades: []
    };
    let rolled = `${name} rolled ${values[0]} and ${values[1]}`;
    if (underneath.length > 0) rolled += ` with ${underneath[0]} and ${underneath[1]} underneath`;
    if (getLegalMoves(next, roller).length > 0) {
      status.push(isDouble ? `${rolled}, doubles, and rolls again if every die is used` : rolled);
      break;
    }
    status.push(`${rolled} and cannot move`);
    roller = nextPlayer(next, roller) ?? roller;
    doubles = 0;
  }
  return { ...next, gameStatus: status.join('. ') };
}

// Each player rolls one die and the lowest roll goes first; players tied for lowest roll again
function rollOff(state: GameState, random: Random): { first: Seat; status: string } {
  let contenders = state.activePlayers;
  const rounds: string[] = [];
  for (let round = 0; round < MAX_ROLLS && contenders.length > 1; round++) {
    const rolled = contenders.map(seat => ({ seat, value: rollDie(random) }));
    const lowest = Math.min(...rolled.map(({ value }) => value));
    rounds.push(rolled.map(({ seat, value }) => `${state.playerNames[seat]} ${value}`).join(', '));
    contenders = rolled.filter(({ value }) => value === lowest).map(({ seat }) => seat);
  }
  const first = contenders[0];
  return { first, status: `Lowest roll goes first: ${rounds.join('; tie: ')}. ${state.playerNames[first]} goes first` };
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId), pawns: {}, dice: [], bonuses: [], roller: null, doublesRolled: 0, splitBlockades: [], lastMove: null
  };
}

// Before the first move every pawn is in its nest, and once two players are seated the roll-off has picked who rolls first
export function resetLobby(state: GameState, random: Random): GameState {
  const reset: GameState = {
    ...state,
    pawns: Object.fromEntries(state.activePlayers.map(seat => [seat, Array<Progress>(PAWN_COUNT).fill(NEST)])),
    dice: [],
    bonuses: [],
    roller: null,
    doublesRolled: 0,
    splitBlockades: [],
    lastMove: null
  };
  if (state.activePlayers.length < 2) return reset;
  const { first, status } = rollOff(reset, random);
  return startTurn(reset, first, 0, random, [state.gameStatus, status]);
}

// The leaver's pawns come off the board; if it was their turn, the player on their left rolls
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const pawns = { ...state.pawns };
  delete pawns[seat];
  const next = { ...state, pawns };
  if (next.currentPlayer === null || next.roller !== seat) return next;
  return startTurn(next, nextPlayer(next, seat) ?? next.currentPlayer, 0, random, [next.gameStatus]);
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'move') return { error: 'Unknown move type' };
  const legal = getLegalMoves(state, seat).find(option => option.pawn === input.pawn && option.die === input.die);
  if (!legal) return { error: 'Invalid move' };

  const { pawn, steps, to, captured } = legal;
  const lastMove: LastMove = { playerNumber: seat, pawn, from: state.pawns[seat][pawn], to, steps, captured };
  let next: GameState = { ...settle(state, seat, legal), lastMove, gameStatus: describeLastMove(lastMove, state.playerNames) };

  if (next.pawns[seat].every(progress => progress === HOME)) {
    return { state: { ...next, isGameOver: true, winners: [seat], currentPlayer: null, gameStatus: `${state.playerNames[seat]} wins!` } };
  }
  // Bonuses are taken oldest first, so one no pawn can move is lost, but a later one may still fit
  while (next.bonuses.length > 0 && getLegalMoves(next, seat).length === 0) next = { ...next, bonuses: next.bonuses.slice(1) };
  if (getLegalMoves(next, seat).length > 0) return { state: next };

  // The turn is over: doubles roll again only if every die was used, anything else passes the dice on
  const rollsAgain = isDoubles(next.dice) && next.dice.every(die => die.used);
  const roller = rollsAgain ? seat : nextPlayer(next, seat) ?? seat;
  return { state: startTurn(next, roller, rollsAgain ? next.doublesRolled : 0, random, [next.gameStatus]) };
}
