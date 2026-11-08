// The seats in turn order, starting with the viewer. The wrap-around is the table's highest seat, not the box maximum,
// since a stretched table seats more than that
export function seatOrder(seats: number[], viewer: number): number[] {
  const size = Math.max(viewer, ...seats);
  const stepsAfterViewer = (seat: number) => (seat - viewer + size) % size;
  return [...seats].sort((a, b) => stepsAfterViewer(a) - stepsAfterViewer(b));
}
