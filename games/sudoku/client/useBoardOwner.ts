import { useState } from 'react';
import { boardOwner } from './shown.ts';
import type { PublicGameState, Seat } from '../types.ts';

// The Race board on show and a way to pick another; a pick of a board no longer in view falls back to the default
export default function useBoardOwner(state: PublicGameState, viewer: Seat | null): [Seat | null, (seat: Seat) => void] {
  const [chosen, setChosen] = useState<Seat | null>(null);
  return [boardOwner(state, viewer, chosen), setChosen];
}
