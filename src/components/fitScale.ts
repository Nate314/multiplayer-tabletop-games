export type Size = { width: number; height: number };

// The scale that fits `content` inside `box`: a board only shrinks by default, so its text stays sharp;
// a shared screen passes a larger `max` so a small board grows to fill it
export function fitScale(content: Size, box: Size, max = 1): number {
  if (!content.width || !content.height) return 1;
  return Math.min(max, box.width / content.width, box.height / content.height);
}

// While the dialog is open the scale only goes down, so a smaller step never enlarges the board again;
// only a resized box (the window changed) starts over from the fit
export function nextScale(previous: number | null, fit: number, boxResized: boolean): number {
  return previous === null || boxResized ? fit : Math.min(previous, fit);
}
