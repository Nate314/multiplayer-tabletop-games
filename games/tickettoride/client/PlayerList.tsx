import YouTag from '../../../src/components/YouTag.tsx';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { TicketFace } from './pieces';
import { LONGEST_PATH_BONUS, routePoints } from '../scoring.ts';
import type { PublicGameState, Seat } from '../types.ts';

type PlayerListProps = {
  gameState: Pick<PublicGameState, 'players' | 'playerNames' | 'activePlayers' | 'claimed' | 'currentPlayer' | 'final' | 'lastTurns'>;
  viewer: Seat | null;
};

function count(value: number, word: string): string {
  return `${value} ${word}${value === 1 ? '' : 's'}`;
}

// Everyone's score track, trains left and card and ticket counts, in seat order
export default function PlayerList({ gameState, viewer }: PlayerListProps) {
  const { players, playerNames, activePlayers, claimed, currentPlayer, final, lastTurns } = gameState;
  return (
    <section className="player-list" aria-label="Players">
      {Object.keys(players).map(Number).map(seat => {
        const player = players[seat];
        const out = !activePlayers.includes(seat);
        const classes = ['player-row', `seat${seat}`, seat === currentPlayer ? 'current' : '', out ? 'out' : '', seat === viewer ? '' : 'hand-only-hide'].filter(Boolean).join(' ');
        return (
          <div key={seat} className={classes}>
            <span className="player-swatch" aria-hidden="true"><ColorSymbol color={SEAT_SYMBOLS[seat]} className="swatch-symbol" /></span>
            <span className="player-name">
              {playerNames[seat]}<YouTag when={seat === viewer} />{out ? ' (left)' : ''}
              {lastTurns?.includes(seat) && <span className="last-turn"> last turn to come</span>}
            </span>
            <span className="player-stats">
              <span title="Points">{final?.[seat]?.total ?? routePoints(claimed, seat)} pts</span>
              <span title="Trains left">{count(player.trains, 'train')}</span>
              <span title="Train cards">{count(player.cardCount, 'card')}</span>
              <span title="Destination tickets">{count(player.ticketCount + player.offeredCount, 'ticket')}</span>
            </span>
          </div>
        );
      })}
    </section>
  );
}

// The final tally, once the game is over: routes, every ticket made or missed, and the longest path
export function FinalScores({ gameState }: { gameState: Pick<PublicGameState, 'final' | 'playerNames' | 'winners'> }) {
  const { final, playerNames, winners } = gameState;
  if (!final) return null;
  const seats = Object.keys(final).map(Number).sort((a, b) => final[b].total - final[a].total);
  return (
    <section className="final-scores" aria-label="Final scores">
      <h2>Final scores</h2>
      <table>
        <thead>
          <tr><th>Player</th><th>Routes</th><th>Tickets</th><th>Longest path</th><th>Total</th></tr>
        </thead>
        <tbody>
          {seats.map(seat => {
            const score = final[seat];
            return (
              <tr key={seat} className={winners.includes(seat) ? 'winner' : undefined}>
                <td>{playerNames[seat]}</td>
                <td>{score.routes}</td>
                <td>{score.ticketPoints > 0 ? `+${score.ticketPoints}` : score.ticketPoints}</td>
                <td>{score.longestPath}{score.longestBonus ? ` (+${LONGEST_PATH_BONUS})` : ''}</td>
                <td><strong>{score.total}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {seats.map(seat => (
        <div key={seat} className="final-tickets">
          <h3>{playerNames[seat]}</h3>
          <ul className="tickets">
            {final[seat].tickets.map(({ ticket, completed }) => (
              <li key={ticket} className={completed ? undefined : 'missed'}>
                <TicketFace ticket={ticket} done={completed} missed={!completed} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
