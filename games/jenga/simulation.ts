// The server keeps each room's Rapier world between ticks, so a running simulation is not rebuilt 20 times a second
import { DEFAULT_GRIP, buildWorld, type TowerWorld } from './physics.ts';
import type { GameState } from './types.ts';

const worlds = new Map<string, { state: GameState; tower: TowerWorld }>();

// Keyed on the blocks array, which actions (a drag) carry over untouched; an undo, a restart or an edit rebuilds the world
export function worldFor(gameId: string, state: GameState): TowerWorld {
  const kept = worlds.get(gameId);
  if (kept?.state.blocks === state.blocks) return kept.tower;
  const tower = buildWorld(state.blocks, id => state.grip[id] ?? DEFAULT_GRIP);
  keepWorld(gameId, state, tower);
  return tower;
}

// Rapier worlds are WASM memory, so a replaced world is freed by hand
export function keepWorld(gameId: string, state: GameState, tower: TowerWorld) {
  const kept = worlds.get(gameId);
  if (kept && kept.tower !== tower) kept.tower.world.free();
  worlds.set(gameId, { state, tower });
}

export function forgetWorld(gameId: string) {
  worlds.get(gameId)?.tower.world.free();
  worlds.delete(gameId);
}
