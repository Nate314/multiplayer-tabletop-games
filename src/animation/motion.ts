// Small Web Animations API helpers shared by every game's move animations
export const MOVE_DURATION_MS = 300;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Cancel a running animation first, so a fast follow-up move ends in the right place
function cancelAnimations(element: Element) {
  element.getAnimations().forEach(animation => animation.cancel());
}

function center(rect: DOMRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

// Moves the element from where `from` is to where it is now, center to center, so a pawn can start from its old square.
// Animates `translate`, which adds to any `transform` the element's CSS already has.
export function slideFrom(element: Element, from: DOMRect, durationMs = MOVE_DURATION_MS): void {
  cancelAnimations(element);
  if (prefersReducedMotion()) return;
  const start = center(from);
  const end = center(element.getBoundingClientRect());
  element.animate(
    [{ translate: `${start.x - end.x}px ${start.y - end.y}px` }, { translate: '0 0' }],
    { duration: durationMs, easing: 'ease-in-out' }
  );
}

export function fadeIn(element: Element, durationMs = MOVE_DURATION_MS): void {
  cancelAnimations(element);
  if (prefersReducedMotion()) return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: durationMs, easing: 'ease-out' });
}
