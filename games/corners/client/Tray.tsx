import { plural } from '../../../shared/text.ts';
import { PIECES, orientations, type BoardKind } from '../geometry.ts';
import PieceShape from './PieceShape.tsx';
import type { Draft } from './placeInput.ts';

type TrayProps = {
  kind: BoardKind;
  color: number;
  pieces: number[]; // the unplayed piece ids of the color to place
  draft: Draft | null;
  onPick: (piece: number) => void;
  onTurn: (by: 1 | -1) => void;
  onFlip: () => void;
  onPlace: () => void;
};

// The color's unplayed pieces, the chosen one in its current orientation, and the buttons that turn, flip and place it
export default function Tray({ kind, color, pieces, draft, onPick, onTurn, onFlip, onPlace }: TrayProps) {
  const unit = kind === 'squares' ? 'square' : 'triangle';
  return (
    <section className="corners-tray" aria-label="Your pieces">
      <div className="corners-tray-pieces">
        {pieces.map(piece => {
          const shape = PIECES[kind][piece];
          const chosen = draft?.piece === piece;
          return (
            <button
              key={piece}
              type="button"
              className="corners-tray-piece"
              aria-label={`Piece of ${plural(shape.length, unit)} (${piece})`}
              aria-pressed={chosen}
              onClick={() => onPick(piece)}
            >
              <PieceShape kind={kind} shape={chosen ? orientations(kind, shape)[draft.orientation] : shape} color={color} />
            </button>
          );
        })}
      </div>
      <div className="corners-tray-buttons">
        <button type="button" onClick={() => onTurn(-1)} disabled={!draft} title="Q">Turn left</button>
        <button type="button" onClick={() => onTurn(1)} disabled={!draft} title="E">Turn right</button>
        <button type="button" onClick={onFlip} disabled={!draft} title="F">Flip</button>
        <button type="button" onClick={onPlace} disabled={!draft?.spot}>Place</button>
      </div>
    </section>
  );
}
