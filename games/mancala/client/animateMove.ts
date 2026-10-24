import { boardScale, prefersReducedMotion } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import { playPit } from '../rules.ts';
import { drawnCount, stoneSpot } from './stoneLayout.ts';
import type { PublicGameState, Transfer } from '../types.ts';

export const holeKey = (hole: number) => `hole-${hole}`;
export const stoneKey = (hole: number, index: number) => `stone-${hole}-${index}`;

const LIFT_MS = 150;
const HOP_MS = 280; // one stone's flight into a hole
const DROP_STAGGER_MS = 160; // between two dropped stones, shortened so a big handful still drops in about a second
const DROP_SPREAD_MS = 1000;
const PAUSE_MS = 120;
const FLY_MS = 380; // swept stones into a bank
const FLY_STAGGER_MS = 30;
const FLY_SPREAD_MS = 300;
const LIFTED_SCALE = 1.3;
const LONGEST_MS = 3000; // a longer move plays faster, so a long chain of pickups still ends in about this long

type Point = { x: number; y: number };
type Place = { hole: number; index: number; count: number };
// A stone's next change, from `depart` to `arrive`: lifted where it lies, or dropped `to` a place in a hole
type Stop = { depart: number; arrive: number; to?: Place };
type Path = { hole: number; index: number; stops: Stop[] };

const centerOf = (rect: DOMRect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

// Replays the transfers on the stones of the previous board, so each stone collects where and when it lands.
// Every phase starts when the previous one has landed; returns when the last stone of this one lands.
// `settled` collects when each hole the move touches stops changing.
function replay(
  holes: Path[][], settled: Map<number, number>, transfers: Transfer[], start: number, stagger: number, flight: number
): number {
  let end = start;
  transfers.forEach(({ from, to }, order) => {
    const path = holes[from].shift()!;
    holes[to].push(path);
    const depart = start + order * stagger;
    end = depart + flight;
    path.stops.push({ depart, arrive: end, to: { hole: to, index: holes[to].length - 1, count: holes[to].length } });
    settled.set(from, Math.max(settled.get(from) ?? 0, depart));
    settled.set(to, end);
  });
  return end;
}

// Every stone in `hole` is lifted together; returns when they are up
function lift(holes: Path[][], hole: number, start: number): number {
  for (const path of holes[hole]) path.stops.push({ depart: start, arrive: start + LIFT_MS });
  return start + LIFT_MS;
}

// Each pickup of the chain lifts its pit's stones and drops them one at a time into the following holes, then at the
// end of the game the rows fly to their banks. Each stone's element rests where it ends up, so it animates from where it started.
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  root.querySelectorAll('.stone, .count').forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
  const { lastMove } = next;
  if (!lastMove || prefersReducedMotion()) return;
  const { laps, sweep } = playPit(previous.board, lastMove.playerNumber, lastMove.pit);

  const holes: Path[][] = previous.board.map((stones, hole) => stones.map((_, index) => ({ hole, index, stops: [] })));
  const settled = new Map<number, number>();
  const spread = (count: number, most: number, total: number) => Math.min(most, total / Math.max(count - 1, 1));
  let time = 0;
  for (const drops of laps) {
    time = lift(holes, drops[0].from, time);
    time = replay(holes, settled, drops, time, spread(drops.length, DROP_STAGGER_MS, DROP_SPREAD_MS), HOP_MS) + PAUSE_MS;
  }
  if (sweep.length > 0) replay(holes, settled, sweep, time, spread(sweep.length, FLY_STAGGER_MS, FLY_SPREAD_MS), FLY_MS);
  // The times above are at full speed; a move that would take longer than LONGEST_MS is played faster throughout
  const speed = Math.min(1, LONGEST_MS / Math.max(...settled.values()));
  const fitScale = boardScale(root);

  // A stone lands where the board would draw it with that many stones in the hole
  function spotIn({ hole, index, count }: Place): Point | undefined {
    const element = root.querySelector(`[data-anim-key="${holeKey(hole)}"]`);
    if (!element) return undefined;
    const rect = element.getBoundingClientRect();
    if (index >= drawnCount(hole, count)) return centerOf(rect);
    const { x, y } = stoneSpot(hole, index, count);
    return {
      x: rect.x + element.clientLeft + x * element.clientWidth,
      y: rect.y + element.clientTop + y * element.clientHeight
    };
  }

  for (const path of holes.flat()) {
    // A lifted stone is always dropped afterwards, so a stone that moved ends with a drop
    const last = path.stops.at(-1);
    if (!last?.to) continue;
    const element = root.querySelector(`[data-anim-key="${stoneKey(last.to.hole, last.to.index)}"]`);
    const startRect = rectOf(stoneKey(path.hole, path.index)) ?? rectOf(holeKey(path.hole));
    if (!element || !startRect) continue;

    const end = centerOf(element.getBoundingClientRect());
    // Screen distances, divided by the scale of a board scaled to fit (History)
    const offset = ({ x, y }: Point) => `${(x - end.x) / fitScale}px ${(y - end.y) / fitScale}px`;
    let at = offset(centerOf(startRect));
    let scale = 1;
    const frames: Keyframe[] = [{ offset: 0, translate: at, scale }];
    for (const stop of path.stops) {
      if (!stop.to) {
        frames.push({ offset: stop.depart, translate: at, scale });
        scale = LIFTED_SCALE;
        frames.push({ offset: stop.arrive, translate: at, scale });
        continue;
      }
      const spot = stop === last ? end : spotIn(stop.to);
      if (!spot) continue;
      frames.push({ offset: stop.depart, translate: at, scale, easing: 'ease-in-out' });
      at = offset(spot);
      scale = 1;
      frames.push({ offset: stop.arrive, translate: at, scale });
    }
    // Keyframe offsets are fractions of the whole animation, which ends when the stone comes to rest.
    // A moving stone is drawn over the resting ones.
    const duration = last.arrive;
    element.animate(
      frames.map(frame => ({ ...frame, offset: (frame.offset as number) / duration, zIndex: 2 })), { duration: duration * speed }
    );
  }

  // The DOM already shows the final counts, so a changing hole hides its count until its stones settle
  for (const [hole, settledAt] of settled) {
    const count = root.querySelector(`[data-anim-key="${holeKey(hole)}"] .count`);
    count?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: settledAt * speed });
  }
}
