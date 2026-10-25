export type Size = { width: number; height: number };

// The scale that fits `content` inside `box`: a board only shrinks, never grows, so its text stays sharp
export function fitScale(content: Size, box: Size): number {
  if (!content.width || !content.height) return 1;
  return Math.min(1, box.width / content.width, box.height / content.height);
}

// While the dialog is open the scale only goes down, so a smaller step never enlarges the board again;
// only a resized box (the window changed) starts over from the fit
export function nextScale(previous: number | null, fit: number, boxResized: boolean): number {
  return previous === null || boxResized ? fit : Math.min(previous, fit);
}
