import { memo, type CSSProperties } from 'react';
import { PICTURE_H, PICTURE_W } from '../pictures.ts';
import type { PiecePointerProps } from './usePieceDrag.ts';

type PieceShapeProps = {
  piece: number;
  x: number;
  y: number;
  offset: { x: number; y: number }; // its cell's top left within the picture
  cell: { w: number; h: number };
  path: string;
  fillId: string;
  url: string;
  placed: boolean;
  heldBy: number | null; // someone else's seat
  holderName?: string;
  highlighted?: boolean;
  pointer?: PiecePointerProps; // only on a piece this player can lift
};

// One piece: its shape filled with its part of the picture, moved to (x, y). Memoized, so a drag re-renders only the
// dragged piece. A pattern rather than a clipped <image>, so the piece's bounding box is its shape, not the whole picture.
// The pattern's tile is the cell and half a cell around it, room for any tab
function PieceShape({ piece, x, y, offset, cell, path, fillId, url, placed, heldBy, holderName, highlighted, pointer }: PieceShapeProps) {
  const classes = ['jigsaw-piece', placed && 'placed', heldBy !== null && 'held', pointer && 'liftable', highlighted && 'highlighted'];
  const margin = { x: cell.w / 2, y: cell.h / 2 };
  return (
    <g
      className={classes.filter(Boolean).join(' ')}
      data-piece={piece}
      data-drag={pointer ? '' : undefined}
      data-held-by={heldBy ?? undefined}
      transform={`translate(${x},${y})`}
      style={heldBy !== null ? { '--holder': `var(--player${heldBy})` } as CSSProperties : undefined}
      {...pointer}
    >
      <pattern id={fillId} patternUnits="userSpaceOnUse" x={-margin.x} y={-margin.y} width={2 * cell.w} height={2 * cell.h}>
        {/* A photo of any shape is center-cropped to the picture's 3:2 */}
        <image
          href={url}
          x={margin.x - offset.x}
          y={margin.y - offset.y}
          width={PICTURE_W}
          height={PICTURE_H}
          preserveAspectRatio="xMidYMid slice"
        />
      </pattern>
      <path className="jigsaw-piece-face" d={path} fill={`url(#${fillId})`} />
      {heldBy !== null && holderName && <text className="jigsaw-holder" x={0} y={-8}>{holderName}</text>}
    </g>
  );
}

export default memo(PieceShape);
