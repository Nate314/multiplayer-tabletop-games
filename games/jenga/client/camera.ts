// The turn-bound camera rules, kept free of three so they run under node:test; rendering only, never fed to the physics
import { turntableOf } from '../rules.ts';
import { DEFAULT_ORBIT, type Orbit } from './orbit.ts';
import type { PublicGameState, Quat, Seat, Turntable } from '../types.ts';

export type SavedViews = Partial<Record<Seat, Orbit>>;

// The turntable's angle about +Y, so a camera yaw can be measured against it
export const tableYaw = (q: Quat) => 2 * Math.atan2(q[1], q[3]);

// The view rounds q to 4 places; renormalized once here so no frame conversion scales the tower
export function viewTurntable(turntable: Turntable | undefined): Turntable {
  const table = turntableOf({ turntable });
  const size = Math.hypot(...table.q);
  return { ...table, q: table.q.map(v => v / size) as Quat };
}

// Views are kept against the turntable, so a seat comes back to the same side of the tower however far it turned since
export function turnStartView(saved: SavedViews, seat: Seat, table: Quat): Orbit {
  const view = saved[seat] ?? DEFAULT_ORBIT;
  return { ...view, yaw: view.yaw + tableYaw(table) };
}

export const turnEndViews = (saved: SavedViews, seat: Seat, orbit: Orbit, table: Quat): SavedViews =>
  ({ ...saved, [seat]: { ...orbit, yaw: orbit.yaw - tableYaw(table) } });

// Votes do not count, so a vote opening mid-turn never snaps or saves the camera
export const ownsTurn = (state: PublicGameState, seat: Seat | null) =>
  seat !== null && state.currentPlayer === seat && state.activePlayers.length >= 2 && !state.isGameOver && !state.toppled;
