import type { GameFileStep } from '../../shared/gameFile.ts';
import { asRecord } from '../../shared/messages.ts';
import type { Reaction } from '../../shared/reactions.ts';
import { reactionLabel } from './reactions.ts';
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

// A hand-edited or old file may lack the list or hold odd entries; only well-formed reactions are shown
export function reactionsOf(step: GameFileStep): Reaction[] {
  if (!Array.isArray(step.reactions)) return [];
  return step.reactions.filter((entry): entry is Reaction => {
    const r = asRecord(entry);
    return r !== null && typeof r.from === 'string' && typeof r.emoji === 'string' &&
      typeof r.fromSpectator === 'boolean' && typeof r.target === 'number';
  });
}

// The names come from the file, so a step with reactions but no playerNames must not throw during render
export function reactionsLine(step: GameFileStep): string {
  const names = (asRecord(step.playerNames) ?? {}) as Record<Seat, string>;
  return reactionsOf(step).map(r => reactionLabel(r, names)).join('  ·  ');
}
