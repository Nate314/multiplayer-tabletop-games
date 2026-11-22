import { SHAPES } from '../shapes.ts';
import type { ShapeId } from '../shapes.ts';

const PATHS = new Map(SHAPES.map(s => [s.id, s.path]));

// One shape in a 100 x 100 box, turned `turns` 45 degree steps about its middle; `className` picks hole or piece colors
export default function ShapeArt({ id, turns = 0, className }: { id: ShapeId; turns?: number; className: string }) {
  return <path className={className} d={PATHS.get(id)} transform={turns ? `rotate(${turns * 45} 50 50)` : undefined} />;
}
