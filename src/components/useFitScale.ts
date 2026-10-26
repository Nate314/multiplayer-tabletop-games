import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { fitScale, nextScale } from './fitScale.ts';

// Scales `content` to fit `box`, up to `max`, and measures again when either changes size.
// With `onlyDown`, a step that changes the content's size can only lower the scale, so the board never bounces;
// only the box changing size (a window resize) starts over. offsetWidth and offsetHeight ignore the scale transform.
// Written straight to the element, before the browser paints, so the board never shows a frame at the wrong size.
export default function useFitScale(boxRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>, max = 1, onlyDown = false): void {
  useLayoutEffect(() => {
    const box = boxRef.current!;
    const content = contentRef.current!;
    let boxSize = '';
    let scale: number | null = null;
    const observer = new ResizeObserver(() => {
      const size = `${box.clientWidth}x${box.clientHeight}`;
      const boxResized = size !== boxSize;
      boxSize = size;
      const fit = fitScale({ width: content.offsetWidth, height: content.offsetHeight }, { width: box.clientWidth, height: box.clientHeight }, max);
      scale = onlyDown ? nextScale(scale, fit, boxResized) : fit;
      content.style.setProperty('--fit-scale', String(scale));
      content.dataset.fitScale = String(scale);
    });
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, [boxRef, contentRef, max, onlyDown]);
}
