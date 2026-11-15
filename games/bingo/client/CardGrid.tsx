import { letterOf } from '../cards.ts';
import type { Card } from '../types.ts';

const HEADER = ['B', 'I', 'N', 'G', 'O'];
const FREE = 12;

type CardGridProps = {
  card: Card;
  marked: readonly number[];
  called: readonly number[];
  label: string;
  onMark?: (square: number) => void; // absent when the card cannot be marked (placed, game over)
};

// One 5 by 5 card under a B I N G O header. A called number not yet marked is softly highlighted
export default function CardGrid({ card, marked, called, label, onMark }: CardGridProps) {
  return (
    <div className="bingo-card" role="group" aria-label={label}>
      {HEADER.map(letter => <span key={letter} className="bingo-letter" aria-hidden="true">{letter}</span>)}
      {card.map((number, square) => {
        if (square === FREE) return <span key={square} className="bingo-square bingo-free bingo-marked">Free</span>;
        const isMarked = marked.includes(square);
        const classes = ['bingo-square', isMarked ? 'bingo-marked' : called.includes(number) ? 'bingo-callable' : ''];
        return (
          <button key={square} type="button" className={classes.join(' ').trim()} aria-label={`${letterOf(number)} ${number}`}
            aria-pressed={isMarked} disabled={!onMark || isMarked} onClick={() => onMark?.(square)}>
            {number}
          </button>
        );
      })}
    </div>
  );
}
