// While a piece is held near the top or bottom of the window, useDrag scrolls the page toward that edge, so a
// drop target off screen (above a tray low on a phone) can be reached
export const EDGE_SCROLL_ZONE_PX = 40; // how near the edge the pointer must be
export const EDGE_SCROLL_MAX_PX = 20;  // the most it scrolls in one animation frame, at the edge or beyond it

// Pixels to scroll this frame for a pointer at clientY `y`: negative up, positive down, 0 outside the zones.
// It grows as the pointer nears the edge.
export function edgeScrollStep(y: number, viewportHeight: number): number {
  const depth = Math.max(EDGE_SCROLL_ZONE_PX - y, y - (viewportHeight - EDGE_SCROLL_ZONE_PX));
  if (depth <= 0) return 0;
  const step = Math.ceil(EDGE_SCROLL_MAX_PX * Math.min(1, depth / EDGE_SCROLL_ZONE_PX));
  return y < viewportHeight / 2 ? -step : step;
}
