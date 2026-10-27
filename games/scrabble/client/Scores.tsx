import YouTag from '../../../src/components/YouTag.tsx';
import { BAG_KEY } from './animateMove.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import type { PublicGameState, Seat } from '../types.ts';

type ScoresProps = {
  gameState: PublicGameState;
  playerNumber: Seat; // 0 for the history, which has no "you"
};

function signed(points: number): string {
  return points >= 0 ? `+${points}` : `${points}`;
}

// Every player's score and tile count, and what is left in the bag
export default function Scores({ gameState, playerNumber }: ScoresProps) {
  const { playerNames, scores, rackCounts, activePlayers, currentPlayer, winners, endAdjustments, bagCount } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <div className="scores">
      <ul className="score-list">
        {seats.map(seat => {
          const hasLeft = !activePlayers.includes(seat);
          const classes = [
            'score-row',
            currentPlayer === seat ? 'score-current' : '',
            winners.includes(seat) ? 'score-winner' : '',
            hasLeft ? 'score-left' : '',
            seat !== playerNumber ? 'hand-only-hide' : ''
          ];
          const adjustment = endAdjustments?.[seat];
          return (
            <li key={seat} className={classes.filter(Boolean).join(' ')} data-anim-key={seatKey(seat)}>
              <span className="score-name">
                {playerNames[seat]}<YouTag when={seat === playerNumber} />{hasLeft && ' (left)'}
              </span>
              <span className="score-tiles">{hasLeft ? '' : `${rackCounts[seat] ?? 0} tiles`}</span>
              <span className="score-points">
                {scores[seat] ?? 0}
                {adjustment !== undefined && <span className="score-adjustment"> ({signed(adjustment)})</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="bag-count hand-only-hide" data-anim-key={BAG_KEY}>Tiles in the bag: {bagCount}</div>
    </div>
  );
}
