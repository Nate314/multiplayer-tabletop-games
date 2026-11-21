import type { KeyboardEvent, Ref } from 'react';
import ShapeArt from './ShapeArt';
import { shapeLabel } from '../shapes.ts';
import type { Layout } from '../board.ts';
import type { SeatBoard } from '../types.ts';

type RaceBoardProps = {
  layout: Layout;
  placed: SeatBoard['placed'];
  highlight?: number | null; // a hole to outline, for the history
  popped?: boolean; // the pop: placed shapes spring up out of their holes
  label?: string;
  svgRef?: Ref<SVGSVGElement>;
  // Makes the empty holes keyboard targets, one tab stop: `focused` is the one in the tab order
  targets?: { focused: number; onFocus(hole: number): void; onKey(hole: number, event: KeyboardEvent): void; onClick(hole: number): void };
};

// The holes on a square grid, row-major, with each placed shape sitting in its hole the right way up
export default function RaceBoard({ layout, placed, highlight = null, popped = false, label, svgRef, targets }: RaceBoardProps) {
  const n = Math.sqrt(layout.size);
  return (
    <svg ref={svgRef} className={popped ? 'sr-board sr-popped' : 'sr-board'} viewBox={`0 0 ${n * 100} ${n * 100}`} role={targets ? 'group' : 'img'} aria-label={label}>
      <rect className="sr-board-face" width={n * 100} height={n * 100} rx="12" />
      {layout.holes.map((id, hole) => (
        <g
          key={hole}
          transform={`translate(${(hole % n) * 100} ${Math.floor(hole / n) * 100}) translate(10 10) scale(0.8)`}
          {...(targets && placed[hole] === undefined && {
            className: 'sr-target',
            role: 'button',
            tabIndex: targets.focused === hole ? 0 : -1,
            'aria-label': `Hole ${hole + 1} of ${layout.size}, ${shapeLabel(id)}`,
            'data-hole': hole,
            onFocus: () => targets.onFocus(hole),
            onKeyDown: (event: KeyboardEvent) => targets.onKey(hole, event),
            onClick: () => targets.onClick(hole)
          })}
        >
          {targets && placed[hole] === undefined && <rect className="sr-ring" x="-8" y="-8" width="116" height="116" rx="10" />}
          {highlight === hole && <rect className="sr-highlight" x="-8" y="-8" width="116" height="116" rx="10" />}
          <ShapeArt id={id} className="sr-hole" />
          {placed[hole] !== undefined && <g className="sr-placed" style={{ animationDelay: `${(hole % 5) * 40}ms` }}><ShapeArt id={id} className="sr-piece" /></g>}
        </g>
      ))}
    </svg>
  );
}
