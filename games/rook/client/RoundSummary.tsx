import { TARGET_SCORE, teamNames, teamOf } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat, Team } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onClose: () => void;
};

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));

// The scoring after a hand: the bid, what each team took and the totals.
// Until the game is over, everyone connected clicks Continue to deal the next hand.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, gameStatus, scores, activePlayers, disconnected } = gameState;
  const acknowledged = summary.acknowledged.includes(playerNumber);
  const waitingFor = activePlayers
    .filter(seat => !summary.acknowledged.includes(seat) && !disconnected.includes(seat))
    .map(seat => playerNames[seat]);
  const bidTeam = teamOf(summary.bidder);

  return (
    <div className="overlay summary-overlay">
      <div className="modal round-summary" role="dialog" aria-label="Hand scoring">
        <h2>{isGameOver ? 'Final scoring' : `Hand ${summary.handNumber} scoring`}</h2>
        <div className="summary-result">{gameStatus}</div>
        <div className="summary-detail">
          {playerNames[summary.bidder]} bid {summary.bid} and {summary.made ? 'made it' : 'went set'}.
          {' '}{playerNames[summary.lastTrick]} took the last trick and the nest ({summary.nestPoints} points).
        </div>
        <ul className="summary-teams">
          {([0, 1] as Team[]).map(team => (
            <li key={team} className={team === bidTeam ? 'summary-team summary-bidders' : 'summary-team'}>
              <span className="summary-name">
                {teamNames(team, playerNames)}
                {teamOf(playerNumber) === team && ' (you)'}
              </span>
              <span className="summary-reason">took {summary.points[team]}: {signed(summary.change[team])}</span>
              <span className="summary-points">{scores[team]} pts</span>
            </li>
          ))}
        </ul>
        <div className="summary-target">First to {TARGET_SCORE} points wins</div>
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
