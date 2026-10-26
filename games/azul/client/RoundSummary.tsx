import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { plural } from '../../../shared/text.ts';
import Tile from './Tile';
import { azulInfo } from '../info.ts';
import type { Placement, PublicGameState, RoundSummary as Summary, Seat, SeatSummary } from '../types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

function reason({ rowRun, colRun }: Placement): string {
  const runs: string[] = [];
  if (rowRun > 1) runs.push(`row of ${rowRun}`);
  if (colRun > 1) runs.push(`column of ${colRun}`);
  return runs.length > 0 ? runs.join(' + ') : 'no neighbors';
}

function SeatLines({ seat }: { seat: SeatSummary }) {
  const { placements, floor, floorPenalty, bonus, scoreBefore } = seat;
  const earned = placements.reduce((sum, placement) => sum + placement.points, 0);
  const hitZero = scoreBefore + earned - floorPenalty < 0;

  return (
    <ul className="summary-lines">
      {placements.map(placement => (
        <li key={placement.row}>
          <Tile kind={placement.color} />
          <span>Row {placement.row + 1}</span>
          <span className="summary-reason">{reason(placement)}</span>
          <span className="summary-points">+{placement.points}</span>
        </li>
      ))}
      {placements.length === 0 && (
        <li>
          <span className="summary-reason">No pattern line was full</span>
          <span className="summary-points">+0</span>
        </li>
      )}
      {floor.length > 0 && (
        <li>
          <span className="summary-floor">
            {floor.map((item, index) => <Tile key={index} kind={item} />)}
          </span>
          <span className="summary-reason">
            floor line{hitZero && ' (a score cannot drop below 0)'}
          </span>
          <span className="summary-points">-{floorPenalty}</span>
        </li>
      )}
      {bonus && bonus.rows > 0 && (
        <li>
          <span>{plural(bonus.rows, 'complete row')}</span>
          <span className="summary-points">+{bonus.rows * 2}</span>
        </li>
      )}
      {bonus && bonus.columns > 0 && (
        <li>
          <span>{plural(bonus.columns, 'complete column')}</span>
          <span className="summary-points">+{bonus.columns * 7}</span>
        </li>
      )}
      {bonus && bonus.colors > 0 && (
        <li>
          <span>{plural(bonus.colors, 'complete color')}</span>
          <span className="summary-points">+{bonus.colors * 10}</span>
        </li>
      )}
    </ul>
  );
}

export function RoundRows({ summary, gameState, viewer }: { summary: Summary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, activePlayers, winners } = gameState;
  // Turn order starting with the viewer, as the boards are shown
  const stepsAfterViewer = (seat: Seat) => (seat - (viewer ?? 0) + azulInfo.maxPlayers) % azulInfo.maxPlayers;
  const seats = Object.keys(summary.seats).map(Number).sort((a, b) => stepsAfterViewer(a) - stepsAfterViewer(b));

  return (
    <div className="summary-seats">
      {seats.map(seat => (
        <section key={seat} className={winners.includes(seat) ? 'summary-seat summary-winner' : 'summary-seat'}>
          <header>
            <span>
              {playerNames[seat]}
              <YouTag when={seat === viewer} />
              {!activePlayers.includes(seat) && ' (left)'}
            </span>
            <span>
              {summary.seats[seat].scoreBefore} → <strong>{summary.seats[seat].scoreAfter} pts</strong>
            </span>
          </header>
          <SeatLines seat={summary.seats[seat]} />
        </section>
      ))}
    </div>
  );
}

// Between rounds; the last round's rows are on the game-over screen
export default function RoundSummary({ summary, gameState, playerNumber, onContinue }: RoundSummaryProps) {
  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={`Round ${summary.round} scoring`}
      gameState={gameState}
      result={null}
      acknowledged={summary.acknowledged}
      listDisconnected
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
      <h3>Round {roundSummary.round} scoring</h3>
      <RoundRows summary={roundSummary} gameState={gameState} viewer={viewer} />
    </section>
  ) : null;
}
