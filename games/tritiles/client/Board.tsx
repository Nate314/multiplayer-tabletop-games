import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import { keepCentre } from '../../../shared/zoom.ts';
import { cellKey, edgeNeighbours, verticesOf } from '../grid.ts';
import type { Board as BoardModel, Cell } from '../grid.ts';
import { TILES } from '../tiles.ts';

type Corners = readonly [number, number, number];

const H = Math.sqrt(3) / 2;
const UNIT = 64; // pixels per tile side at 1x
const ZOOMS = [0.5, 0.75, 1, 1.5, 2];

// Where a lattice point is drawn (see grid.ts): point (i, j) at (i - j / 2, j * h)
function at(vertex: string): [number, number] {
  const [i, j] = vertex.split(',').map(Number);
  return [i - j / 2, j * H];
}
const outline = (cell: Cell) => verticesOf(cell).map(v => at(v).join(',')).join(' ');

// One triangle: the face and edge here, the corner numbers the server drawing (games/tritiles/svg.ts), whose
// 100 by 90 box sits on the cell's bounding box
export function TriangleArt({ cell, corners, className, title }: { cell: Cell; corners: Corners; className?: string; title?: string }) {
  const points = verticesOf(cell).map(at);
  const left = Math.min(...points.map(p => p[0]));
  const top = Math.min(...points.map(p => p[1]));
  return (
    <g className={['tri', className].filter(Boolean).join(' ')}>
      <polygon className="tri-face" points={outline(cell)} />
      <ServerSvg
        inSvg
        url={svgUrl('tritile', ...corners, cell.up ? 'up' : 'down')}
        title={title}
        svgProps={{ x: left, y: top, width: 1, height: 0.9 }}
      />
    </g>
  );
}

const onKey = (action: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

// Top to bottom, then left to right
const readingOrder = (a: Cell, b: Cell) => {
  const [ax, ay] = at(verticesOf(a)[0]);
  const [bx, by] = at(verticesOf(b)[0]);
  return ay - by || ax - bx;
};

type BoardProps = {
  board: BoardModel;
  lastCell?: Cell | null; // the tile the last move played, outlined
  targets?: Cell[]; // the spaces the held tile fits: buttons, and drop targets for a drag
  preview?: { cell: Cell; corners: Corners } | null; // the tile on the chosen space, before Confirm
  onCell?: (cell: Cell) => void;
};

// The placed triangles in an SVG inside a scroll box, with zoom buttons. A finger or the wheel scrolls the box to pan,
// and a zoom keeps the point in the middle of the box where it was
export default function Board({ board, lastCell = null, targets = [], preview = null, onCell }: BoardProps) {
  const [zoom, setZoom] = useState(1);
  const scrollBox = useRef<HTMLDivElement>(null);
  const shownZoom = useRef(zoom);
  useLayoutEffect(() => {
    const box = scrollBox.current;
    const from = shownZoom.current;
    shownZoom.current = zoom;
    if (!box || from === zoom) return;
    box.scrollLeft = keepCentre(box.scrollLeft, box.clientWidth, from, zoom);
    box.scrollTop = keepCentre(box.scrollTop, box.clientHeight, from, zoom);
  }, [zoom]);
  // A board bigger than the box opens on its middle, where the round began
  useLayoutEffect(() => {
    const box = scrollBox.current;
    if (!box) return;
    box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
    box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
  }, []);

  // Every placed tile and every space next to one, so the board does not grow when spaces light up
  const placed = board.length > 0 ? board.map(p => p.cell) : [{ x: 0, y: 0, up: true }];
  const points = [...placed, ...placed.flatMap(edgeNeighbours)].flatMap(cell => verticesOf(cell).map(at));
  const pad = 0.15;
  const minX = Math.min(...points.map(p => p[0])) - pad;
  const minY = Math.min(...points.map(p => p[1])) - pad;
  const width = Math.max(...points.map(p => p[0])) + pad - minX;
  const height = Math.max(...points.map(p => p[1])) + pad - minY;
  const spaces = [...targets].sort(readingOrder);
  const step = (by: number) => setZoom(z => ZOOMS[Math.min(Math.max(ZOOMS.indexOf(z) + by, 0), ZOOMS.length - 1)]);

  return (
    <div className="board-area hand-only-board">
      <div className="board-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => step(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]}>Zoom in</button>
        <button type="button" onClick={() => step(-1)} disabled={zoom === ZOOMS[0]}>Zoom out</button>
      </div>
      <div className="board-scroll" ref={scrollBox}>
        <svg
          className="board"
          role="group"
          aria-label={board.length === 0 ? 'Board, no tiles played yet' : 'Board'}
          viewBox={`${minX} ${minY} ${width} ${height}`}
          width={width * UNIT * zoom}
          height={height * UNIT * zoom}
        >
          {board.map(({ tile, cell, corners }) => (
            <TriangleArt
              key={cellKey(cell)}
              cell={cell}
              corners={corners}
              title={TILES[tile].join('-')}
              className={lastCell && cellKey(lastCell) === cellKey(cell) ? 'tri-last' : undefined}
            />
          ))}
          {spaces.map((cell, i) => (
            <polygon
              key={cellKey(cell)}
              className="tri-space"
              points={outline(cell)}
              data-drop={cellKey(cell)}
              role="button"
              tabIndex={0}
              aria-label={`Space ${i + 1} of ${spaces.length}`}
              onClick={() => onCell?.(cell)}
              onKeyDown={onKey(() => onCell?.(cell))}
            />
          ))}
          {preview && <TriangleArt cell={preview.cell} corners={preview.corners} className="tri-preview" />}
        </svg>
      </div>
    </div>
  );
}
