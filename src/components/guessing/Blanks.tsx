// One box per letter of the word, a gap between its words and a visible hyphen; the letters once the word is known.
// Each word wraps as a whole, so a long phrase breaks at its spaces. `label` names the noun for screen readers, as in "Word: 8 letters"
export default function Blanks({ mask, word, label, className }: { mask: string; word: string | null; label: string; className: string }) {
  if (!mask) return null;
  const shown = word ?? mask;
  const letters = mask.split('').filter(c => c === '_').length;
  return (
    <div className={className} role="img" aria-label={word ? `${label}: ${word}` : `${label}: ${letters} letters`}>
      {shown.split(' ').map((part, w) => (
        <span key={w} className="blank-word">
          {part.split('').map((c, i) => c === '-'
            ? <span key={i} className="blank-hyphen">-</span>
            : <span key={i} className="blank-letter">{c === '_' ? '' : c}</span>)}
        </span>
      ))}
    </div>
  );
}
