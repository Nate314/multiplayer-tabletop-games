import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import type { Color, PieceType } from '../types.ts';

// The solid glyphs for both colors, recolored by CSS; U+FE0E keeps them as text rather than emoji on phones
const GLYPHS: Record<PieceType, string> = {
  king: '♚︎',
  queen: '♛︎',
  rook: '♜︎',
  bishop: '♝︎',
  knight: '♞︎',
  pawn: '♟︎'
};

type PieceGlyphProps = {
  color: Color;
  type: PieceType;
  animKey?: string;
  dragProps?: DragSourceProps;
};

export default function PieceGlyph({ color, type, animKey, dragProps }: PieceGlyphProps) {
  return (
    <span className={`piece ${color}`} role="img" aria-label={`${color} ${type}`} data-anim-key={animKey} {...dragProps}>
      {GLYPHS[type]}
    </span>
  );
}
