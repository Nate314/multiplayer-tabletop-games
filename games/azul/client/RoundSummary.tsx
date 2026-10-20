import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { plural } from '../../../src/text.ts';
import Tile from './Tile';
import type { Placement, PublicGameState, RoundSummary as Summary, Seat, SeatSummary } from '../types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  seats: Seat[]; // in the order the boards are shown
  onContinue: () => void;
  onClose: () => void;
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

export default function RoundSummary({ summary, gameState, playerNumber, seats, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, activePlayers, isGameOver, winners, gameStatus } = gameState;

  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={isGameOver ? 'Final scoring' : `Round ${summary.round} scoring`}
      gameState={gameState}
      result={isGameOver ? gameStatus : null}
      acknowledged={summary.acknowledged}
      listDisconnected
      playerNumber={playerNumber}
      onContinue={onContinue}
      onClose={onClose}
    >
      <div className="summary-seats">
        {seats.filter(seat => summary.seats[seat]).map(seat => (
          <section key={seat} className={winners.includes(seat) ? 'summary-seat summary-winner' : 'summary-seat'}>
            <header>
              <span>
                {playerNames[seat]}
                {seat === playerNumber && ' (you)'}
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
    </RoundSummaryDialog>
  );
}
