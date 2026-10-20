import type { MissionSummary as Summary, PublicGameState, Seat } from '../types.ts';

type MissionSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onVote: (yes: boolean) => void;
  onClose: () => void;
};

// The end of an attempt: success or why it failed, and the attempts for the logbook. Until the game is over, everyone
// connected clicks Continue for the next mission or the retry, or votes to end the game here.
export default function MissionSummary({ summary, gameState, playerNumber, onContinue, onVote, onClose }: MissionSummaryProps) {
  const { playerNames, isGameOver, gameStatus, activePlayers, disconnected, endVotes } = gameState;
  const acknowledged = summary.acknowledged.includes(playerNumber);
  const connected = activePlayers.filter(seat => !disconnected.includes(seat));
  const waitingFor = connected.filter(seat => !summary.acknowledged.includes(seat)).map(seat => playerNames[seat]);
  const attempts = summary.attempt + (summary.distress ? 1 : 0);
  const title = `Mission ${summary.mission} ${summary.success ? 'complete' : 'failed'}`;

  return (
    <div className="overlay summary-overlay">
      <div className="modal round-summary" role="dialog" aria-label="Mission result">
        <h2>{title}</h2>
        <div className="summary-result">{gameStatus}</div>
        {summary.success && (
          <div className="summary-detail">
            Attempts for the logbook: {attempts}{summary.distress && ' (the distress signal adds one)'}
          </div>
        )}
        {!summary.success && <div className="summary-detail">Attempt {summary.attempt} failed; the crew tries this mission again.</div>}
        {isGameOver ? (
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        ) : (
          <>
            {acknowledged
              ? <div className="summary-waiting">Waiting for {waitingFor.join(', ')}</div>
              : <button type="button" className="primary-button" onClick={onContinue}>Continue</button>}
            <div className="end-vote" role="group" aria-label="Vote to end the game">
              <div className="end-vote-title">End the game here? It ends when everyone votes yes.</div>
              <ul className="end-vote-list">
                {connected.map(seat => (
                  <li key={seat}>
                    {playerNames[seat]}: {endVotes[seat] === undefined ? 'not voted' : endVotes[seat] ? 'yes' : 'no'}
                  </li>
                ))}
              </ul>
              <div className="end-vote-actions">
                <button type="button" onClick={() => onVote(true)} disabled={endVotes[playerNumber] === true}>Vote to end</button>
                <button type="button" onClick={() => onVote(false)} disabled={endVotes[playerNumber] === false}>Vote to play on</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
