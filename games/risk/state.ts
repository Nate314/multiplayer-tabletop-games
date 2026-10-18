// Turn order, reinforcement counts, starting a turn, the end of the game and the event log, shared by every part of the rules
import { CONTINENTS, TERRITORIES, territoriesOf } from './map.ts';
import type { ContinentId, GameState, Seat } from './types.ts';

export const LOG_SIZE = 40;
export const MIN_PLAYERS = 3;

// Starting armies by number of players, from the official rules
export const STARTING_ARMIES: Record<number, number> = { 3: 35, 4: 30, 5: 25, 6: 20 };

export function nameOf(state: Pick<GameState, 'playerNames'>, seat: Seat | null): string {
  return seat === null ? 'Neutral' : state.playerNames[seat] ?? `Player ${seat}`;
}

export function note(state: GameState, text: string): GameState {
  return { ...state, log: [...state.log, text] };
}

export function plural(count: number, word: string, many = `${word}s`): string {
  return `${count} ${count === 1 ? word : many}`;
}

export function territoriesHeld(state: Pick<GameState, 'owners'>, seat: Seat): string[] {
  return TERRITORIES.filter(({ id }) => state.owners[id] === seat).map(({ id }) => id);
}

// Seats still playing: seated, and not eliminated, in seat order
export function inGame(state: Pick<GameState, 'activePlayers' | 'eliminated'>): Seat[] {
  return state.activePlayers.filter(seat => !state.eliminated.includes(seat));
}

// The next seat still playing after `from`, which need not be playing itself
export function nextInGame(state: Pick<GameState, 'activePlayers' | 'eliminated'>, from: Seat): Seat | null {
  const players = inGame(state);
  return players.find(seat => seat > from) ?? players[0] ?? null;
}

export function continentsHeld(state: Pick<GameState, 'owners'>, seat: Seat): ContinentId[] {
  return CONTINENTS.filter(({ id }) => territoriesOf(id).every(territory => state.owners[territory] === seat)).map(({ id }) => id);
}

// Armies at the start of a turn before cards: a third of the territories held, at least 3, plus each whole continent's bonus
export function reinforcementsFor(state: Pick<GameState, 'owners'>, seat: Seat): number {
  const base = Math.max(3, Math.floor(territoriesHeld(state, seat).length / 3));
  const bonus = continentsHeld(state, seat)
    .reduce((sum, id) => sum + (CONTINENTS.find(continent => continent.id === id)?.bonus ?? 0), 0);
  return base + bonus;
}

// The turn of `seat` begins: their reinforcements are counted and they place them (trading cards first if they hold 5)
export function startTurn(state: GameState, seat: Seat | null): GameState {
  const fresh: GameState = {
    ...state,
    currentPlayer: seat,
    turnHolder: seat,
    phase: 'reinforce',
    reinforcements: 0,
    midTurnTrade: false,
    bonusTaken: false,
    conqueredThisTurn: false,
    conquest: null
  };
  if (seat === null) return fresh;
  const armies = reinforcementsFor(state, seat);
  const turnNumber = state.turnNumber + 1;
  const started = { ...fresh, reinforcements: armies, turnNumber };
  return note(started, `${nameOf(state, seat)} receives ${plural(armies, 'army', 'armies')}`);
}

function endGame(state: GameState, winners: Seat[], text: string): GameState {
  return note({ ...state, isGameOver: true, winners, currentPlayer: null, turnHolder: null, conquest: null, reinforcements: 0 }, text);
}

// The game ends when one player holds every territory, or is the only player left holding any
export function checkGameOver(state: GameState): GameState {
  if (state.isGameOver || state.phase === 'setup') return state;
  const holders = inGame(state).filter(seat => territoriesHeld(state, seat).length > 0);
  if (holders.length !== 1) return state;
  const [winner] = holders;
  const everything = territoriesHeld(state, winner).length === TERRITORIES.length;
  return endGame(state, [winner], everything
    ? `${nameOf(state, winner)} wins: they control the whole world`
    : `${nameOf(state, winner)} wins: no other player holds a territory`);
}

// When too few players are left to go on, whoever holds the most territories wins; a tie shares the win
export function endByTerritories(state: GameState): GameState {
  const players = inGame(state);
  const most = Math.max(...players.map(seat => territoriesHeld(state, seat).length));
  const winners = players.filter(seat => territoriesHeld(state, seat).length === most);
  return endGame(state, winners, `Too few players are left to go on. ${winners.map(seat => nameOf(state, seat)).join(' and ')} ` +
    `${winners.length === 1 ? 'wins' : 'share the win'} with the most territories (${most})`);
}
