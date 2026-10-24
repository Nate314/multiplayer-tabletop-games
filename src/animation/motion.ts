// Small Web Animations API helpers shared by every game's move animations
export const MOVE_DURATION_MS = 300;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Cancel a running animation first, so a fast follow-up move ends in the right place.
// getAnimations() also returns the element's CSS animations and transitions, so those are canceled too.
function cancelAnimations(element: Element) {
  element.getAnimations().forEach(animation => animation.cancel());
}

type Rect = Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;

function center(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

// The translate that puts an element at `to` back at `from`, center to center.
// Screen pixels are divided by `scale`, as a translate inside a board scaled down by `scale` moves that much less on screen.
export function slideOffset(from: Rect, to: Rect, scale: number): { x: number; y: number } {
  const start = center(from);
  const end = center(to);
  return { x: (start.x - end.x) / scale, y: (start.y - end.y) / scale };
}

// Moves the element from where `from` is to where it is now, center to center, so a pawn can start from its old square.
// Inside a board scaled to fit, the distance is divided by the board's scale.
// Animates `translate`, which adds to any `transform` the element's CSS already has.
// A delayed slide waits at `from`, so pieces can follow one another.
export function slideFrom(element: Element, from: DOMRect, durationMs = MOVE_DURATION_MS, delayMs = 0): void {
  cancelAnimations(element);
  if (prefersReducedMotion()) return;
  const scaled = element.closest<HTMLElement>('[data-fit-scale]');
  const { x, y } = slideOffset(from, element.getBoundingClientRect(), Number(scaled?.dataset.fitScale ?? 1));
  element.animate(
    [{ translate: `${x}px ${y}px` }, { translate: '0 0' }],
    { duration: durationMs, delay: delayMs, easing: 'ease-in-out', fill: 'backwards' }
  );
}

export function fadeIn(element: Element, durationMs = MOVE_DURATION_MS): void {
  cancelAnimations(element);
  if (prefersReducedMotion()) return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: durationMs, easing: 'ease-out' });
}
