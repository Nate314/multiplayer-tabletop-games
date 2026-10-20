import type { BaseGameState, Seat } from './types.ts';

// Four seats around the table, partners sit across (1 and 3 against 2 and 4)
export type Team = 0 | 1;

export const FOUR_SEATS: readonly Seat[] = [1, 2, 3, 4];

// The seat to the left, which plays next
export function nextSeat(seat: Seat): Seat {
  return seat % 4 + 1;
}

export function teamOf(seat: Seat): Team {
  return seat % 2 === 1 ? 0 : 1;
}

export function teamSeats(team: Team): Seat[] {
  return FOUR_SEATS.filter(seat => teamOf(seat) === team);
}

export function partnerOf(seat: Seat): Seat {
  return (seat + 1) % 4 + 1;
}

// The two partners' names, e.g. 'Alice and Cara'
export function teamNames(team: Team, playerNames: Record<Seat, string>): string {
  return teamSeats(team).map(seat => playerNames[seat]).join(' and ');
}

// A player leaving breaks their partnership, so the game ends and the other team wins
export function partnershipBroken<S extends BaseGameState>(state: S, seat: Seat): S {
  const winner: Team = teamOf(seat) === 0 ? 1 : 0;
  return {
    ...state,
    isGameOver: true,
    currentPlayer: null,
    winners: teamSeats(winner),
    undoVote: null,
    gameStatus: `${state.playerNames[seat]} left, so the partnership is broken: ${teamNames(winner, state.playerNames)} win`
  };
}
