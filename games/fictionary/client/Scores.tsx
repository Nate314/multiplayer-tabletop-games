import YouTag from '../../../src/components/YouTag.tsx';
import type { PublicGameState, Seat } from '../types.ts';

// Every player's total; the history passes no viewer, so nobody is "you"
export default function Scores({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores, activePlayers, winners } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);
  return (
    <ul className="score-list" aria-label="Scores">
      {seats.map(seat => (
        <li key={seat} className={winners.includes(seat) ? 'score-row score-winner' : 'score-row'}>
          <span>{playerNames[seat]}<YouTag when={seat === viewer} />{!activePlayers.includes(seat) && ' (left)'}</span>
          <span className="score-points">{scores[seat] ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}
