import { useId, useMemo } from 'react';
import { BOARD_X, BOARD_Y, TABLE_H, TABLE_W, edgesOf, gridOf, homeOf, piecePath, type PieceCount } from '../cut.ts';
import { PICTURE_H, PICTURE_W } from '../pictures.ts';
import PieceShape from './PieceShape';
import { pictureUrl } from './pictureUrl.ts';
import type { Dragging, PiecePointerProps } from './usePieceDrag.ts';
import type { Board, Picture, Piece, Seat } from '../types.ts';

// Room around the table for the tabs of a piece lying at its edge (at most 0.22 of the largest cell, 240)
const PAD = 60;

export type TableProps = {
  picture: Picture;
  count: PieceCount;
  seed: number;
  board: Board;
  viewer: Seat | null;
  playerNames: Record<Seat, string>;
  guide?: boolean;
  highlight?: number | null; // a piece outlined, as History shows the last move
  // Absent for a read-only table
  drag?: { dragging: Dragging | null; canLift(piece: number): boolean; bind(piece: number): PiecePointerProps };
};

// Bottom to top: placed, loose, held by others, held by the viewer
function layer(piece: Piece, viewer: Seat | null): number {
  if (piece.placed) return 0;
  if (piece.heldBy === null) return 1;
  return piece.heldBy === viewer ? 3 : 2;
}

export default function Table({ picture, count, seed, board, viewer, playerNames, guide, highlight, drag }: TableProps) {
  const fillPrefix = `jigsaw${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const url = pictureUrl(picture);
  // The cut changes only with a new seed or piece count, never during a drag
  const cut = useMemo(() => {
    const grid = gridOf(count);
    const edges = edgesOf(seed, grid);
    return Array.from({ length: grid.cols * grid.rows }, (_, piece) => {
      const home = homeOf(grid, piece);
      return { home, grid, path: piecePath(grid, edges, piece), offset: { x: home.x - BOARD_X, y: home.y - BOARD_Y } };
    });
  }, [count, seed]);

  const dragging = drag?.dragging ?? null;
  const order = board.pieces
    .map((piece, index) => ({ piece, index, layer: index === dragging?.piece ? 4 : layer(piece, viewer) }))
    .filter(({ index }) => index < cut.length)
    .sort((a, b) => a.layer - b.layer || a.index - b.index);

  return (
    <svg className="jigsaw-table" viewBox={`${-PAD} ${-PAD} ${TABLE_W + 2 * PAD} ${TABLE_H + 2 * PAD}`} role="img" aria-label="Puzzle table">
      <rect className="jigsaw-table-cloth" x={0} y={0} width={TABLE_W} height={TABLE_H} rx={24} />
      <rect className="jigsaw-board" x={BOARD_X} y={BOARD_Y} width={PICTURE_W} height={PICTURE_H} />
      {guide && (
        <image className="jigsaw-guide" href={url} x={BOARD_X} y={BOARD_Y} width={PICTURE_W} height={PICTURE_H}
          preserveAspectRatio="xMidYMid slice" opacity={0.15} />
      )}
      {cut.map(({ home, grid }, piece) => (
        <rect key={piece} className="jigsaw-spot" data-spot={piece} x={home.x} y={home.y} width={grid.w} height={grid.h} />
      ))}
      {order.map(({ piece, index }) => {
        const mine = dragging?.piece === index;
        const heldByOther = !mine && piece.heldBy !== null && piece.heldBy !== viewer ? piece.heldBy : null;
        const liftable = drag !== undefined && (mine || drag.canLift(index));
        return (
          <PieceShape
            key={index}
            piece={index}
            x={mine ? dragging.x : piece.x}
            y={mine ? dragging.y : piece.y}
            offset={cut[index].offset}
            cell={cut[index].grid}
            path={cut[index].path}
            fillId={`${fillPrefix}-${index}`}
            url={url}
            placed={piece.placed && !mine}
            heldBy={heldByOther}
            holderName={heldByOther === null ? undefined : playerNames[heldByOther]}
            highlighted={highlight === index}
            pointer={liftable ? drag.bind(index) : undefined}
          />
        );
      })}
    </svg>
  );
}
