// Turn order, who must act now, and the event log, shared by every part of the rules
import type { GameState, Seat } from './types.ts';

export const LOG_SIZE = 40;

// Seats still playing: seated and not bankrupt, in seat order
export function inGame(state: Pick<GameState, 'activePlayers' | 'bankrupt'>): Seat[] {
  return state.activePlayers.filter(seat => !state.bankrupt.includes(seat));
}

// The next seat still playing after `from`, which need not be playing itself
export function nextInGame(state: Pick<GameState, 'activePlayers' | 'bankrupt'>, from: Seat): Seat | null {
  const players = inGame(state);
  return players.find(seat => seat > from) ?? players[0] ?? null;
}

export function nameOf(state: Pick<GameState, 'playerNames'>, seat: Seat | null): string {
  return seat === null ? 'the bank' : state.playerNames[seat] ?? `Player ${seat}`;
}

export function note(state: GameState, text: string): GameState {
  return { ...state, log: [...state.log, text] };
}

export function money(amount: number): string {
  return `$${amount}`;
}

export function startTurn(state: GameState, seat: Seat | null): GameState {
  return { ...state, turnHolder: seat, canRoll: seat !== null, doublesRolled: 0, pendingBuy: null };
}

// The game ends once one player is left who is not bankrupt
export function checkGameOver(state: GameState): GameState {
  if (state.isGameOver) return state;
  const players = inGame(state);
  if (players.length !== 1 || state.activePlayers.length < 2) return state;
  const [winner] = players;
  return note({
    ...state,
    isGameOver: true,
    winners: [winner],
    turnHolder: null,
    canRoll: false,
    pendingBuy: null,
    auction: null,
    auctionQueue: [],
    debts: [],
    trade: null
  }, `${nameOf(state, winner)} wins: everyone else is bankrupt`);
}

// Whoever must act now: the first debtor, else the turn holder
export function syncTurn(state: GameState): GameState {
  if (state.isGameOver) return { ...state, currentPlayer: null };
  return { ...state, currentPlayer: state.debts[0]?.debtor ?? state.turnHolder };
}
