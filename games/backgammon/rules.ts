// Backgammon rules shared by the browser (legal move hints) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, LastMove, PointStack, Position, PublicGameState, Result, Seat, Step } from './types.ts';

export const POINT_COUNT = 24;
export const CHECKERS_PER_PLAYER = 15;
const HOME_SIZE = 6;

// Enough to rule out a run of bad rolls; only a position where neither player can ever move reaches it
const MAX_PASSES = 50;

// The standard opening layout, as point numbers counted from the owner's side (their checkers bear off past point 1)
const START_LAYOUT: Record<number, number> = { 24: 2, 13: 5, 8: 3, 6: 5 };

export const CHECKER_COLORS: Record<Seat, string> = { 1: 'white', 2: 'red' };

// A point's number as its owner counts it: 1 to 6 is their home board, 24 is where their back checkers start
export function pointNumber(seat: Seat, index: number): number {
  return seat === 1 ? index + 1 : POINT_COUNT - index;
}

export function pointIndex(seat: Seat, number: number): number {
  return seat === 1 ? number - 1 : POINT_COUNT - number;
}

export function otherSeat(seat: Seat): Seat {
  return seat === 1 ? 2 : 1;
}

export function startingPosition(seats: Seat[]): Position {
  const points: (PointStack | null)[] = Array(POINT_COUNT).fill(null);
  for (const seat of seats) {
    for (const [number, count] of Object.entries(START_LAYOUT)) {
      points[pointIndex(seat, Number(number))] = { seat, count };
    }
  }
  return {
    points,
    bar: Object.fromEntries(seats.map(seat => [seat, 0])),
    borneOff: Object.fromEntries(seats.map(seat => [seat, 0]))
  };
}

// Doubles are played four times
export function diceToPlay(dice: number[]): number[] {
  return dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [...dice];
}

function rollDice(random: Random): number[] {
  return [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
}

function isOpenFor(point: PointStack | null, seat: Seat): boolean {
  return !point || point.seat === seat || point.count === 1;
}

function allHome(position: Position, seat: Seat): boolean {
  return position.bar[seat] === 0 && position.points.every((point, index) =>
    point?.seat !== seat || pointNumber(seat, index) <= HOME_SIZE
  );
}

function hasCheckerAbove(position: Position, seat: Seat, number: number): boolean {
  return position.points.some((point, index) => point?.seat === seat && pointNumber(seat, index) > number);
}

// Every way to move one checker with one die, ignoring the rule to use as many dice as possible
function singleSteps(position: Position, seat: Seat, die: number): Step[] {
  if (position.bar[seat] > 0) {
    const to = pointIndex(seat, POINT_COUNT + 1 - die);
    return isOpenFor(position.points[to], seat) ? [{ from: 'bar', to, die }] : [];
  }

  const bearingOff = allHome(position, seat);
  const steps: Step[] = [];
  position.points.forEach((point, from) => {
    if (point?.seat !== seat) return;
    const number = pointNumber(seat, from);
    if (number > die) {
      const to = pointIndex(seat, number - die);
      if (isOpenFor(position.points[to], seat)) steps.push({ from, to, die });
    } else if (bearingOff && (number === die || !hasCheckerAbove(position, seat, number))) {
      // An exact die bears off; a higher die only from the highest occupied point
      steps.push({ from, to: 'off', die });
    }
  });
  return steps;
}

export function isHit(position: Position, seat: Seat, step: Step): boolean {
  if (step.to === 'off') return false;
  const target = position.points[step.to];
  return target !== null && target.seat !== seat;
}

export function applyStep(position: Position, seat: Seat, step: Step): Position {
  const points = [...position.points];
  const bar = { ...position.bar };
  const borneOff = { ...position.borneOff };

  if (step.from === 'bar') {
    bar[seat]--;
  } else {
    const source = points[step.from] as PointStack; // A legal step starts on one of the mover's points
    points[step.from] = source.count > 1 ? { seat, count: source.count - 1 } : null;
  }

  if (step.to === 'off') {
    borneOff[seat]++;
  } else {
    const target = points[step.to];
    if (target && target.seat !== seat) bar[target.seat]++;
    points[step.to] = { seat, count: target?.seat === seat ? target.count + 1 : 1 };
  }

  return { points, bar, borneOff };
}

function withoutOne(dice: number[], die: number): number[] {
  const index = dice.indexOf(die);
  return [...dice.slice(0, index), ...dice.slice(index + 1)];
}

// Distinct values, smallest first, so a bear-off that two dice could make uses the smaller one
function distinctDice(dice: number[]): number[] {
  return [...new Set(dice)].sort((a, b) => a - b);
}

// The most of `dice` that can be played in some order from this position
export function maxDiceUsable(position: Position, seat: Seat, dice: number[]): number {
  let best = 0;
  for (const die of distinctDice(dice)) {
    for (const step of singleSteps(position, seat, die)) {
      best = Math.max(best, 1 + maxDiceUsable(applyStep(position, seat, step), seat, withoutOne(dice, die)));
      if (best === dice.length) return best;
    }
  }
  return best;
}

// The checker moves allowed now: each must leave the most dice playable, and when only one of two
// different dice can be played, the higher one must be played if it can be
export function legalSteps(state: Position & { remaining: number[] }, seat: Seat): Step[] {
  const { remaining } = state;
  const best = maxDiceUsable(state, seat, remaining);
  if (best === 0) return [];

  const steps = distinctDice(remaining)
    .flatMap(die => singleSteps(state, seat, die))
    .filter(step => 1 + maxDiceUsable(applyStep(state, seat, step), seat, withoutOne(remaining, step.die)) === best);

  const higher = Math.max(...remaining);
  if (best === 1 && distinctDice(remaining).length === 2 && steps.some(step => step.die === higher)) {
    return steps.filter(step => step.die === higher);
  }
  return steps;
}

// One line about a checker move, with points numbered from the mover's side
export function moveText(name: string, { playerNumber, from, to, hit }: LastMove): string {
  const fromNumber = from === 'bar' ? 0 : pointNumber(playerNumber, from);
  const text = from === 'bar'
    ? `${name} entered on ${pointNumber(playerNumber, to as number)}`
    : to === 'off'
      ? `${name} bore off from ${fromNumber}`
      : `${name} moved ${fromNumber} to ${pointNumber(playerNumber, to)}`;
  return hit ? `${text} and hit` : text;
}

// A gammon when the loser has borne off nothing, a backgammon when they also still have a checker on the bar or in the winner's home board
function winText(position: Position, winner: Seat, name: string): string {
  const loser = otherSeat(winner);
  if (position.borneOff[loser] > 0) return `${name} wins!`;
  const stuckBehind = position.bar[loser] > 0 || position.points.some((point, index) =>
    point?.seat === loser && pointNumber(winner, index) <= HOME_SIZE
  );
  return `${name} wins with a ${stuckBehind ? 'backgammon' : 'gammon'}!`;
}

// Rolls for `seat`; a player who cannot use their roll passes, and the roll goes to the next player
function startTurn(state: GameState, seat: Seat, random: Random): GameState {
  const passes: string[] = [];
  let player = seat;
  for (let attempt = 0; attempt < MAX_PASSES; attempt++) {
    const dice = rollDice(random);
    const remaining = diceToPlay(dice);
    if (maxDiceUsable(state, player, remaining) > 0) {
      const gameStatus = [state.gameStatus, ...passes].filter(Boolean).join('. ');
      return { ...state, currentPlayer: player, dice, remaining, gameStatus };
    }
    passes.push(`${state.playerNames[player]} rolled ${dice.join(' and ')} and could not move`);
    player = nextActivePlayer(state, player) ?? player;
  }
  return { ...state, dice: [], remaining: [], isGameOver: true, gameStatus: 'Neither player can move. The game is a draw.' };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...startingPosition([]), dice: [], remaining: [], lastMove: null };
}

// Before the first move, every seat's checkers are in the opening layout and, with two players seated, the first player has rolled
export function resetLobby(state: GameState, random: Random): GameState {
  const fresh: GameState = { ...state, ...startingPosition(state.activePlayers), dice: [], remaining: [], lastMove: null };
  return state.activePlayers.length === 2 && fresh.currentPlayer !== null
    ? startTurn(fresh, fresh.currentPlayer, random)
    : fresh;
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'move') return { error: 'Unknown move type' };

  // Steps come smallest die first, so a bear-off that two dice could make keeps the higher die
  const step = legalSteps(state, seat).find(legal => legal.from === input.from && legal.to === input.to);
  if (!step) return { error: 'Invalid move' };

  const name = state.playerNames[seat];
  const lastMove: LastMove = { playerNumber: seat, from: step.from, to: step.to, hit: isHit(state, seat, step) };
  const position = applyStep(state, seat, step);
  const remaining = withoutOne(state.remaining, step.die);
  const next: GameState = { ...state, ...position, remaining, lastMove, gameStatus: moveText(name, lastMove) };

  if (position.borneOff[seat] === CHECKERS_PER_PLAYER) {
    return { state: { ...next, remaining: [], isGameOver: true, winners: [seat], gameStatus: winText(position, seat, name) } };
  }
  if (maxDiceUsable(position, seat, remaining) > 0) return { state: next };
  const following = nextActivePlayer(next, seat) ?? seat;
  return { state: startTurn(next, following, random) };
}
