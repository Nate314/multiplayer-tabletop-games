import ReviewTable from './ReviewTable';
import Scores from './Scores';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The round at one step, read only: the letter and list, then the review table (answering holds only the viewer's own answers)
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { letter, round, list, phase, answers } = gameState;
  const mine = viewer === null ? undefined : answers[viewer];
  return (
    <div className="history-layout">
      {letter && <div className="turn-message">Round {round}, letter <span className="categories-letter small" aria-label={`Letter ${letter}`}>{letter}</span></div>}
      {phase === 'review'
        ? <ReviewTable gameState={gameState} viewer={0} />
        : mine && (
          <ul className="review-list" aria-label="Your answers">
            {list.map((category, i) => <li key={category} className="review-row"><h3 className="review-category">{category}</h3><span className="review-answer">{mine[i]}</span></li>)}
          </ul>
        )}
      <Scores gameState={gameState} playerNumber={viewer ?? 0} />
    </div>
  );
}
