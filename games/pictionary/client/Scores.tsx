import YouTag from '../../../src/components/YouTag.tsx';
import type { PublicGameState, Seat } from '../types.ts';

type ScoresProps = {
  gameState: PublicGameState;
  playerNumber: Seat; // 0 for the history, which has no "you"
};

// Every player's score, who is drawing and who has guessed this word
export default function Scores({ gameState, playerNumber }: ScoresProps) {
  const { playerNames, scores, activePlayers, drawer, guessed, winners, phase, isGameOver } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);
  const turnOn = !isGameOver && phase !== 'choosing';

  return (
    <ul className="score-list" aria-label="Scores">
      {seats.map(seat => {
        const hasLeft = !activePlayers.includes(seat);
        const classes = [
          'score-row',
          drawer === seat && !isGameOver ? 'score-current' : '',
          turnOn && guessed.includes(seat) ? 'score-guessed' : '',
          winners.includes(seat) ? 'score-winner' : '',
          hasLeft ? 'score-left' : '',
          seat !== playerNumber ? 'hand-only-hide' : ''
        ];
        const note = drawer === seat && !isGameOver ? 'drawing' : turnOn && guessed.includes(seat) ? 'guessed' : '';
        return (
          <li key={seat} className={classes.filter(Boolean).join(' ')}>
            <span className="score-name">
              {playerNames[seat]}<YouTag when={seat === playerNumber} />{hasLeft && ' (left)'}
            </span>
            <span className="score-note">{note}</span>
            <span className="score-points">{scores[seat] ?? 0}</span>
          </li>
        );
      })}
    </ul>
  );
}
