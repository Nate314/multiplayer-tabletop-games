import { useEffect, useRef } from 'react';
import { DEFAULT_GRIP, STEPS_PER_TICK, STEP_S, buildWorld, readBlocks, stepWorld, syncWorld, type TowerWorld } from '../physics.ts';
import type { Block, Grab, PublicGameState } from '../types.ts';

// A slow frame catches up by at most this many steps, so a stalled tab never spirals
const MAX_STEPS_PER_FRAME = 3;
// Two server ticks: enough to bridge a late update, and a paused or stalled server stops the preview instead of letting it drift
const MAX_STEPS_AHEAD = 2 * STEPS_PER_TICK;

// Between server ticks the browser runs the same physics from the last state, so the tower moves at 60 fps instead of 20.
// One world lives for the whole simulation: each server state moves its bodies back to the truth instead of rebuilding it.
// Frames go straight to `draw`, so React does not re-render 60 times a second. Assumes initPhysics() has resolved.
export function usePreview(state: PublicGameState, localGrab: Grab | null, draw: (blocks: Block[]) => void) {
  const grab = useRef<Grab | null>(null);
  const drawRef = useRef(draw);
  const blocksRef = useRef(state.blocks);
  const towerRef = useRef<TowerWorld | null>(null);
  const aheadRef = useRef(0);
  const simulating = state.sim !== null;
  const { blocks } = state;

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // The viewer's own drag reaches the preview before the server echoes it
  useEffect(() => {
    grab.current = localGrab ?? state.grab;
  }, [localGrab, state.grab]);

  useEffect(() => {
    blocksRef.current = blocks;
    aheadRef.current = 0;
    const tower = towerRef.current;
    if (tower && !syncWorld(tower, blocks)) {
      tower.world.free();
      towerRef.current = buildWorld(blocks, () => DEFAULT_GRIP);
    }
  }, [blocks]);

  useEffect(() => {
    if (!simulating) return;
    towerRef.current = buildWorld(blocksRef.current, () => DEFAULT_GRIP);
    aheadRef.current = 0;
    let last = performance.now();
    let behind = 0;
    let frame = requestAnimationFrame(function step(now) {
      behind = Math.min(behind + (now - last) / 1000, MAX_STEPS_PER_FRAME * STEP_S);
      last = now;
      const steps = Math.min(Math.floor(behind / STEP_S), MAX_STEPS_AHEAD - aheadRef.current);
      if (steps > 0) {
        behind -= steps * STEP_S;
        aheadRef.current += steps;
        stepWorld(towerRef.current!, grab.current, steps);
        drawRef.current(readBlocks(towerRef.current!, blocksRef.current));
      }
      frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
      towerRef.current?.world.free();
      towerRef.current = null;
    };
  }, [simulating]);
}
