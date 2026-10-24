import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import TileArt from './TileArt';
import Meeple from './Meeple';
import { spotOf } from './spots.ts';
import { meepleKey, tileKey } from './keys.ts';
import type { FeatureRef, Placement, Seat, TileType } from '../types.ts';
import { swallowNextClick } from '../../../src/drag/swallowClick.ts';

export const CELL = 100;
const MARGIN = 1.5; // cells of space around the tiles when fitting the board
const MIN_SPAN = 4 * CELL;
const MAX_SPAN = 40 * CELL;
const FOCUS_SPAN = 5; // cells across the close view of one square
const DRAG_THRESHOLD = 5; // pixels before a press counts as a drag rather than a click

export type Cell = { x: number; y: number };
export type Preview = Cell & { tile: TileType; rotation: number };
export type MeepleChoice = { feature: FeatureRef; selected: boolean };

type BoardProps = {
  board: Placement[];
  highlight?: number | null; // the board index outlined as the last move
  cells?: Cell[]; // squares where the current tile fits, clickable
  preview?: Preview | null; // the current tile shown where it would go
  onCell?: (cell: Cell) => void;
  meepleSeat?: Seat; // the player choosing a meeple spot on the last tile
  meepleChoices?: MeepleChoice[];
  onMeeple?: (feature: FeatureRef) => void;
  focus?: Cell | null; // a square to show up close, such as the tile waiting for its meeple
};

type View = { x: number; y: number; w: number; h: number };

function fit(board: Placement[], extra: Cell[]): View {
  const cells = [...board, ...extra];
  const xs = cells.map(cell => cell.x), ys = cells.map(cell => cell.y);
  const minX = Math.min(...xs) - MARGIN + 0.5, maxX = Math.max(...xs) + MARGIN + 0.5;
  const minY = Math.min(...ys) - MARGIN + 0.5, maxY = Math.max(...ys) + MARGIN + 0.5;
  const w = Math.max(MIN_SPAN, (maxX - minX) * CELL), h = Math.max(MIN_SPAN, (maxY - minY) * CELL);
  const cx = ((minX + maxX) / 2) * CELL, cy = ((minY + maxY) / 2) * CELL;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

// A close view of one square and the squares around it
function around(cell: Cell): View {
  const span = FOCUS_SPAN * CELL;
  return { x: (cell.x + 0.5) * CELL - span / 2, y: (cell.y + 0.5) * CELL - span / 2, w: span, h: span };
}

// The board as an SVG map: drag to pan, the wheel or the buttons to zoom, Fit to see every tile again.
// While the player has not moved the view, it refits by itself as the board grows, or shows `focus` up close.
export default function Board({ board, highlight = null, cells = [], preview = null, onCell, meepleSeat, meepleChoices = [], onMeeple, focus = null }: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const fitted = useMemo(() => (focus ? around(focus) : fit(board, cells)), [board, cells, focus]);
  // A view the player moved to, kept until the focus comes or goes; null follows the fitted view
  const focusKey = focus ? `${focus.x},${focus.y}` : '';
  const [moved, setMoved] = useState<{ view: View; focusKey: string } | null>(null);
  const shown = moved && moved.focusKey === focusKey ? moved.view : fitted;
  const setView = (view: View | null) => setMoved(view && { view, focusKey });
  const drag = useRef<{ id: number; x: number; y: number; view: View; moved: boolean } | null>(null);

  // Scale from screen pixels to board units, as the SVG keeps its aspect ratio
  const unitsPerPixel = (current: View) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return 1;
    return Math.max(current.w / rect.width, current.h / rect.height);
  };

  const zoom = (factor: number, pivot?: { x: number; y: number }) => {
    const from = shown;
    const w = Math.min(MAX_SPAN, Math.max(MIN_SPAN, from.w * factor));
    const scale = w / from.w;
    const cx = pivot?.x ?? from.x + from.w / 2, cy = pivot?.y ?? from.y + from.h / 2;
    setView({ x: cx - (cx - from.x) * scale, y: cy - (cy - from.y) * scale, w, h: from.h * scale });
  };

  // The wheel zooms about the pointer; React's wheel listener is passive, so scrolling the page is stopped here
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const stop = (event: WheelEvent) => event.preventDefault();
    svg.addEventListener('wheel', stop, { passive: false });
    return () => svg.removeEventListener('wheel', stop);
  }, []);

  const toBoard = (clientX: number, clientY: number, current: View) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = unitsPerPixel(current);
    return {
      x: current.x + current.w / 2 + (clientX - rect.left - rect.width / 2) * scale,
      y: current.y + current.h / 2 + (clientY - rect.top - rect.height / 2) * scale
    };
  };

  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, toBoard(event.clientX, event.clientY, shown));
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: shown, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!current.moved) svgRef.current?.setPointerCapture(event.pointerId);
    current.moved = true;
    const scale = unitsPerPixel(current.view);
    setView({ ...current.view, x: current.view.x - dx * scale, y: current.view.y - dy * scale });
  };

  // A drag swallows the click that ends it, so panning never places a tile
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (current?.moved) swallowNextClick();
    if (current && svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    drag.current = null;
  };

  const last = board[board.length - 1];
  return (
    <div className="cc-board">
      <svg
        ref={svgRef}
        className="cc-board-svg"
        viewBox={`${shown.x} ${shown.y} ${shown.w} ${shown.h}`}
        role="img"
        aria-label={`Board with ${board.length} tiles`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {board.map((placement, index) => (
          <g key={`${placement.x},${placement.y}`} transform={`translate(${placement.x * CELL} ${placement.y * CELL})`} data-anim-key={tileKey(index)}>
            <TileArt type={placement.tile} rotation={placement.rotation} />
          </g>
        ))}
        {highlight !== null && board[highlight] && (
          <rect className="cc-highlight" x={board[highlight].x * CELL + 2} y={board[highlight].y * CELL + 2} width={CELL - 4} height={CELL - 4} />
        )}
        {cells.map(cell => {
          const selected = preview?.x === cell.x && preview?.y === cell.y;
          return (
            <rect
              key={`cell-${cell.x},${cell.y}`}
              className={selected ? 'cc-cell cc-cell-selected' : 'cc-cell'}
              x={cell.x * CELL + 4}
              y={cell.y * CELL + 4}
              width={CELL - 8}
              height={CELL - 8}
              rx="6"
              role="button"
              aria-label={`Place the tile at column ${cell.x}, row ${cell.y}`}
              onClick={() => onCell?.(cell)}
            />
          );
        })}
        {preview && (
          <g className="cc-preview" transform={`translate(${preview.x * CELL} ${preview.y * CELL})`} pointerEvents="none">
            <TileArt type={preview.tile} rotation={preview.rotation} />
            <rect className="cc-preview-edge" width={CELL} height={CELL} />
          </g>
        )}
        {board.map((placement, index) => {
          if (!placement.meeple) return null;
          const spot = spotOf(placement.tile, placement.rotation, placement.meeple.feature);
          return (
            <g key={`meeple-${index}`} data-anim-key={meepleKey(index)}>
              <Meeple seat={placement.meeple.seat} x={placement.x * CELL + spot.x} y={placement.y * CELL + spot.y}
                lying={placement.meeple.feature.kind === 'field'} />
            </g>
          );
        })}
        {meepleSeat !== undefined && last && meepleChoices.map(({ feature, selected }) => {
          const spot = spotOf(last.tile, last.rotation, feature);
          const x = last.x * CELL + spot.x, y = last.y * CELL + spot.y;
          return (
            <g key={`${feature.kind}-${feature.index}`} className={selected ? 'cc-spot cc-spot-selected' : 'cc-spot'}
              role="button" aria-label={`Put a meeple on the ${feature.kind}`} onClick={() => onMeeple?.(feature)}>
              <circle cx={x} cy={y} r="11" />
              {selected && <Meeple seat={meepleSeat} x={x} y={y} lying={feature.kind === 'field'} />}
            </g>
          );
        })}
      </svg>
      <div className="cc-zoom">
        <button type="button" onClick={() => zoom(1 / 1.25)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => setView(null)}>Fit</button>
      </div>
    </div>
  );
}
