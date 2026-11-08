// The Road to Retirement board's rules: route, spins along the road, landings, loans and retirement
import { rankStandings } from '../../shared/standings.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Standing } from '../../shared/types.ts';
import { CAREERS, HOUSES, careerOf, houseOf } from './content.ts';
import { lengthOf, startingCashOf } from './options.ts';
import { MID_FORK, ROAD, START_FORK, isStop, nextSpace } from './road.ts';
import type { GameState, Move, Random, Result, RoadPhase, RoadPlayer, RoadState, Seat } from './types.ts';

export const LOAN_UNIT = 20000;
export const LOAN_REPAY = 25000; // each loan, repaid at retirement
export const COLLEGE_COST = 50000;
export const CHILD_BONUS = 25000;
export const riskAmount = (spun: number): number => (spun <= 4 ? -20000 : spun <= 7 ? 0 : 50000);

export const spin = (random: Random): number => Math.floor(random() * 10) + 1;
export const money = (amount: number): string => `${amount < 0 ? '-' : ''}$${Math.abs(amount).toLocaleString('en-US')}`;

// A negative amount is a gain; a shortfall takes as many whole loans as it needs
export function charge(player: RoadPlayer, amount: number): RoadPlayer {
  const cash = player.cash - amount;
  const loans = cash < 0 ? Math.ceil(-cash / LOAN_UNIT) : 0;
  return { ...player, cash: cash + loans * LOAN_UNIT, loans: player.loans + loans };
}

const worthOf = (player: RoadPlayer): number => player.cash
  + player.houses.reduce((sum, id) => sum + (houseOf(id)?.saleValue ?? 0), 0)
  + player.children * CHILD_BONUS - player.loans * LOAN_REPAY;

export const retire = (player: RoadPlayer): RoadPlayer => ({ ...player, retired: true, worth: worthOf(player) });

const freshPlayer = (cash: number): RoadPlayer => ({
  space: 0, cash, loans: 0, career: null, degree: false, houses: [], partner: false, children: 0, retired: false, worth: null
});

export function startRoad(state: GameState): GameState {
  const cash = startingCashOf(state);
  const players = Object.fromEntries(state.activePlayers.map(seat => [seat, freshPlayer(cash)]));
  return { ...state, board: 'road', road: { players, phase: 'route', stepsLeft: 0, offer: [] }, checkered: null, spin: null, lastMove: null };
}

// One move in progress: the mover's record changes in place and every event is noted in order
type Turn = { state: GameState; seat: Seat; player: RoadPlayer; events: string[]; phase: RoadPhase; stepsLeft: number; offer: string[] };

function pay(turn: Turn, amount: number): void {
  const before = turn.player.loans;
  turn.player = charge(turn.player, amount);
  const taken = turn.player.loans - before;
  if (taken > 0) turn.events.push(`took ${taken} loan${taken === 1 ? '' : 's'} of ${money(LOAN_UNIT)}`);
}

const pickTwo = (ids: string[], random: Random): string[] => shuffle(ids, random).slice(0, 2);

function offerCareers(turn: Turn, random: Random, degreeOnly: boolean): void {
  const allowed = CAREERS.filter(c => (degreeOnly ? c.degree : !c.degree || turn.player.degree) && c.id !== turn.player.career);
  turn.offer = pickTwo(allowed.map(c => c.id), random);
  turn.phase = 'career';
}

function land(turn: Turn, random: Random): void {
  const space = ROAD[turn.player.space];
  const p = turn.player;
  switch (space.kind) {
    case 'job':
      turn.events.push('landed on a job');
      offerCareers(turn, random, false);
      break;
    case 'graduation':
      turn.events.push('graduated');
      turn.player = { ...p, degree: true };
      offerCareers(turn, random, true);
      break;
    case 'event':
      // a clause inside the status line, with what it pays or costs
      turn.events.push(`landed on an event: ${space.text!.replace(/\.$/, '')} (${space.amount! > 0 ? '+' : ''}${money(space.amount!)})`);
      pay(turn, -space.amount!);
      break;
    case 'house':
    case 'houseStop': {
      const owned = Object.values(turn.state.road!.players).flatMap(other => other.houses);
      const free = HOUSES.filter(h => !owned.includes(h.id)).map(h => h.id);
      turn.events.push('landed on a house');
      if (free.length > 0) [turn.offer, turn.phase] = [pickTwo(free, random), 'house'];
      else turn.events.push('but every house is taken');
      break;
    }
    case 'family':
    case 'marriage':
      if (!p.partner) {
        turn.player = { ...p, partner: true };
        turn.events.push('found a partner');
      } else if (space.kind === 'family') {
        turn.player = { ...p, children: p.children + 1 };
        turn.events.push('had a child');
      }
      break;
    case 'risk': {
      const spun = spin(random);
      const amount = riskAmount(spun);
      turn.events.push(`spun ${spun} on a risk`, amount < 0 ? `lost ${money(-amount)}` : amount > 0 ? `won ${money(amount)}` : 'broke even');
      pay(turn, -amount);
      break;
    }
    case 'retirement':
      turn.player = retire(p);
      turn.events.push(`retired with ${money(turn.player.worth!)}`);
      break;
    default: // payday is paid on the way, start and the fork do nothing
  }
}

// Steps one space at a time, pausing at the mid fork until a road is chosen, stopping on a stop space
function walk(turn: Turn, steps: number, random: Random, road?: 'safe' | 'fast'): void {
  const length = lengthOf(turn.state);
  let at = turn.player.space;
  for (; steps > 0; steps--) {
    if (at === MID_FORK.space && !road) {
      [turn.phase, turn.stepsLeft] = ['fork', steps];
      turn.player = { ...turn.player, space: at };
      turn.events.push('reached the fork');
      return;
    }
    if (at === 0) at = START_FORK[turn.player.career ? 'work' : 'college'];
    else if (at === MID_FORK.space) at = MID_FORK[road!];
    else at = nextSpace(at, length);
    const salary = careerOf(turn.player.career ?? '')?.salary;
    if (ROAD[at].kind === 'payday' && salary) {
      turn.player = { ...turn.player, cash: turn.player.cash + salary };
      turn.events.push(`collected ${money(salary)} on payday`);
    }
    if (isStop(ROAD[at].kind) && ROAD[at].kind !== 'fork') break;
  }
  turn.player = { ...turn.player, space: at };
  land(turn, random);
}

const named = (state: GameState, seats: Seat[]): string => {
  const names = seats.map(seat => state.playerNames[seat]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
};

// Everyone has retired: the highest worth wins, ties share
function endIfAllRetired(state: GameState): GameState {
  const players = state.road!.players;
  const seats = state.activePlayers;
  if (!seats.every(seat => players[seat].retired)) return state;
  const best = Math.max(...seats.map(seat => players[seat].worth!));
  const winners = seats.filter(seat => players[seat].worth === best);
  return { ...state, isGameOver: true, currentPlayer: null, winners, gameStatus: `${named(state, winners)} retired the richest with ${money(best)}` };
}

// `from` itself counts when `inclusive`; null when everyone has retired
function nextLive(state: GameState, from: Seat, inclusive: boolean): Seat | null {
  const order = [...state.activePlayers.filter(s => s > from || (inclusive && s === from)), ...state.activePlayers.filter(s => s <= from)];
  return order.find(seat => !state.road!.players[seat].retired) ?? null;
}

function startTurn(state: GameState, seat: Seat): GameState {
  const road = state.road!;
  return { ...state, currentPlayer: seat, road: { ...road, phase: road.players[seat].space === 0 ? 'route' : 'spin', stepsLeft: 0, offer: [] } };
}

// The resolved move's player record and phase, then the next turn once nothing is waiting on a choice
function finish(turn: Turn, move: Move, spun?: number): GameState {
  const { state, seat } = turn;
  const road: RoadState = { players: { ...state.road!.players, [seat]: turn.player }, phase: turn.phase, stepsLeft: turn.stepsLeft, offer: turn.offer };
  let next: GameState = {
    ...state, road, spin: spun ?? state.spin,
    lastMove: { type: move.type, playerNumber: seat, ...(spun === undefined ? {} : { spin: spun }), events: turn.events },
    gameStatus: `${state.playerNames[seat]} ${turn.events.join(', ')}`
  };
  if (turn.phase !== 'spin' || move.type === 'route' || (move.type === 'career' && turn.player.space === 0)) return next;
  next = endIfAllRetired(next);
  const after = next.isGameOver ? null : nextLive(next, seat, false);
  return after === null ? next : startTurn(next, after);
}

const PHASE_ERROR: Record<RoadPhase, string> = {
  route: 'Choose college or work first', spin: 'Spin first', fork: 'Choose a road',
  career: 'Pick one of the careers offered', house: 'Pick one of the houses offered'
};
const PHASE_MOVE: Record<RoadPhase, Move['type']> = { route: 'route', spin: 'spin', fork: 'fork', career: 'career', house: 'buyHouse' };

const becameA = (name: string): string => `became ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`;

export function roadMove(state: GameState, seat: Seat, move: Move, random: Random): Result<GameState> {
  const road = state.road;
  const player = road?.players[seat];
  if (!road || !player || player.retired || move.type === 'step') return { error: 'Not now' };
  if (move.type === 'route' && road.phase !== 'route') return { error: 'Not now' };
  if (move.type !== PHASE_MOVE[road.phase]) return { error: PHASE_ERROR[road.phase] };
  const turn: Turn = { state, seat, player, events: [], phase: 'spin', stepsLeft: 0, offer: [] };
  switch (move.type) {
    case 'route':
      if (move.choice === 'college') {
        turn.events.push('chose college');
        pay(turn, COLLEGE_COST);
      } else if (move.choice === 'work') {
        turn.events.push('went straight to work');
        offerCareers(turn, random, false);
      } else return { error: PHASE_ERROR.route };
      return { state: finish(turn, move) };
    case 'spin': {
      const spun = spin(random);
      turn.events.push(`spun ${spun}`);
      walk(turn, spun, random);
      return { state: finish(turn, move, spun) };
    }
    case 'fork':
      if (move.road !== 'safe' && move.road !== 'fast') return { error: PHASE_ERROR.fork };
      turn.events.push(`took the ${move.road === 'safe' ? 'safe road' : 'fast lane'}`);
      walk(turn, road.stepsLeft, random, move.road);
      return { state: finish(turn, move) };
    case 'career':
      if (move.pick === null ? player.career === null : !road.offer.includes(move.pick)) return { error: PHASE_ERROR.career };
      turn.player = { ...player, career: move.pick ?? player.career };
      turn.events.push(move.pick === null ? 'kept their career' : becameA(careerOf(move.pick)!.name));
      return { state: finish(turn, move) };
    case 'buyHouse': {
      if (move.pick !== null && !road.offer.includes(move.pick)) return { error: PHASE_ERROR.house };
      const house = move.pick === null ? null : houseOf(move.pick)!;
      if (house) {
        turn.events.push(`bought the ${house.name} for ${money(house.price)}`);
        pay(turn, house.price);
        turn.player = { ...turn.player, houses: [...turn.player.houses, house.id] };
      } else turn.events.push('passed on the houses');
      return { state: finish(turn, move) };
    }
  }
}

// The platform has removed `seat` and moved a turn it held to the next active seat. A current player mid-turn
// (the last mover, waiting on a choice or about to spin off the start) keeps going; otherwise a fresh turn starts.
export function roadLeft(state: GameState, seat: Seat): GameState {
  const players = { ...state.road!.players };
  delete players[seat];
  const next = endIfAllRetired({ ...state, road: { ...state.road!, players } });
  const current = next.currentPlayer;
  if (next.isGameOver || current === null) return next;
  const phase = next.road!.phase;
  const midTurn = next.lastMove?.playerNumber === current && !players[current].retired
    && (phase === 'career' || phase === 'house' || phase === 'fork' || (phase === 'spin' && players[current].space === 0));
  return midTurn ? next : startTurn(next, nextLive(next, current, true)!);
}

// Retired players by worth; anyone still on the road (a game ended by dismissals) by what retiring now would give
export function roadStandings(state: GameState): Standing[] {
  const worth = (seat: Seat): number => {
    const player = state.road?.players[seat];
    return player ? player.worth ?? worthOf(player) : 0;
  };
  return rankStandings(state, (a, b) => worth(b) - worth(a), seat => money(worth(seat)));
}
