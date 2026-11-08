// Pointer and keyboard pull input, kept free of three so it runs under node:test
import { SIMULATION_TICK_MS } from '../../../shared/gameDefinition.ts';
import { IDENTITY, MAX_REACH, anchorWorld, toTable } from '../physics.ts';
import { canPull } from '../rules.ts';
import type { Block, Quat, Vec3 } from '../types.ts';

const KEY_STEP = 0.5;
// rad/s while Q or E is held
export const KEY_SPIN = 1;

export const turnKey = (key: string) => key === 'q' || key === 'Q' ? -KEY_SPIN : key === 'e' || key === 'E' ? KEY_SPIN : null;

// The turn keys held, oldest first; the last one pressed wins, so letting go of one hands back to the other
export const heldSpeed = (held: string[]) => held.length > 0 ? turnKey(held[held.length - 1]) : null;

// The server reads one drag per tick, so sending more only costs bandwidth
export const throttleDrag = (lastSentMs: number, nowMs: number) => nowMs - lastSentMs >= SIMULATION_TICK_MS;

// Outward is along the block's long axis toward the end the anchor is on; negative steps push back in
export function keyboardTarget(block: Block, anchor: Vec3, steps: number): Vec3 {
  const sign = anchor[0] < 0 ? -1 : 1;
  return anchorWorld(block, [anchor[0] + sign * steps * KEY_STEP, anchor[1], anchor[2]]);
}

const MAX_KEY_STEPS = MAX_REACH / KEY_STEP;

// One step barely moves a loaded block, so presses the same way add up to the reach a mouse drag gets
export const keySteps = (steps: number, direction: 1 | -1) =>
  Math.sign(steps) === direction ? direction * Math.min(Math.abs(steps) + 1, MAX_KEY_STEPS) : direction;

// Even levels run along X, so their blocks sit side by side across Z; odd levels the other way. Read in the table's frame, so it turns with the tower
export const across = (block: Block, table: Quat = IDENTITY) => toTable(block.pose, table).p[block.level % 2 === 0 ? 2 : 0];

export function nextSelection(blocks: Block[], selected: number | null, key: string, table: Quat = IDENTITY): number | null {
  const side = (block: Block) => across(block, table);
  const legal = blocks.filter(b => canPull({ blocks }, b.id));
  const current = legal.find(b => b.id === selected);
  if (!current) {
    const top = Math.max(...legal.map(b => b.level));
    return legal.find(b => b.level === top)?.id ?? null;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const row = legal.filter(b => b.level === current.level).sort((a, b) => side(a) - side(b));
    const next = row[row.indexOf(current) + (key === 'ArrowRight' ? 1 : -1)];
    return (next ?? current).id;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const up = key === 'ArrowUp';
    const levels = legal.map(b => b.level).filter(level => up ? level > current.level : level < current.level);
    if (levels.length === 0) return current.id;
    const level = up ? Math.min(...levels) : Math.max(...levels);
    const row = legal.filter(b => b.level === level);
    // The block nearest the same side, so up and down feel like a straight column
    return row.reduce((best, b) => Math.abs(side(b) - side(current)) < Math.abs(side(best) - side(current)) ? b : best).id;
  }
  return current.id;
}
