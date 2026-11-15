import type { Ref } from 'react';
import ShapeArt from './ShapeArt';
import type { Layout } from '../board.ts';
import type { SeatBoard } from '../types.ts';

type RaceBoardProps = {
  layout: Layout;
  placed: SeatBoard['placed'];
  highlight?: number | null; // a hole to outline, for the history
  popped?: boolean; // the pop: placed shapes spring up out of their holes
  label?: string;
  svgRef?: Ref<SVGSVGElement>;
};

// The holes on a square grid, row-major, with each placed shape sitting in its hole the right way up
export default function RaceBoard({ layout, placed, highlight = null, popped = false, label, svgRef }: RaceBoardProps) {
  const n = Math.sqrt(layout.size);
  return (
    <svg ref={svgRef} className={popped ? 'sr-board sr-popped' : 'sr-board'} viewBox={`0 0 ${n * 100} ${n * 100}`} role="img" aria-label={label}>
      <rect className="sr-board-face" width={n * 100} height={n * 100} rx="12" />
      {layout.holes.map((id, hole) => (
        <g key={hole} transform={`translate(${(hole % n) * 100} ${Math.floor(hole / n) * 100}) translate(10 10) scale(0.8)`}>
          {highlight === hole && <rect className="sr-highlight" x="-8" y="-8" width="116" height="116" rx="10" />}
          <ShapeArt id={id} className="sr-hole" />
          {placed[hole] !== undefined && <g className="sr-placed" style={{ animationDelay: `${(hole % 5) * 40}ms` }}><ShapeArt id={id} className="sr-piece" /></g>}
        </g>
      ))}
    </svg>
  );
}
