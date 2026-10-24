import { MOVE_DURATION_MS, ghostSlide, prefersReducedMotion, slideFrom } from '../../../src/animation/motion.ts';
import { BLANK, tileValue } from '../rules.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { LastMove, PublicGameState, RackTile, Seat } from '../types.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';

export const squareKey = (row: number, col: number) => `square-${row}-${col}`;
export const rackKey = (position: number) => `rack-${position}`; // a place on the rack, whichever tile shows there
export const BAG_KEY = 'bag';

// The gap between tiles that follow one another
export const STAGGER_MS = 70;

export const identityOrder = (rack: RackTile[]) => rack.map((_, slot) => slot);

// How the viewer's rack changed with their own move, in rack places: each kept tile as [old place, new place],
// the new places of the drawn tiles and the old places of the tiles that left.
// The new rack is the kept tiles in their old slot order, then the drawn ones, and is shown unshuffled.
export type RackSlides = { kept: [number, number][]; drawn: number[]; left: number[] };

export function rackSlides(previousRack: RackTile[], previousOrder: number[], nextRack: RackTile[], used: number): RackSlides {
  const keptCount = previousRack.length - used;
  const result: RackSlides = { kept: [], drawn: [], left: [] };
  // Any tile of the same letter looks the same, so the kept tiles match the old rack in order
  let index = 0;
  previousRack.forEach((tile, slot) => {
    const place = previousOrder.indexOf(slot);
    if (index < keptCount && tile === nextRack[index]) result.kept.push([place, index++]);
    else result.left.push(place);
  });
  for (let place = keptCount; place < nextRack.length; place++) result.drawn.push(place);
  return result;
}

// How many rack tiles a move put down or back in the bag
export function tilesUsed(lastMove: LastMove): number {
  if (lastMove.type === 'play') return lastMove.tiles.length;
  if (lastMove.type === 'exchange') return lastMove.count;
  return 0;
}

// A copy of a tile that left the rack, drawn where it was and slid into the bag
function ghostToBag(root: HTMLElement, letter: RackTile, from: DOMRect, to: DOMRect, delayMs: number) {
  const ghost = document.createElement('span');
  ghost.className = letter === BLANK ? 'tile tile-blank' : 'tile';
  ghost.style.fontSize = `${from.height / 2}px`;
  const letterSpan = ghost.appendChild(document.createElement('span'));
  letterSpan.className = 'tile-letter';
  letterSpan.textContent = letter === BLANK ? '' : letter;
  if (tileValue(letter) > 0) {
    const value = ghost.appendChild(document.createElement('span'));
    value.className = 'tile-value';
    value.textContent = String(tileValue(letter));
  }
  ghostSlide(root, ghost, from, to, delayMs);
}

// A play slides its tiles onto the board one after another from the player's score row; your own play is
// already on the board. Your own play or exchange slides the kept tiles to their new places, the exchanged
// ones into the bag and the drawn ones from the bag onto the rack.
export function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>, viewer: Seat, previousOrder: number[]) {
  const { lastMove } = next;
  if (!lastMove || lastMove.type === 'pass') return;
  const slide = (fromKey: string, toKey: string, delayMs = 0) => {
    const element = root.querySelector(`[data-anim-key="${toKey}"]`);
    const from = rectOf(fromKey);
    if (element && from) slideFrom(element, from, MOVE_DURATION_MS, delayMs);
  };

  if (lastMove.playerNumber !== viewer) {
    if (lastMove.type === 'play') {
      lastMove.tiles.forEach(({ row, col }, index) => slide(seatKey(lastMove.playerNumber), squareKey(row, col), index * STAGGER_MS));
    }
    return;
  }

  const { kept, drawn, left } = rackSlides(previous.rack, previousOrder, next.rack, tilesUsed(lastMove));
  kept.forEach(([from, to]) => slide(rackKey(from), rackKey(to)));
  drawn.forEach((place, index) => slide(BAG_KEY, rackKey(place), index * STAGGER_MS));
  const bag = rectOf(BAG_KEY);
  if (lastMove.type !== 'exchange' || !bag || prefersReducedMotion()) return;
  left.forEach((place, index) => {
    const from = rectOf(rackKey(place));
    const letter = previous.rack[previousOrder[place]];
    if (from && letter !== undefined) ghostToBag(root, letter, from, bag, index * STAGGER_MS);
  });
}
