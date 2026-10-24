import PlayingCard from '../../../src/components/PlayingCard';
import { seatKey, trickKey } from '../../../src/animation/animKeys.ts';
import { SEATS, targetScore, bidName, nextSeat, teamNames, teamOf, teamSeats } from '../rules.ts';
import type { PublicGameState, Seat, Team } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog's table view
  showLastMove?: boolean; // highlights the last card played, for the history dialog
};

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// The scores and bags, then the four seats around the middle: you at the bottom, your partner across, play running
// to the left. Each seat shows its bid and tricks taken. The middle holds the trick being played, or the last one taken.
export default function Table({ gameState, viewer, showLastMove = false }: TableProps) {
  const {
    playerNames, currentPlayer, winners, handCounts, dealer, scores, bags, bids, tricksTaken, trick, lastTrick, phase,
    handNumber, spadesBroken, lastMove
  } = gameState;
  const bottom = viewer ?? 1;
  const seated = Object.keys(handCounts).length === SEATS.length;
  const placed = POSITIONS.map((position, turn) => {
    let seat = bottom;
    for (let i = 0; i < turn; i++) seat = nextSeat(seat);
    return { position, seat };
  });
  const shown = trick.length > 0 ? trick : lastTrick?.plays ?? [];
  const takenBy = trick.length === 0 && lastTrick ? lastTrick.winner : null;
  const lastPlayed = showLastMove && lastMove?.type === 'play' ? lastMove.playerNumber : null;
  const myTeam: Team | null = viewer === null ? null : teamOf(viewer);
  const biddingDone = Object.keys(bids).length === SEATS.length;

  return (
    <div className="table">
      <div className="scoreboard">
        {([0, 1] as Team[]).map(team => {
          const seats = teamSeats(team);
          const contract = seats.reduce((sum, seat) => sum + (bids[seat] ?? 0), 0);
          const tricks = seats.reduce((sum, seat) => sum + (tricksTaken[seat] ?? 0), 0);
          return (
            <div key={team} className={`team team-${team}${winners.length > 0 && teamOf(winners[0]) === team ? ' team-winner' : ''}`}>
              <span className="team-names">{teamNames(team, playerNames)}{team === myTeam && ' (you)'}</span>
              <span className="team-score">{scores[team]}</span>
              <span className="team-bags">{bags[team]} {bags[team] === 1 ? 'bag' : 'bags'}</span>
              {biddingDone && phase === 'play' && <span className="team-contract">bid {contract}, took {tricks}</span>}
            </div>
          );
        })}
      </div>
      <div className="hand-info">
        <span>Hand {handNumber}, first to {targetScore(gameState)}</span>
        <span className="spades-broken">{spadesBroken ? 'Spades are broken' : 'Spades not broken yet'}</span>
      </div>
      {seated && (
        <div className="seats">
          {placed.map(({ position, seat }) => {
            const classes = ['seat', `seat-${position}`];
            if (seat === currentPlayer && phase !== 'handOver') classes.push('seat-current');
            if (winners.includes(seat)) classes.push('seat-winner');
            const bid = bids[seat];
            return (
              <div key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
                <span className="seat-name">
                  {playerNames[seat]}
                  {seat === viewer && ' (you)'}
                  {viewer !== null && seat !== viewer && teamOf(seat) === teamOf(viewer) && ' (partner)'}
                </span>
                <span className="seat-count">{handCounts[seat]} cards{seat === dealer && ', dealer'}</span>
                {bid !== undefined && <span className="seat-bid">bid {bidName(bid)}</span>}
                {biddingDone && <span className="seat-tricks">took {tricksTaken[seat]}</span>}
              </div>
            );
          })}
          <div className="trick" aria-label="The trick">
            {placed.map(({ position, seat }) => {
              const play = shown.find(p => p.seat === seat);
              return (
                <div key={seat} className={`trick-slot trick-${position}`}>
                  {play && <PlayingCard card={play.card} animKey={trickKey(seat)} highlighted={seat === lastPlayed || seat === takenBy} />}
                </div>
              );
            })}
            {takenBy !== null && <div className="trick-taken">{playerNames[takenBy]} took the trick</div>}
            {phase === 'bidding' && <div className="trick-taken">Bidding</div>}
          </div>
        </div>
      )}
    </div>
  );
}
