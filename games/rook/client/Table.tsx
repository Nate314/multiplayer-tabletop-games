import Card from './Card';
import { seatKey, trickKey } from './animateMove.ts';
import { SEATS, TARGET_SCORE, nextSeat, teamNames, teamOf } from '../rules.ts';
import type { PublicGameState, Seat, Team } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog's table view
  showLastMove?: boolean; // highlights the last card played, for the history dialog
};

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// What a seat says about its bidding: its bid or that it passed, while bidding; the winning bid after
function bidNote(state: PublicGameState, seat: Seat): string | null {
  const { phase, bidding, bidder, bid } = state;
  if (phase === 'bidding') {
    if (bidding.high?.seat === seat) return `bid ${bidding.high.amount}`;
    return bidding.passed.includes(seat) ? 'passed' : null;
  }
  return seat === bidder ? `bid ${bid}` : null;
}

// The scores, the bid and trump, then the four seats around the middle: you at the bottom, your partner across,
// play running to the left. The middle holds the trick being played, or the last one taken, or the nest while bidding.
export default function Table({ gameState, viewer, showLastMove = false }: TableProps) {
  const {
    playerNames, currentPlayer, winners, handCounts, dealer, scores, tricksWon, trick, lastTrick, phase, trump, bidder, bid,
    handNumber, nestCount, lastMove
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

  return (
    <div className="table">
      <div className="scoreboard">
        {([0, 1] as Team[]).map(team => (
          <div key={team} className={`team team-${team}${winners.length > 0 && teamOf(winners[0]) === team ? ' team-winner' : ''}`}>
            <span className="team-names">{teamNames(team, playerNames)}{team === myTeam && ' (you)'}</span>
            <span className="team-score">{scores[team]}</span>
            <span className="team-tricks">{tricksWon[team]} {tricksWon[team] === 1 ? 'trick' : 'tricks'}</span>
          </div>
        ))}
      </div>
      <div className="hand-info">
        <span>Hand {handNumber}, first to {TARGET_SCORE}</span>
        {bidder !== null && <span>Bid: {playerNames[bidder]} {bid}</span>}
        <span>
          Trump: {trump ? <><span className={`swatch swatch-${trump}`} /> <span className="color-name">{trump}</span></> : 'not named yet'}
        </span>
      </div>
      {seated && (
        <div className="seats">
          {placed.map(({ position, seat }) => {
            const classes = ['seat', `seat-${position}`];
            if (seat === currentPlayer && phase !== 'handOver') classes.push('seat-current');
            if (winners.includes(seat)) classes.push('seat-winner');
            const note = bidNote(gameState, seat);
            return (
              <div key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
                <span className="seat-name">
                  {playerNames[seat]}
                  {seat === viewer && ' (you)'}
                  {viewer !== null && seat !== viewer && teamOf(seat) === teamOf(viewer) && ' (partner)'}
                </span>
                <span className="seat-count">{handCounts[seat]} cards{seat === dealer && ', dealer'}</span>
                {note && <span className="seat-bid">{note}</span>}
              </div>
            );
          })}
          <div className="trick" aria-label="The trick">
            {phase === 'bidding' || phase === 'discard' ? (
              <div className="nest">
                <Card card={null} />
                <span className="nest-label">{phase === 'bidding' ? `Nest: ${nestCount} cards` : `${playerNames[bidder ?? 1]} took the nest`}</span>
              </div>
            ) : (
              <>
                {placed.map(({ position, seat }) => {
                  const play = shown.find(p => p.seat === seat);
                  return (
                    <div key={seat} className={`trick-slot trick-${position}`}>
                      {play && (
                        <Card card={play.card} animKey={trickKey(seat)} highlighted={seat === lastPlayed || seat === takenBy} />
                      )}
                    </div>
                  );
                })}
                {takenBy !== null && <div className="trick-taken">{playerNames[takenBy]} took the trick</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
