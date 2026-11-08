import { PART_RADIUS } from '../board.ts';
import type { Part, Point } from '../types.ts';

// A round part with a polygon mark whose corner count tells the parts apart: the Bolt a triangle, the Sensor 12 corners
function mark(part: Part): string {
  const sides = part.id + 3;
  const r = PART_RADIUS * 0.6;
  return Array.from({ length: sides }, (_, i) => {
    const angle = (i / sides) * 2 * Math.PI - Math.PI / 2;
    return `${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

// Placed with a CSS transform, so a watcher's part can glide between streamed positions
export default function PartArt({ part, at, className = 'sh-part' }: { part: Part; at: Point; className?: string }) {
  return (
    <g className={className} style={{ transform: `translate(${at[0]}px, ${at[1]}px)` }}>
      <circle className="sh-part-body" r={PART_RADIUS} />
      <polygon className="sh-part-mark" points={mark(part)} />
    </g>
  );
}
