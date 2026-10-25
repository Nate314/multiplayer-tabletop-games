import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import usePreloadSvgs from '../../../src/assets/usePreloadSvgs.ts';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import type { Color, PieceType } from '../types.ts';

const pieceUrl = (color: Color, type: PieceType) => svgUrl('chess-piece', color, type);
const TYPES: PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const CHESS_PIECES = (['white', 'black'] as Color[]).flatMap(color => TYPES.map(type => pieceUrl(color, type)));

type PieceGlyphProps = {
  color: Color;
  type: PieceType;
  animKey?: string;
  dragProps?: DragSourceProps;
};

// A piece drawn by the server (games/chess/svg.ts), one em square, so the surrounding font size sizes it
export default function PieceGlyph({ color, type, animKey, dragProps }: PieceGlyphProps) {
  usePreloadSvgs(CHESS_PIECES);
  return (
    <span className={`piece ${color}`} role="img" aria-label={`${color} ${type}`} data-anim-key={animKey} {...dragProps}>
      <ServerSvg url={pieceUrl(color, type)} className="piece-art" />
    </span>
  );
}
