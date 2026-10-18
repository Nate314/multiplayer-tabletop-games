// Turn order, points, the two award cards, the end of the game and the event log, shared by every part of the rules
import { AWARD_POINTS, LARGEST_ARMY_MINIMUM, LONGEST_ROAD_MINIMUM, awardHolder, roadLengths } from './roads.ts';
import type { GameState, Seat } from './types.ts';

export const LOG_SIZE = 40;
export const WINNING_POINTS = 10;

export function nameOf(state: Pick<GameState, 'playerNames'>, seat: Seat | null): string {
  return seat === null ? 'the bank' : state.playerNames[seat] ?? `Player ${seat}`;
}

export function note(state: GameState, text: string): GameState {
  return { ...state, log: [...state.log, text] };
}

// The next seat still in the game after `from`, which need not be in it itself
export function nextPlayer(state: Pick<GameState, 'activePlayers'>, from: Seat): Seat | null {
  return state.activePlayers.find(seat => seat > from) ?? state.activePlayers[0] ?? null;
}

// Points everyone can see: buildings and award cards
export function visiblePoints(state: Pick<GameState, 'buildings' | 'longestRoad' | 'largestArmy'>, seat: Seat): number {
  const buildings = Object.values(state.buildings).filter(building => building.seat === seat)
    .reduce((sum, building) => sum + (building.city ? 2 : 1), 0);
  const awards = [state.longestRoad, state.largestArmy].filter(holder => holder === seat).length * AWARD_POINTS;
  return buildings + awards;
}

// All points, with the player's Victory Point cards (including any bought this turn)
export function points(state: GameState, seat: Seat): number {
  const cards = [...(state.devCards[seat] ?? []), ...(state.turnHolder === seat ? state.boughtThisTurn : [])];
  return visiblePoints(state, seat) + cards.filter(card => card === 'victoryPoint').length;
}

// Moves the Longest Road and Largest Army cards after any change, noting who takes or loses them
export function settleAwards(state: GameState): GameState {
  if (state.setup) return state;
  const players = state.activePlayers;
  const longestRoad = awardHolder(state.longestRoad, roadLengths(state), LONGEST_ROAD_MINIMUM, players);
  const largestArmy = awardHolder(state.largestArmy, state.knights, LARGEST_ARMY_MINIMUM, players);
  let next: GameState = { ...state, longestRoad, largestArmy };
  if (longestRoad !== state.longestRoad) {
    next = note(next, longestRoad === null ? 'Nobody holds Longest Road now' : `${nameOf(state, longestRoad)} takes Longest Road`);
  }
  if (largestArmy !== state.largestArmy) {
    next = note(next, largestArmy === null ? 'Nobody holds Largest Army now' : `${nameOf(state, largestArmy)} takes Largest Army`);
  }
  return next;
}

// A player wins with 10 points on their own turn
export function checkWin(state: GameState): GameState {
  const seat = state.turnHolder;
  if (state.isGameOver || state.setup || seat === null || points(state, seat) < WINNING_POINTS) return state;
  return endGame(state, [seat], `${nameOf(state, seat)} wins with ${points(state, seat)} points`);
}

export function endGame(state: GameState, winners: Seat[], text: string): GameState {
  return note({ ...state, isGameOver: true, winners, pending: null, trade: null }, text);
}

// A new turn for `seat`: cards bought last turn become playable
export function startTurn(state: GameState, seat: Seat | null): GameState {
  const holder = state.turnHolder;
  const devCards = holder === null ? state.devCards : { ...state.devCards, [holder]: [...(state.devCards[holder] ?? []), ...state.boughtThisTurn] };
  return { ...state, devCards, boughtThisTurn: [], devPlayed: false, turnHolder: seat, rolled: false, pending: null, trade: null };
}

// Whoever must make the next move: the setup placer, else the turn holder (discards and trade answers are actions)
export function syncTurn(state: GameState): GameState {
  if (state.isGameOver) return { ...state, currentPlayer: null };
  if (state.setup) return { ...state, currentPlayer: state.setup.order[state.setup.step] ?? null };
  return { ...state, currentPlayer: state.turnHolder };
}
