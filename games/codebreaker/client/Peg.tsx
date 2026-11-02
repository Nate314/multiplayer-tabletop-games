import ColorSymbol from '../../../src/components/ColorSymbol';
import { colorName, feedbackText } from './describeMove.ts';
import type { Color, Feedback } from '../types.ts';

type PegProps = {
  color: Color | null; // null: an empty hole
  hidden?: boolean; // a covered code peg, shown as ?
  label?: string; // overrides the color name, e.g. for a draft slot
  onClick?: () => void;
};

// One round peg in its color with its color-blind symbol, an empty hole, or a covered code peg
export default function Peg({ color, hidden = false, label, onClick }: PegProps) {
  const name = hidden ? 'Hidden' : color ? colorName(color) : 'Empty';
  const className = `cb-peg ${hidden ? 'cb-peg-hidden' : color ? `cb-peg-filled cb-color-${color}` : 'cb-peg-empty'}`;
  const inside = hidden ? <span aria-hidden="true">?</span> : <ColorSymbol color={color} className="cb-peg-symbol" />;
  if (onClick) {
    return <button type="button" className={className} aria-label={label ?? name} onClick={onClick}>{inside}</button>;
  }
  return <span className={className} role="img" aria-label={label ?? name}>{inside}</span>;
}

// The clue for one guess: a dark peg per right place, a light ringed peg per right color, the rest empty
export function AnswerPegs({ feedback, pegs }: { feedback: Feedback; pegs: number }) {
  const text = feedbackText(feedback);
  const kinds = Array.from({ length: pegs }, (_, i) => i < feedback.exact ? 'exact' : i < feedback.exact + feedback.colorOnly ? 'color' : 'none');
  return (
    <span className="cb-answer" title={text}>
      <span className={`cb-answer-grid cb-answer-${pegs}`} aria-hidden="true">
        {kinds.map((kind, i) => <span key={i} className={`cb-key cb-key-${kind}`} />)}
      </span>
      <span className="cb-visually-hidden">{text}</span>
    </span>
  );
}
