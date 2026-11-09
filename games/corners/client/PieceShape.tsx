import type { BoardKind, Cell } from '../geometry.ts';
import { cellPoints, pointsAttr, viewBoxOf } from './draw.ts';

// One piece drawn on its own, for the tray
export default function PieceShape({ kind, shape, color }: { kind: BoardKind; shape: Cell[]; color: number }) {
  return (
    <svg className="corners-piece-shape" viewBox={viewBoxOf(kind, shape, 0.15)} aria-hidden="true">
      {shape.map(c => <polygon key={c.join(',')} className={`corners-fill corners-c${color}`} points={pointsAttr(cellPoints(kind, c))} />)}
    </svg>
  );
}
