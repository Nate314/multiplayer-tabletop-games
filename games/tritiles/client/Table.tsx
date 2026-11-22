import YouTag from '../../../src/components/YouTag.tsx';
import { houseRule } from '../../../shared/houseRules.ts';
import { TARGET_RULE } from '../options.ts';
import type { PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog's table only view
  showLastMove?: boolean; // outlines who made the last move, for the history dialog
};

// The round and target, every player's tile count and score in seat order, and the pool
export default function Table({ gameState, viewer, showLastMove = false }: TableProps) {
  const { handCounts, playerNames, currentPlayer, winners, lastMove, scores, roundNumber, poolCount } = gameState;
  const seats = Object.keys(handCounts).map(Number).sort((a, b) => a - b);
  const lastMover = showLastMove ? lastMove?.playerNumber : undefined;

  return (
    <div className="table">
      <div className="round">Round {roundNumber}: first to {houseRule(gameState, TARGET_RULE)} points wins</div>
      <ol className="players">
        {seats.map(seat => {
          const count = handCounts[seat];
          const classes = ['player'];
          if (seat !== viewer) classes.push('hand-only-hide');
          if (seat === currentPlayer) classes.push('player-current');
          if (winners.includes(seat)) classes.push('player-winner');
          if (seat === lastMover) classes.push('player-last');
          return (
            <li key={seat} className={classes.join(' ')}>
              <span className="player-name">
                {playerNames[seat]}
                <YouTag when={seat === viewer} />
                {winners.includes(seat) && ' ★'}
              </span>
              <span className="player-count">{count} {count === 1 ? 'tile' : 'tiles'}</span>
              <span className="player-score">{scores[seat] ?? 0} pts</span>
            </li>
          );
        })}
      </ol>
      <div className="pool hand-only-hide">Pool: {poolCount}</div>
    </div>
  );
}
