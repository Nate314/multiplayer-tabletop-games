import Peg, { AnswerPegs } from './Peg';
import { MAX_GUESSES } from '../options.ts';
import type { Board, Color, Seat } from '../types.ts';

type GuessRowsProps = {
  board: Board;
  code: Color[] | null; // null keeps the code covered
  pegs: number;
  names?: Record<Seat, string> | null; // Together: each row names its guesser
  highlightLast?: boolean; // the history dialog marks the guess that produced the step
  label?: string;
};

// The code row on top, then the ten guess rows, oldest first, so the newest guess is the lowest filled row
export default function GuessRows({ board, code, pegs, names = null, highlightLast = false, label = 'Guesses' }: GuessRowsProps) {
  const slots = Array.from({ length: pegs }, (_, i) => i);
  return (
    <div className="cb-board" role="group" aria-label={label}>
      <div className="cb-row cb-code-row" role="group" aria-label={code ? 'Code' : 'Code, hidden'}>
        <span className="cb-row-number" aria-hidden="true" />
        <span className="cb-pegs">
          {slots.map(i => <Peg key={i} color={code?.[i] ?? null} hidden={!code} />)}
        </span>
      </div>
      <ol className="cb-rows">
        {Array.from({ length: MAX_GUESSES }, (_, row) => {
          const guess = board.guesses[row];
          const last = highlightLast && guess && row === board.guesses.length - 1;
          return (
            <li key={row} className={`cb-row${guess ? '' : ' cb-row-empty'}${last ? ' cb-row-last' : ''}`} aria-label={`Guess ${row + 1}`}>
              <span className="cb-row-number" aria-hidden="true">{row + 1}</span>
              <span className="cb-pegs">
                {slots.map(i => <Peg key={i} color={guess?.pegs[i] ?? null} />)}
              </span>
              {guess && <AnswerPegs feedback={guess.feedback} pegs={pegs} />}
              {guess && names && <span className="cb-guesser">{names[guess.by]}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
