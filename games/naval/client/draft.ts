// The fleet a player is placing, kept in the browser until Confirm fleet. Pure, so it can be tested without a page.
import { FLEET, placementError } from '../fleet.ts';
import type { Cell, Ship } from '../types.ts';

// One slot per FLEET entry, null while that ship is still in the tray
export type Draft = (Ship | null)[];

export const emptyDraft = (): Draft => FLEET.map(() => null);

const placed = (draft: Draft): Ship[] => draft.filter((ship): ship is Ship => ship !== null);

// The draft with slot `index` set to `ship`, or the draft itself when that would go off the grid or overlap
function withShip(draft: Draft, index: number, ship: Ship): Draft {
  const next = draft.map((old, i) => (i === index ? ship : old));
  return placementError(placed(next)) === null ? next : draft;
}

// Puts ship `index` with its top or left end at `cell`
export function placeAt(draft: Draft, index: number, cell: Cell, orientation: Ship['orientation']): Draft {
  return withShip(draft, index, { length: FLEET[index], row: cell.row, col: cell.col, orientation });
}

// Turns a placed ship about its top or left end
export function rotate(draft: Draft, index: number): Draft {
  const ship = draft[index];
  if (!ship) return draft;
  return withShip(draft, index, { ...ship, orientation: ship.orientation === 'across' ? 'down' : 'across' });
}

export function complete(draft: Draft): Ship[] | null {
  return draft.every(ship => ship !== null) ? (draft as Ship[]) : null;
}
