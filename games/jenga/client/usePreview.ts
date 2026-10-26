import { useEffect, useRef, useState } from 'react';
import { DEFAULT_GRIP, buildWorld, readBlocks, stepWorld } from '../physics.ts';
import type { Block, Grab, PublicGameState } from '../types.ts';

// Between server ticks the browser runs the same physics from the last state, so the tower moves at 60 fps instead of 20.
// The server stays the truth: each new state replaces the preview world. Assumes initPhysics() has resolved.
export function usePreview(state: PublicGameState, localGrab: Grab | null): Block[] {
  const [preview, setPreview] = useState<{ from: Block[]; blocks: Block[] } | null>(null);
  const grab = useRef<Grab | null>(null);
  const simulating = state.sim !== null;
  const { blocks } = state;

  // The viewer's own drag reaches the preview before the server echoes it
  useEffect(() => {
    grab.current = localGrab ?? state.grab;
  }, [localGrab, state.grab]);

  useEffect(() => {
    if (!simulating) return;
    const tower = buildWorld(blocks, () => DEFAULT_GRIP);
    let frame = requestAnimationFrame(function step() {
      stepWorld(tower, grab.current, 1);
      setPreview({ from: blocks, blocks: readBlocks(tower, blocks) });
      frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
      tower.world.free();
    };
  }, [blocks, simulating]);

  // A preview from an older state never outlives the state that replaced it
  return simulating && preview?.from === blocks ? preview.blocks : blocks;
}
