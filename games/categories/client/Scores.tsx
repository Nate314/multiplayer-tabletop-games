import YouTag from '../../../src/components/YouTag.tsx';
import type { PublicGameState, Seat } from '../types.ts';

type ScoresProps = {
  gameState: PublicGameState;
  playerNumber: Seat; // 0 for the history, which has no "you"
};

// Every player's total, and who is done answering
export default function Scores({ gameState, playerNumber }: ScoresProps) {
  const { playerNames, scores, activePlayers, done, winners, phase } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <ul className="score-list" aria-label="Scores">
      {seats.map(seat => {
        const hasLeft = !activePlayers.includes(seat);
        const classes = ['score-row', winners.includes(seat) ? 'score-winner' : '', hasLeft ? 'score-left' : ''];
        return (
          <li key={seat} className={classes.filter(Boolean).join(' ')}>
            <span className="score-name">
              {playerNames[seat]}<YouTag when={seat === playerNumber} />{hasLeft && ' (left)'}
            </span>
            <span className="score-note">{phase === 'answering' && done.includes(seat) ? 'done' : ''}</span>
            <span className="score-points">{scores[seat] ?? 0}</span>
          </li>
        );
      })}
    </ul>
  );
}
