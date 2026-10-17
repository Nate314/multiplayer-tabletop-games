import { slideFrom } from '../../../src/animation/motion.ts';
import { COLORS, wallColumn } from '../rules.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Color, PublicGameState, Seat } from '../types.ts';

export const factoryKey = (index: number, slot: number) => `factory-${index}-${slot}`;
export const centerKey = (slot: number) => `center-${slot}`;
export const CENTER_MARKER_KEY = 'center-marker';
export const lineKey = (seat: Seat, row: number, slot: number) => `line-${seat}-${row}-${slot}`;
export const floorKey = (seat: Seat, slot: number) => `floor-${seat}-${slot}`;
export const wallKey = (seat: Seat, row: number, col: number) => `wall-${seat}-${row}-${col}`;

// The order a factory or the center shows its tiles in, so slot j of a pile is byColor(pile)[j]
export const byColor = (tiles: Color[]): Color[] =>
  [...tiles].sort((a, b) => COLORS.indexOf(a) - COLORS.indexOf(b));

type Table = Pick<PublicGameState, 'factories' | 'center' | 'centerHasMarker' | 'boards' | 'lastMove'>;

// Where each moved piece came from and the slot it now shows in, as [from key, to key]
export function slides(previous: Table, next: Table): [string, string][] {
  const { lastMove } = next;
  if (!lastMove) return [];
  const { playerNumber: seat, source, color, line } = lastMove;
  const before = previous.boards[seat];
  const after = next.boards[seat];
  if (!before || !after) return [];
  const result: [string, string][] = [];

  const pile = byColor(source.type === 'center' ? previous.center : previous.factories[source.index] ?? []);
  const pileKey = (slot: number) => (source.type === 'center' ? centerKey(slot) : factoryKey(source.index, slot));
  const picked = pile.flatMap((tile, slot) => (tile === color ? [pileKey(slot)] : []));

  // A move that ends the round and completes its line sends that line straight to the wall
  const completedLine = line !== 'floor' &&
    after.wall[line][wallColumn(line, color)] && !before.wall[line][wallColumn(line, color)];
  let placed = 0;
  if (line !== 'floor') {
    const countBefore = before.patternLines[line].count;
    placed = (completedLine ? line + 1 : after.patternLines[line].count) - countBefore;
    // Lines fill from the right, so the new tiles sit just left of the ones already there
    if (!completedLine) {
      picked.slice(0, placed).forEach((from, index) => result.push([from, lineKey(seat, line, line - countBefore - index)]));
    }
  }

  // The marker goes down first, then the tiles that did not fit. A round-ending move animates
  // neither: scoring has already cleared the floor, so their slots are empty.
  const takesMarker = source.type === 'center' && previous.centerHasMarker;
  const dropped = [...(takesMarker ? [CENTER_MARKER_KEY] : []), ...picked.slice(placed)];
  dropped.forEach((from, index) => {
    const slot = before.floor.length + index;
    if (slot < after.floor.length) result.push([from, floorKey(seat, slot)]);
  });

  // The rest of a factory joins the end of each color's group in the center
  if (source.type === 'factory') {
    const center = byColor(next.center);
    const moved = new Map<Color, number>();
    pile.forEach((tile, slot) => {
      if (tile === color) return;
      const index = moved.get(tile) ?? 0;
      moved.set(tile, index + 1);
      const target = center.indexOf(tile) + previous.center.filter(other => other === tile).length + index;
      result.push([pileKey(slot), centerKey(target)]);
    });
  }

  // At the round end each full line leaves one tile on the wall, taken from the line's last slot.
  // The line this move completed was never shown full, so its tile comes from where it was picked.
  // There is one wall tile to move, so the first picked tile stands for them all.
  for (const [key, board] of Object.entries(next.boards)) {
    const boardSeat = Number(key);
    const wallBefore = previous.boards[boardSeat]?.wall;
    if (!wallBefore) continue;
    board.wall.forEach((cells, row) => cells.forEach((filled, col) => {
      if (!filled || wallBefore[row][col]) return;
      const from = completedLine && boardSeat === seat && row === line ? picked[0] : lineKey(boardSeat, row, row);
      result.push([from, wallKey(boardSeat, row, col)]);
    }));
  }
  return result;
}

// Every piece the move put somewhere new slides there from its old slot
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  for (const [fromKey, toKey] of slides(previous, next)) {
    const element = root.querySelector(`[data-anim-key="${toKey}"]`);
    const from = rectOf(fromKey);
    if (element && from) slideFrom(element, from);
  }
}
