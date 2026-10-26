// One box per letter of the word, a gap between its words and a visible hyphen; the letters once the word is known.
// Each word wraps as a whole, so a long phrase breaks at its spaces
export default function Blanks({ mask, word }: { mask: string; word: string | null }) {
  if (!mask) return null;
  const shown = word ?? mask;
  const letters = mask.split('').filter(c => c === '_').length;
  return (
    <div className="pictionary-blanks" role="img" aria-label={word ? `Word: ${word}` : `Word: ${letters} letters`}>
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
