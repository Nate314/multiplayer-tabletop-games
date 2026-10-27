// Backgammon rules shared by the browser (legal move hints) and the server (validation).
import { rankStandings } from '../../shared/standings.ts';
import { rollDie } from '../../shared/dice.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import type { Random, Standing } from '../../shared/types.ts';
import type { GameState, LastMove, PointStack, Position, PublicGameState, Result, Seat, Step } from './types.ts';

export const POINT_COUNT = 24;
export const CHECKERS_PER_PLAYER = 15;
const HOME_SIZE = 6;

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

// Distinct values, smallest first, so a bear-off that two dice could make uses the smaller one by default
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

// A turn starts with a roll or a double; once the dice are rolled, only checker moves remain
export function canRoll(state: Pick<GameState, 'remaining' | 'doubleOffer'>): boolean {
  return state.doubleOffer === null && state.remaining.length === 0;
}

// The cube's owner may double, or either player while it is in the middle
export function canDouble(state: Pick<GameState, 'remaining' | 'doubleOffer' | 'cubeOwner'>, seat: Seat): boolean {
  return canRoll(state) && (state.cubeOwner === null || state.cubeOwner === seat);
}

export function pointsText(points: number): string {
  return `${points} ${points === 1 ? 'point' : 'points'}`;
}

// One line about a move, with points numbered from the mover's side
export function moveText(name: string, lastMove: LastMove): string {
  if (lastMove.type === 'roll') return `${name} rolled ${lastMove.dice.join(' and ')}${lastMove.blocked ? ' and could not move' : ''}`;
  if (lastMove.type === 'double') return `${name} offered to double to ${lastMove.cube}`;
  if (lastMove.type === 'take') return `${name} took the double. The cube is at ${lastMove.cube}`;
  if (lastMove.type === 'drop') return `${name} dropped the double`;
  const { playerNumber, from, to, hit } = lastMove;
  const text = from === 'bar'
    ? `${name} entered on ${pointNumber(playerNumber, to as number)}`
    : to === 'off'
      ? `${name} bore off from ${pointNumber(playerNumber, from)}`
      : `${name} moved ${pointNumber(playerNumber, from)} to ${pointNumber(playerNumber, to)}`;
  return hit ? `${text} and hit` : text;
}

// A single game is worth the cube's value, a gammon (the loser has borne off nothing) twice that, and a
// backgammon (the loser also still has a checker on the bar or in the winner's home board) three times
function winKind(position: Position, winner: Seat): { multiplier: number; kind: string } {
  const loser = otherSeat(winner);
  if (position.borneOff[loser] > 0) return { multiplier: 1, kind: '' };
  const stuckBehind = position.bar[loser] > 0 || position.points.some((point, index) =>
    point?.seat === loser && pointNumber(winner, index) <= HOME_SIZE
  );
  return stuckBehind ? { multiplier: 3, kind: ' with a backgammon' } : { multiplier: 2, kind: ' with a gammon' };
}

function gameWon(state: GameState, winner: Seat, points: number, kind = ''): GameState {
  const gameStatus = `${state.gameStatus}. ${state.playerNames[winner]} wins${kind}: ${pointsText(points)}!`;
  return { ...state, remaining: [], isGameOver: true, winners: [winner], pointsWon: points, gameStatus };
}

// The other player's turn starts with no dice: they roll, or double first
function passTurn(state: GameState, seat: Seat): GameState {
  return { ...state, currentPlayer: otherSeat(seat), dice: [], remaining: [] };
}

// Each player rolls one die, again on a tie; the higher roller moves first with both numbers, so never a double
function openingRoll(state: GameState, random: Random): GameState {
  const [first, second] = state.activePlayers;
  let rolls: number[];
  do rolls = [rollDie(random), rollDie(random)]; while (rolls[0] === rolls[1]);
  const opener = rolls[0] > rolls[1] ? first : second;
  const dice = [Math.max(...rolls), Math.min(...rolls)];
  const { playerNames } = state;
  const opening = `${playerNames[first]} rolled ${rolls[0]} and ${playerNames[second]} rolled ${rolls[1]}, ` +
    `so ${playerNames[opener]} moves first`;
  const gameStatus = [state.gameStatus, opening].filter(Boolean).join('. ');
  return { ...state, currentPlayer: opener, dice, remaining: dice, gameStatus };
}

// Everything a new game starts with besides the seats: the cube in the middle at 1 and no dice yet
function freshGame(seats: Seat[]) {
  return { ...startingPosition(seats), dice: [], remaining: [], cube: 1, cubeOwner: null, doubleOffer: null, pointsWon: 0, lastMove: null };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...freshGame([]) };
}

// Before the first move, every seat's checkers are in the opening layout and, with two players seated, the opening roll is made
export function resetLobby(state: GameState, random: Random): GameState {
  const fresh: GameState = { ...state, ...freshGame(state.activePlayers) };
  return state.activePlayers.length === 2 ? openingRoll(fresh, random) : fresh;
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

function withLastMove(state: GameState, lastMove: LastMove): GameState {
  return { ...state, lastMove, gameStatus: moveText(state.playerNames[lastMove.playerNumber], lastMove) };
}

// A roll the player cannot use at all passes the turn
function roll(state: GameState, seat: Seat, random: Random): Result<GameState> {
  if (!canRoll(state)) return { error: 'You cannot roll now' };
  const dice = [rollDie(random), rollDie(random)];
  const remaining = diceToPlay(dice);
  const blocked = maxDiceUsable(state, seat, remaining) === 0;
  const next = withLastMove({ ...state, dice, remaining }, { type: 'roll', playerNumber: seat, dice, blocked });
  return { state: blocked ? passTurn(next, seat) : next };
}

// The opponent answers the offer before the doubler rolls
function double(state: GameState, seat: Seat): Result<GameState> {
  if (!canDouble(state, seat)) return { error: 'You cannot double now' };
  const next = withLastMove(state, { type: 'double', playerNumber: seat, cube: state.cube * 2 });
  return { state: { ...next, doubleOffer: seat, currentPlayer: otherSeat(seat) } };
}

// Taking doubles the stake and gives the taker the cube; the doubler then rolls
function take(state: GameState, seat: Seat, doubler: Seat): GameState {
  const cube = state.cube * 2;
  const next = withLastMove(state, { type: 'take', playerNumber: seat, cube });
  return { ...next, cube, cubeOwner: seat, doubleOffer: null, currentPlayer: doubler };
}

// Dropping concedes the game at the cube's value before the double
function drop(state: GameState, seat: Seat, doubler: Seat): GameState {
  const next = withLastMove(state, { type: 'drop', playerNumber: seat, cube: state.cube });
  return gameWon({ ...next, doubleOffer: null }, doubler, state.cube);
}

function answerDouble(state: GameState, seat: Seat, answer: unknown): Result<GameState> {
  const doubler = state.doubleOffer;
  if (doubler === null) return { error: 'No double has been offered' };
  return { state: answer === 'take' ? take(state, seat, doubler) : drop(state, seat, doubler) };
}

function moveChecker(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  if (state.remaining.length === 0) return { error: 'Roll the dice first' };

  // Steps come smallest die first, so without `die` a bear-off that two dice could make uses the smaller one
  const step = legalSteps(state, seat).find(legal =>
    legal.from === input.from && legal.to === input.to && (input.die === undefined || legal.die === input.die)
  );
  if (!step) return { error: 'Invalid move' };

  const position = applyStep(state, seat, step);
  const remaining = withoutOne(state.remaining, step.die);
  const next = withLastMove({ ...state, ...position, remaining },
    { type: 'move', playerNumber: seat, from: step.from, to: step.to, hit: isHit(state, seat, step) });

  if (position.borneOff[seat] === CHECKERS_PER_PLAYER) {
    const { multiplier, kind } = winKind(position, seat);
    return { state: gameWon(next, seat, state.cube * multiplier, kind) };
  }
  return { state: maxDiceUsable(position, seat, remaining) > 0 ? next : passTurn(next, seat) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const input = asRecord(move);
  switch (input?.type) {
    case 'roll': return roll(state, seat, random);
    case 'double': return double(state, seat);
    case 'take':
    case 'drop': return answerDouble(state, seat, input.type);
    case 'move': return moveChecker(state, seat, input);
    default: return { error: 'Unknown move type' };
  }
}

// Only the winner has a score, the points the game was worth
export function finalStandings(state: GameState): Standing[] {
  return rankStandings(state, () => 0, seat => (state.winners.includes(seat) ? pointsText(state.pointsWon ?? 0) : undefined));
}
