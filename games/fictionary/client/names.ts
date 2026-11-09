import type { Seat } from '../../../shared/types.ts';

export const namesOf = (playerNames: Record<Seat, string>, seats: Seat[]): string => seats.map(seat => playerNames[seat]).join(', ');
