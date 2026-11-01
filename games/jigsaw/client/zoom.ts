// The scroll offset that keeps the point at the middle of a `view` wide window in the same place when the content scales
export function keepCentre(scroll: number, view: number, from: number, to: number): number {
  return Math.max(0, ((scroll + view / 2) * to) / from - view / 2);
}
