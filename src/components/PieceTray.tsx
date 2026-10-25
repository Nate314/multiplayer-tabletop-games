// A supply of pieces shown as a hand: tap one to select it, or drag it onto the board (src/drag/useDrag.ts)
import type { ReactNode } from 'react';
import type { Drag } from '../drag/useDrag.ts';

export type TrayPiece = {
  id: string;
  label: string;      // the button's accessible name is `${label}, ${count} left`, or label alone without a count
  icon: ReactNode;
  count?: number;
  blocked?: string;   // non-empty: the piece is dimmed and disabled, and this is its title
};

type PieceTrayProps = {
  label: string;                 // the section's aria-label, e.g. 'Your walls'
  pieces: TrayPiece[];
  selected: string | null;       // shown with aria-pressed
  onTap: (id: string) => void;
  drag: Drag;                    // each piece button spreads drag.source(piece.id)
  leading?: ReactNode;           // a control shown before the pieces, such as Quoridor's Move
};

export default function PieceTray({ label, pieces, selected, onTap, drag, leading }: PieceTrayProps) {
  return (
    <section className="piece-tray" aria-label={label}>
      <div className="piece-tray-pieces">
        {leading}
        {pieces.map(piece => (
          <button
            key={piece.id}
            type="button"
            className="piece-tray-piece"
            aria-label={piece.count === undefined ? piece.label : `${piece.label}, ${piece.count} left`}
            aria-pressed={selected === piece.id}
            disabled={!!piece.blocked}
            title={piece.blocked || undefined}
            onClick={() => onTap(piece.id)}
            {...drag.source(piece.id)}
          >
            {piece.icon}
            {piece.count !== undefined && <span className="piece-tray-count">{piece.count}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
