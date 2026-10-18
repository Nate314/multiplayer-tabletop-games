import { useCallback, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { slideFrom } from '../../../src/animation/motion.ts';

type Queued = { toKey: string; from: DOMRect };

// Slides for changes made on this screen rather than by a move, like placing a tile or shuffling the rack.
// Call the returned function with [from key, to key] pairs just before the state change: it measures the
// elements with data-anim-key="<from key>" now, and after the next render slides the "<to key>" ones from there.
export function useSlides(rootRef: RefObject<HTMLElement | null>): (pairs: [string, string][]) => void {
  const queued = useRef<Queued[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    for (const { toKey, from } of queued.current) {
      const element = root?.querySelector(`[data-anim-key="${toKey}"]`);
      if (element) slideFrom(element, from);
    }
    queued.current = [];
  });

  return useCallback((pairs) => {
    const root = rootRef.current;
    for (const [fromKey, toKey] of pairs) {
      const from = root?.querySelector(`[data-anim-key="${fromKey}"]`)?.getBoundingClientRect();
      if (from) queued.current.push({ toKey, from });
    }
  }, [rootRef]);
}
