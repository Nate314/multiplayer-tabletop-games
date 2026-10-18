import PieceGlyph from './PieceGlyph';
import { PROMOTION_TYPES } from '../rules.ts';
import type { Color, PromotionType } from '../types.ts';

type PromotionPickerProps = {
  color: Color;
  onPick: (promotion: PromotionType) => void;
  onCancel: () => void;
};

// Shown over the board when a pawn reaches the last rank
export default function PromotionPicker({ color, onPick, onCancel }: PromotionPickerProps) {
  return (
    <div className="promotion">
      <div className="promotion-panel">
        <div className="panel-title">Promote to</div>
        <div className="promotion-choices">
          {PROMOTION_TYPES.map(type => (
            <button key={type} type="button" title={type} onClick={() => onPick(type)}>
              <PieceGlyph color={color} type={type} />
            </button>
          ))}
        </div>
        <button type="button" className="promotion-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
