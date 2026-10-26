// Yahtzee rules shared by the browser (score hints) and the server (validation).
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { rollDie } from '../../shared/dice.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Random, Standing } from '../../shared/types.ts';
import type { Category, GameState, LastMove, PublicGameState, Result, Seat, Sheet } from './types.ts';

export const DICE_COUNT = 5;
export const ROLLS_PER_TURN = 3;
export const UPPER_BONUS = 35;
export const UPPER_BONUS_AT = 63;
export const YAHTZEE_BONUS = 100;

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const satisfies Category[];
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'] as const satisfies Category[];
export const CATEGORIES: Category[] = [...UPPER, ...LOWER];

export const CATEGORY_LABELS: Record<Category, string> = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  threeKind: 'Three of a kind', fourKind: 'Four of a kind', fullHouse: 'Full house',
  smallStraight: 'Small straight', largeStraight: 'Large straight', yahtzee: 'Yahtzee', chance: 'Chance'
};

const isUpper = (category: Category) => (UPPER as readonly Category[]).includes(category);
const sum = (dice: number[]) => dice.reduce((total, die) => total + die, 0);
const countOf = (dice: number[], face: number) => dice.filter(die => die === face).length;

export function isYahtzee(dice: number[]): boolean {
  return dice.length === DICE_COUNT && dice.every(die => die === dice[0]);
}

// Dice in a row, e.g. 4 for 1-2-3-4
function longestRun(dice: number[]): number {
  let best = 0;
  let run = 0;
  for (let face = 1; face <= 6; face++) {
    run = dice.includes(face) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

// A Yahtzee when the Yahtzee box is already filled, whether with 50 or a scratched 0
function isJoker(dice: number[], sheet: Sheet): boolean {
  return isYahtzee(dice) && sheet.yahtzee !== undefined;
}

// The points these dice would score in a box; under the Joker rule full house and the straights score in full
export function scoreFor(dice: number[], category: Category, sheet: Sheet): number {
  const joker = isJoker(dice, sheet);
  const faces = [1, 2, 3, 4, 5, 6].map(face => countOf(dice, face));
  switch (category) {
    case 'ones': case 'twos': case 'threes': case 'fours': case 'fives': case 'sixes': {
      const face = UPPER.indexOf(category) + 1;
      return face * countOf(dice, face);
    }
    case 'threeKind': return Math.max(...faces) >= 3 ? sum(dice) : 0;
    case 'fourKind': return Math.max(...faces) >= 4 ? sum(dice) : 0;
    case 'fullHouse': return joker || (faces.includes(3) && faces.includes(2)) ? 25 : 0;
    case 'smallStraight': return joker || longestRun(dice) >= 4 ? 30 : 0;
    case 'largeStraight': return joker || longestRun(dice) >= 5 ? 40 : 0;
    case 'yahtzee': return isYahtzee(dice) ? 50 : 0;
    case 'chance': return sum(dice);
  }
}

// The empty boxes these dice may be scored in. A Joker (a further Yahtzee) must go in its Upper box, else any
// empty lower box, else a zero in an empty upper box.
export function allowedCategories(dice: number[], sheet: Sheet): Category[] {
  const open = CATEGORIES.filter(category => sheet[category] === undefined);
  if (!isJoker(dice, sheet)) return open;
  const matching = UPPER[dice[0] - 1];
  if (open.includes(matching)) return [matching];
  const lower = open.filter(category => !isUpper(category));
  return lower.length > 0 ? lower : open;
}

export function totals(sheet: Sheet, bonuses = 0) {
  const sumOf = (categories: readonly Category[]) => categories.reduce((total, category) => total + (sheet[category] ?? 0), 0);
  const upper = sumOf(UPPER);
  const upperBonus = upper >= UPPER_BONUS_AT ? UPPER_BONUS : 0;
  const lower = sumOf(LOWER);
  const yahtzeeBonus = bonuses * YAHTZEE_BONUS;
  return { upper, upperBonus, lower, yahtzeeBonus, total: upper + upperBonus + lower + yahtzeeBonus };
}

// A player with no sheet yet has no points
const grandTotal = (state: GameState, seat: Seat) => (state.sheets[seat] ? totals(state.sheets[seat], state.yahtzeeBonuses[seat]).total : 0);

const isFilled = (sheet: Sheet) => CATEGORIES.every(category => sheet[category] !== undefined);

// 1 to 13: the round the player is in, by how many boxes they have filled
export function roundOf(sheet: Sheet): number {
  return Math.min(CATEGORIES.filter(category => sheet[category] !== undefined).length + 1, CATEGORIES.length);
}

export function moveText(name: string, lastMove: LastMove): string {
  if (lastMove.type === 'roll') return `${name} rolled ${lastMove.dice.join(' ')}, ${lastMove.rollsLeft} ${lastMove.rollsLeft === 1 ? 'roll' : 'rolls'} left`;
  const points = `${lastMove.points} ${lastMove.points === 1 ? 'point' : 'points'}`;
  return `${name} scored ${points} in ${CATEGORY_LABELS[lastMove.category]}${lastMove.bonus ? ' and a 100 point Yahtzee bonus' : ''}`;
}

function freshTurn() {
  return { dice: [], held: [], rollsLeft: ROLLS_PER_TURN };
}

function freshGame(seats: Seat[]) {
  return {
    ...freshTurn(),
    sheets: Object.fromEntries(seats.map(seat => [seat, {}])),
    yahtzeeBonuses: Object.fromEntries(seats.map(seat => [seat, 0])),
    lastMove: null
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...freshGame([]) };
}

export function resetLobby(state: GameState): GameState {
  return { ...state, ...freshGame(state.activePlayers) };
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

// The game is over when every player still seated has filled all 13 boxes; the highest total wins and ties share
function finishIfDone(state: GameState): GameState {
  if (!state.activePlayers.every(seat => isFilled(state.sheets[seat]))) return state;
  const grand = (seat: Seat) => grandTotal(state, seat);
  const best = Math.max(...state.activePlayers.map(grand));
  const winners = state.activePlayers.filter(seat => grand(seat) === best);
  const names = winners.map(seat => state.playerNames[seat]).join(' and ');
  return { ...state, ...freshTurn(), currentPlayer: null, isGameOver: true, winners, gameStatus: `${state.gameStatus}. ${names} won with ${best} points!` };
}

// A dismissed player's unfinished turn is dropped; the platform has already moved the turn on
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const droppedTurn = state.dice.length > 0 && state.lastMove?.playerNumber === seat;
  return finishIfDone(droppedTurn ? { ...state, ...freshTurn() } : state);
}

function roll(state: GameState, seat: Seat, input: Record<string, unknown>, random: Random): Result<GameState> {
  const { hold } = input;
  if (!Array.isArray(hold) || hold.length !== DICE_COUNT || !hold.every(flag => typeof flag === 'boolean')) return { error: 'Invalid move' };
  if (state.rollsLeft === 0) return { error: 'No rolls left: score a box' };
  const first = state.dice.length === 0;
  if (!first && hold.every(Boolean)) return { error: 'Leave at least one die to roll' };

  const held = first ? Array<boolean>(DICE_COUNT).fill(false) : hold;
  const dice = Array.from({ length: DICE_COUNT }, (_, index) => held[index] ? state.dice[index] : rollDie(random));
  const rollsLeft = state.rollsLeft - 1;
  const lastMove: LastMove = { type: 'roll', playerNumber: seat, dice, rollsLeft };
  return { state: { ...state, dice, held, rollsLeft, lastMove, gameStatus: moveText(state.playerNames[seat], lastMove) } };
}

function score(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  const category = CATEGORIES.find(candidate => candidate === input.category);
  if (!category) return { error: 'Invalid move' };
  if (state.dice.length === 0) return { error: 'Roll the dice first' };
  const sheet = state.sheets[seat];
  if (sheet[category] !== undefined) return { error: 'That box is already filled' };
  if (!allowedCategories(state.dice, sheet).includes(category)) {
    const matching = UPPER[state.dice[0] - 1];
    return { error: `Joker rule: score the Yahtzee in ${sheet[matching] === undefined ? CATEGORY_LABELS[matching] : 'a lower box'}` };
  }

  const points = scoreFor(state.dice, category, sheet);
  const bonus = isYahtzee(state.dice) && sheet.yahtzee === 50;
  const lastMove: LastMove = { type: 'score', playerNumber: seat, category, points, bonus, dice: state.dice };
  const next: GameState = {
    ...state,
    ...freshTurn(),
    sheets: { ...state.sheets, [seat]: { ...sheet, [category]: points } },
    yahtzeeBonuses: { ...state.yahtzeeBonuses, [seat]: state.yahtzeeBonuses[seat] + (bonus ? 1 : 0) },
    lastMove,
    gameStatus: moveText(state.playerNames[seat], lastMove),
    currentPlayer: nextActivePlayer(state, seat)
  };
  return { state: finishIfDone(next) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const input = asRecord(move);
  switch (input?.type) {
    case 'roll': return roll(state, seat, input, random);
    case 'score': return score(state, seat, input);
    default: return { error: 'Invalid move' };
  }
}

export function finalStandings(state: GameState): Standing[] {
  return rankStandings(state, (a, b) => grandTotal(state, b) - grandTotal(state, a), seat => pointsText(grandTotal(state, seat)));
}
