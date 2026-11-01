import { useCallback, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { hasMoved, slideFrom } from '../../../src/animation/motion.ts';
import { takeDrop } from '../../../src/drag/recentDrop.ts';

// Slides for changes made on this screen rather than by a move, like putting a tile in a group or sorting the rack.
// Call the returned function just before the state change: it measures every data-anim-key element now, and after
// the next render slides each one that moved from where it was. A change made by dropping a tile slides nothing, so
// the tile stays where it was let go; those drops send no move, so this takes the mark before useMoveAnimation could.
// After any such change has rendered, dropped or not, it calls onSettled, so the next move measures the tiles where they are now.
export function useLocalSlides(rootRef: RefObject<HTMLElement | null>, onSettled?: () => void): () => void {
  const captured = useRef<Map<string, DOMRect> | null>(null);
  const pending = useRef(false);

  useLayoutEffect(() => {
    const before = captured.current;
    captured.current = null;
    if (before) {
      rootRef.current?.querySelectorAll<HTMLElement>('[data-anim-key]').forEach(element => {
        const from = before.get(element.dataset.animKey!);
        if (from && hasMoved(from, element.getBoundingClientRect())) slideFrom(element, from);
      });
    }
    if (!pending.current) return;
    pending.current = false;
    onSettled?.();
  });

  return useCallback(() => {
    pending.current = true;
    if (takeDrop()) return;
    const rects = new Map<string, DOMRect>();
    rootRef.current?.querySelectorAll<HTMLElement>('[data-anim-key]').forEach(element => {
      rects.set(element.dataset.animKey!, element.getBoundingClientRect());
    });
    captured.current = rects;
  }, [rootRef]);
}
