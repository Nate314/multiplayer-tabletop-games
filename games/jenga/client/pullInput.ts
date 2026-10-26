// Pointer and keyboard pull input, kept free of three so it runs under node:test
import { SIMULATION_TICK_MS } from '../../../shared/gameDefinition.ts';
import { anchorWorld } from '../physics.ts';
import { canPull } from '../rules.ts';
import type { Block, Vec3 } from '../types.ts';

const KEY_STEP = 0.5;

// The server reads one drag per tick, so sending more only costs bandwidth
export const throttleDrag = (lastSentMs: number, nowMs: number) => nowMs - lastSentMs >= SIMULATION_TICK_MS;

// Outward is along the block's long axis toward the end the anchor is on
export function keyboardTarget(block: Block, anchor: Vec3, direction: 1 | -1): Vec3 {
  const sign = anchor[0] < 0 ? -1 : 1;
  return anchorWorld(block, [anchor[0] + sign * direction * KEY_STEP, anchor[1], anchor[2]]);
}

// Even levels run along X, so their blocks sit side by side across Z; odd levels the other way
const across = (block: Block) => block.pose.p[block.level % 2 === 0 ? 2 : 0];

export function nextSelection(blocks: Block[], selected: number | null, key: string): number | null {
  const legal = blocks.filter(b => canPull({ blocks }, b.id));
  const current = legal.find(b => b.id === selected);
  if (!current) {
    const top = Math.max(...legal.map(b => b.level));
    return legal.find(b => b.level === top)?.id ?? null;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const row = legal.filter(b => b.level === current.level).sort((a, b) => across(a) - across(b));
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
    return row.reduce((best, b) => Math.abs(across(b) - across(current)) < Math.abs(across(best) - across(current)) ? b : best).id;
  }
  return current.id;
}
