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
    trade: null,
    mortgageDecisions: []
  }, `${nameOf(state, winner)} wins: everyone else is bankrupt`);
}

// Who the game waits for before anything else: the first debtor, then the first player deciding about received mortgages
export function waitingOn(state: Pick<GameState, 'debts' | 'mortgageDecisions'>): Seat | null {
  return state.debts[0]?.debtor ?? state.mortgageDecisions[0]?.seat ?? null;
}

// Why nobody else may act yet, or null
export function waitError(state: GameState): string | null {
  if (state.debts.length > 0) return `Wait for ${nameOf(state, state.debts[0].debtor)} to pay`;
  const decision = state.mortgageDecisions[0];
  return decision ? `Wait for ${nameOf(state, decision.seat)} to decide about the mortgages` : null;
}

// Whoever must act now: a debtor or a player deciding about mortgages, else the turn holder
export function syncTurn(state: GameState): GameState {
  if (state.isGameOver) return { ...state, currentPlayer: null };
  return { ...state, currentPlayer: waitingOn(state) ?? state.turnHolder };
}
