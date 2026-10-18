import { meeplesOnBoard } from '../board.ts';
import { MEEPLES_PER_PLAYER } from '../tiles.ts';
import { MeepleIcon } from './Meeple';
import type { FeatureKind, PublicGameState, Seat } from '../types.ts';

const KINDS: { kind: FeatureKind; label: string }[] = [
  { kind: 'road', label: 'Roads' },
  { kind: 'city', label: 'Cities' },
  { kind: 'monastery', label: 'Monasteries' },
  { kind: 'field', label: 'Fields' }
];

// Every player's score and meeples left, highest score first, and at the end what the final scoring added
export default function PlayerList({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, activePlayers, scores, board, currentPlayer, winners, finalScores } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a - b);

  return (
    <section className="cc-panel cc-players" aria-label="Players">
      <div className="cc-panel-title">Scores</div>
      <ol className="cc-player-list">
        {seats.map(seat => {
          const left = !activePlayers.includes(seat);
          const meeples = MEEPLES_PER_PLAYER - meeplesOnBoard(board, seat);
          const classNames = ['cc-player'];
          if (seat === currentPlayer) classNames.push('cc-player-current');
          if (left) classNames.push('cc-player-left');
          return (
            <li key={seat} className={classNames.join(' ')}>
              <MeepleIcon seat={seat} />
              <span className="cc-player-name">
                {playerNames[seat]}{seat === viewer && ' (you)'}
                {left && <span className="cc-player-status"> left</span>}
                {winners.includes(seat) && <span className="cc-player-status"> winner</span>}
              </span>
              <span className="cc-player-meeples" title={`${meeples} of ${MEEPLES_PER_PLAYER} meeples in hand`}>
                {left ? '' : `${meeples} meeple${meeples === 1 ? '' : 's'}`}
              </span>
              <span className="cc-player-score">{scores[seat] ?? 0}</span>
            </li>
          );
        })}
      </ol>
      {finalScores && (
        <table className="cc-final">
          <caption>Added at the end of the game</caption>
          <thead>
            <tr><th scope="col">Player</th>{KINDS.map(({ label }) => <th key={label} scope="col">{label}</th>)}</tr>
          </thead>
          <tbody>
            {Object.keys(finalScores).map(Number).map(seat => (
              <tr key={seat}>
                <th scope="row">{playerNames[seat]}</th>
                {KINDS.map(({ kind }) => <td key={kind}>{finalScores[seat][kind]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
