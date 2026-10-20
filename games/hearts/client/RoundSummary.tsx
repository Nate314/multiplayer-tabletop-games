import { SEATS, TARGET_SCORE } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onClose: () => void;
};

// The scoring after a hand: what each player took, what they score and the totals.
// Until the game is over, everyone connected clicks Continue to deal the next hand.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, gameStatus, scores, activePlayers, disconnected } = gameState;
  const acknowledged = summary.acknowledged.includes(playerNumber);
  const waitingFor = activePlayers
    .filter(seat => !summary.acknowledged.includes(seat) && !disconnected.includes(seat))
    .map(seat => playerNames[seat]);

  return (
    <div className="overlay summary-overlay">
      <div className="modal round-summary" role="dialog" aria-label="Hand scoring">
        <h2>{isGameOver ? 'Final scoring' : `Hand ${summary.handNumber} scoring`}</h2>
        <div className="summary-result">{gameStatus}</div>
        <ul className="summary-players">
          {SEATS.filter(seat => playerNames[seat] !== undefined).map(seat => (
            <li key={seat} className={seat === summary.moon ? 'summary-player summary-moon' : 'summary-player'}>
              <span className="summary-name">{playerNames[seat]}{seat === playerNumber && ' (you)'}</span>
              <span className="summary-reason">took {summary.taken[seat]}: +{summary.change[seat]}</span>
              <span className="summary-points">{scores[seat]} pts</span>
            </li>
          ))}
        </ul>
        <div className="summary-target">The game ends when someone reaches {TARGET_SCORE}; the lowest score wins</div>
        {isGameOver ? (
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        ) : acknowledged ? (
          <div className="summary-waiting">Waiting for {waitingFor.join(', ')}</div>
        ) : (
          <button type="button" className="primary-button" onClick={onContinue}>Continue</button>
        )}
      </div>
    </div>
  );
}
