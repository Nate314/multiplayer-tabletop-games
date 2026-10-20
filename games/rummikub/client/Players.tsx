import { POOL_KEY } from './animateMove.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import type { PublicGameState, Seat } from '../types.ts';

type PlayersProps = {
  gameState: PublicGameState;
  playerNumber: Seat; // 0 for the table view, which has no "you"
};

function signed(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

// Every player's tile count and first meld, the round's points once it is over, and the pool
export default function Players({ gameState, playerNumber }: PlayersProps) {
  const { playerNames, rackCounts, activePlayers, currentPlayer, winners, melded, result, poolCount } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <div className="rk-players">
      <ul className="rk-player-list">
        {seats.map(seat => {
          const hasLeft = !activePlayers.includes(seat);
          const classes = [
            'rk-player',
            currentPlayer === seat ? 'rk-player-current' : '',
            winners.includes(seat) ? 'rk-player-winner' : '',
            hasLeft ? 'rk-player-left' : ''
          ];
          const points = result?.points[seat];
          return (
            <li key={seat} className={classes.filter(Boolean).join(' ')} data-anim-key={seatKey(seat)}>
              <span className="rk-player-name">
                {playerNames[seat]}{seat === playerNumber && ' (you)'}{hasLeft && ' (left)'}
              </span>
              <span className="rk-player-tiles">
                {hasLeft ? '' : `${rackCounts[seat] ?? 0} tiles`}
                {melded.includes(seat) && <span className="rk-melded" title="Has made their first meld"> ✓ melded</span>}
              </span>
              {points !== undefined && (
                <span className="rk-player-points" title={`Rack total ${result?.rackTotals[seat] ?? 0}`}>{signed(points)}</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="rk-pool" data-anim-key={POOL_KEY}>Tiles in the pool: {poolCount}</div>
    </div>
  );
}
