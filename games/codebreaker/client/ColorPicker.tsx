import ColorSymbol from '../../../src/components/ColorSymbol';
import Peg from './Peg';
import { colorName } from './describeMove.ts';
import type { Color } from '../types.ts';

type ColorPickerProps = {
  colors: Color[];
  draft: (Color | null)[];
  onChange: (draft: (Color | null)[]) => void;
  onSubmit: (pegs: Color[]) => void;
  submitLabel: string; // 'Submit guess', or 'Set code' for the Classic maker
  title: string;
};

// The row being built, then one button per color: a color fills the first empty slot, a filled slot empties when clicked
export default function ColorPicker({ colors, draft, onChange, onSubmit, submitLabel, title }: ColorPickerProps) {
  const full = draft.every(peg => peg !== null);
  const set = (slot: number, color: Color | null) => onChange(draft.map((peg, i) => i === slot ? color : peg));
  const pick = (color: Color) => {
    const slot = draft.indexOf(null);
    if (slot >= 0) set(slot, color);
  };

  return (
    <div className="cb-picker">
      <div className="cb-picker-title">{title}</div>
      <div className="cb-pegs cb-draft" role="group" aria-label="Your row">
        {draft.map((peg, slot) => (
          <Peg key={slot} color={peg} label={`Slot ${slot + 1}: ${peg ? colorName(peg) : 'empty'}`} onClick={() => set(slot, null)} />
        ))}
      </div>
      <div className="cb-colors" role="group" aria-label="Colors">
        {colors.map(color => (
          <button key={color} type="button" className={`cb-peg cb-peg-filled cb-color-${color}`} aria-label={colorName(color)}
            disabled={full} onClick={() => pick(color)}>
            <ColorSymbol color={color} className="cb-peg-symbol" />
          </button>
        ))}
      </div>
      <div className="cb-picker-actions">
        <button type="button" className="cb-button cb-secondary" onClick={() => onChange(draft.map(() => null))} disabled={draft.every(peg => peg === null)}>
          Clear
        </button>
        <button type="button" className="cb-button" onClick={() => onSubmit(draft as Color[])} disabled={!full}>{submitLabel}</button>
      </div>
    </div>
  );
}
