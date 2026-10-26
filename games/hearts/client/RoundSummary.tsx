import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { SEATS, targetScore } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

// The scoring after a hand: what each player took, what they score and the totals.
export function RoundRows({ summary, gameState, viewer }: { summary: HandSummary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores } = gameState;
  return (
    <>
      <ul className="summary-players">
        {SEATS.filter(seat => playerNames[seat] !== undefined).map(seat => (
          <li key={seat} className={seat === summary.moon ? 'summary-player summary-moon' : 'summary-player'}>
            <span className="summary-name">{playerNames[seat]}{seat === viewer && ' (you)'}</span>
            <span className="summary-reason">took {summary.taken[seat]}{seat === summary.jack && ' and the Jack of Diamonds'}: {summary.change[seat] < 0 ? '' : '+'}{summary.change[seat]}</span>
            <span className="summary-points">{scores[seat]} pts</span>
          </li>
        ))}
      </ul>
      <div className="summary-target">The game ends when someone reaches {targetScore(gameState).toLocaleString('en-US')}; the lowest score wins</div>
    </>
  );
}

// Between rounds; the last round's rows are on the game-over screen
export default function RoundSummary({ summary, gameState, playerNumber, onContinue }: RoundSummaryProps) {
  return (
    <RoundSummaryDialog
      label="Hand scoring"
      title={`Hand ${summary.handNumber} scoring`}
      gameState={gameState}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={onContinue}
    >
      <RoundRows summary={summary} gameState={gameState} viewer={playerNumber} />
    </RoundSummaryDialog>
  );
}

export function FinalRound({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { roundSummary } = gameState;
  return roundSummary ? (
    <section className="game-over-round">
      <h3>Hand {roundSummary.handNumber} scoring</h3>
      <RoundRows summary={roundSummary} gameState={gameState} viewer={viewer} />
    </section>
  ) : null;
}
