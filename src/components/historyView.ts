import type { GameFileStep } from '../../shared/gameFile.ts';
import { asRecord } from '../../shared/messages.ts';
import type { HistoryStep, Seat } from '../../shared/types.ts';

// The step to draw and the seat to draw it for; a seat the file has no view for falls back to the table with no seat
export function viewFor(step: GameFileStep, viewer: Seat | null): { step: HistoryStep; viewer: Seat | null } {
  const view = viewer !== null ? step.views?.[viewer] : undefined;
  return view ? { step: view, viewer } : { step, viewer: null };
}

// The picker's seats from the first step; a hand-edited file with odd names still yields plain string labels
export function seatOptions(step: GameFileStep): { seat: string; name: string }[] {
  if (!step.views) return [];
  return Object.entries(asRecord(step.playerNames) ?? {}).map(([seat, name]) => ({
    seat,
    name: typeof name === 'string' ? name : `Seat ${seat}`,
  }));
}
