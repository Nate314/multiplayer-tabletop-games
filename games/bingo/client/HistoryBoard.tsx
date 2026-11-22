import type { PublicGameState, Seat } from '../types.ts';

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

// The called numbers board, 1 to 75 in five rows with the called ones lit and the last call outlined.
// The table screen, spectators and the history dialog all show this instead of anyone's cards
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { called, lastMove } = gameState;
  const last = lastMove?.type === 'call' ? lastMove.number : null;
  return (
    <div className="bingo-board" role="group" aria-label="Called numbers">
      {LETTERS.map((letter, row) => (
        <div key={letter} className="bingo-board-row">
          <span className="bingo-letter">{letter}</span>
          {Array.from({ length: 15 }, (_, i) => row * 15 + i + 1).map(number => {
            const classes = ['bingo-board-number', called.includes(number) && 'bingo-board-called', number === last && 'bingo-board-last'];
            return <span key={number} className={classes.filter(Boolean).join(' ')}>{number}</span>;
          })}
        </div>
      ))}
    </div>
  );
}
