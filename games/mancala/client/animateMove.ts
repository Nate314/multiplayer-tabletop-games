import { prefersReducedMotion } from '../../../src/animation/motion.ts';
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
const FLY_MS = 380; // captured and swept stones into a bank
const FLY_STAGGER_MS = 30;
const FLY_SPREAD_MS = 300;
const LIFTED_SCALE = 1.3;

type Point = { x: number; y: number };
// Where a stone lands and when it leaves its previous place and arrives there
type Stop = { hole: number; index: number; count: number; depart: number; arrive: number };
type Path = { hole: number; index: number; stops: Stop[]; lifted: boolean };

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
    path.stops.push({ hole: to, index: holes[to].length - 1, count: holes[to].length, depart, arrive: end });
    settled.set(from, Math.max(settled.get(from) ?? 0, depart));
    settled.set(to, end);
  });
  return end;
}

// The stones are picked up together, dropped one at a time into the following holes, and then any captured and
// swept stones fly to their bank. Each stone's element rests where it ends up, so it animates from where it started.
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  root.querySelectorAll('.stone, .count').forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
  const { lastMove } = next;
  if (!lastMove || prefersReducedMotion()) return;
  const { drops, capture, sweep } = playPit(previous.board, lastMove.playerNumber, lastMove.pit);

  const holes: Path[][] = previous.board.map((stones, hole) =>
    stones.map((_, index) => ({ hole, index, stops: [], lifted: hole === lastMove.pit }))
  );
  const settled = new Map<number, number>();
  const spread = (count: number, most: number, total: number) => Math.min(most, total / Math.max(count - 1, 1));
  let time = replay(holes, settled, drops, LIFT_MS, spread(drops.length, DROP_STAGGER_MS, DROP_SPREAD_MS), HOP_MS);
  if (capture.length > 0) {
    time = replay(holes, settled, capture, time + PAUSE_MS, spread(capture.length, FLY_STAGGER_MS, FLY_SPREAD_MS), FLY_MS);
  }
  if (sweep.length > 0) {
    replay(holes, settled, sweep, time + PAUSE_MS, spread(sweep.length, FLY_STAGGER_MS, FLY_SPREAD_MS), FLY_MS);
  }

  // A stone lands where the board would draw it with that many stones in the hole
  function spotIn(hole: number, index: number, count: number): Point | undefined {
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
    const last = path.stops.at(-1);
    if (!last) continue;
    const element = root.querySelector(`[data-anim-key="${stoneKey(last.hole, last.index)}"]`);
    const startRect = rectOf(stoneKey(path.hole, path.index)) ?? rectOf(holeKey(path.hole));
    if (!element || !startRect) continue;

    const end = centerOf(element.getBoundingClientRect());
    const offset = ({ x, y }: Point) => `${x - end.x}px ${y - end.y}px`;
    let at = offset(centerOf(startRect));
    let scale = 1;
    const frames: Keyframe[] = [{ offset: 0, translate: at, scale }];
    if (path.lifted) {
      scale = LIFTED_SCALE;
      frames.push({ offset: LIFT_MS, translate: at, scale });
    }
    for (const [index, stop] of path.stops.entries()) {
      const spot = index === path.stops.length - 1 ? end : spotIn(stop.hole, stop.index, stop.count);
      if (!spot) continue;
      frames.push({ offset: stop.depart, translate: at, scale, easing: 'ease-in-out' });
      at = offset(spot);
      scale = 1;
      frames.push({ offset: stop.arrive, translate: at, scale });
    }
    // Keyframe offsets are fractions of the whole animation, which ends when the stone comes to rest.
    // A moving stone is drawn over the resting ones.
    const duration = last.arrive;
    element.animate(frames.map(frame => ({ ...frame, offset: (frame.offset as number) / duration, zIndex: 2 })), { duration });
  }

  // The DOM already shows the final counts, so a changing hole hides its count until its stones settle
  for (const [hole, settledAt] of settled) {
    const count = root.querySelector(`[data-anim-key="${holeKey(hole)}"] .count`);
    count?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: settledAt });
  }
}
