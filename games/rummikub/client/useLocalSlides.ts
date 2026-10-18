import { useCallback, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { slideFrom } from '../../../src/animation/motion.ts';

// Slides for changes made on this screen rather than by a move, like putting a tile in a group or sorting the rack.
// Call the returned function just before the state change: it measures every data-anim-key element now, and after
// the next render slides each one that moved from where it was.
export function useLocalSlides(rootRef: RefObject<HTMLElement | null>): () => void {
  const captured = useRef<Map<string, DOMRect> | null>(null);

  useLayoutEffect(() => {
    const before = captured.current;
    captured.current = null;
    if (!before) return;
    rootRef.current?.querySelectorAll<HTMLElement>('[data-anim-key]').forEach(element => {
      const from = before.get(element.dataset.animKey!);
      const now = element.getBoundingClientRect();
      if (from && (Math.abs(from.x - now.x) > 1 || Math.abs(from.y - now.y) > 1)) slideFrom(element, from);
    });
  });

  return useCallback(() => {
    const rects = new Map<string, DOMRect>();
    rootRef.current?.querySelectorAll<HTMLElement>('[data-anim-key]').forEach(element => {
      rects.set(element.dataset.animKey!, element.getBoundingClientRect());
    });
    captured.current = rects;
  }, [rootRef]);
}
