import Card from './Card';
import { seatKey, trickKey } from '../../../src/animation/animKeys.ts';
import { MIN_PLAYERS, biddingSide, cardName, listOf, namesOf, sameCard, seatsInPlay, targetScore, teamOfSeat, teamsOf } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog's table view
  showLastMove?: boolean; // highlights the last card played, for the history dialog
};

// Where each seat sits, from the viewer at the bottom around to the left, by the number of seats. Four use the
// classic cross; more use a ring of the top row and the two sides
const POSITIONS: Record<number, readonly string[]> = {
  4: ['bottom', 'left', 'top', 'right'],
  5: ['bottom', 'lower-left', 'top-left', 'top-right', 'lower-right'],
  6: ['bottom', 'lower-left', 'upper-left', 'top', 'upper-right', 'lower-right'],
  7: ['bottom', 'lower-left', 'upper-left', 'top-left', 'top-right', 'upper-right', 'lower-right']
};

// What a seat says about its bidding: its bid or that it passed, while bidding; the winning bid after, and at 5 and 7
// 'partner' once a called card has shown the seat to be the bidder's partner
function bidNote(state: PublicGameState, seat: Seat): string | null {
  const { phase, bidding, bidder, bid, called } = state;
  if (phase === 'bidding') {
    if (bidding.high?.seat === seat) return `bid ${bidding.high.amount}`;
    return bidding.passed.includes(seat) ? 'passed' : null;
  }
  if (seat === bidder) return `bid ${bid}`;
  return called?.partners.includes(seat) ? 'partner' : null;
}

// The scores, the bid and trump, then the seats around the middle: you at the bottom, play running to the left (at
// four, your partner across). The middle holds the trick being played, or the last one taken, or the nest while bidding.
export default function Table({ gameState, viewer, showLastMove = false }: TableProps) {
  const {
    playerNames, currentPlayer, winners, handCounts, dealer, scores, tricksWon, trick, lastTrick, phase, trump, bidder, bid,
    handNumber, nestCount, lastMove, hand
  } = gameState;
  const called = gameState.called ?? null; // missing in older saves
  const ring = seatsInPlay(gameState);
  const seated = Object.keys(handCounts).length >= MIN_PLAYERS;
  const start = viewer !== null && ring.includes(viewer) ? ring.indexOf(viewer) : 0;
  const placed = (POSITIONS[ring.length] ?? []).map((position, turn) => ({ position, seat: ring[(start + turn) % ring.length] }));
  const teams = teamsOf(gameState);
  const teamOf = (seat: Seat) => teamOfSeat(gameState, seat);
  // With called partners the viewer's side is the bidder and the partners shown so far, plus the bidder if the viewer
  // holds a called card (only they can see that)
  const side = biddingSide(gameState);
  const holdsCalled = called !== null && called.cards.some(card => hand.some(held => sameCard(held, card)));
  const onSide = viewer !== null && (side.includes(viewer) || holdsCalled);
  const isPartner = (seat: Seat) => viewer !== null && seat !== viewer && (called
    ? onSide && side.includes(seat)
    : teamOf(seat) === teamOf(viewer));
  const shown = trick.length > 0 ? trick : lastTrick?.plays ?? [];
  const takenBy = trick.length === 0 && lastTrick ? lastTrick.winner : null;
  const lastPlayed = showLastMove && lastMove?.type === 'play' ? lastMove.playerNumber : null;
  const bidderName = bidder === null ? '' : playerNames[bidder];
  const nestLabel = phase === 'bidding' ? `Nest: ${nestCount} cards`
    : phase === 'discard' ? `${bidderName} took the nest` : `${bidderName} laid aside ${nestCount} cards`;

  return (
    <div className="table">
      <div className="scoreboard">
        {teams.map((team, index) => (
          <div key={index} className={`team team-${index}${team.some(seat => winners.includes(seat)) ? ' team-winner' : ''}`}>
            <span className="team-names">{namesOf(team.filter(seat => playerNames[seat] !== undefined), playerNames) || 'Open seats'}{viewer !== null && team.includes(viewer) && ' (you)'}</span>
            <span className="team-score">{scores[index]}</span>
            <span className="team-tricks">{tricksWon[index]} {tricksWon[index] === 1 ? 'trick' : 'tricks'}</span>
          </div>
        ))}
      </div>
      <div className="hand-info">
        <span>Hand {handNumber}, first to {targetScore(gameState).toLocaleString('en-US')}</span>
        {bidder !== null && <span>Bid: {playerNames[bidder]} {bid}</span>}
        <span>
          Trump: {trump ? <><span className={`swatch swatch-${trump}`} /> <span className="color-name">{trump}</span></> : 'not named yet'}
        </span>
        {called && <span className="called-cards">Called: {listOf(called.cards.map(cardName))}</span>}
        {holdsCalled && bidder !== null && viewer !== bidder && (
          <span className="called-mine">You hold a called card: you are {playerNames[bidder]}'s partner</span>
        )}
      </div>
      {seated && (
        <div className={ring.length > 4 ? 'seats seats-ring' : 'seats'}>
          {placed.map(({ position, seat }) => {
            const classes = ['seat', `seat-${position}`];
            if (seat === currentPlayer && phase !== 'handOver') classes.push('seat-current');
            if (winners.includes(seat)) classes.push('seat-winner');
            const note = bidNote(gameState, seat);
            return (
              <div key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
                <span className="seat-name">
                  {playerNames[seat]}
                  {seat === viewer && <> <span className="seat-tag">(you)</span></>}
                  {isPartner(seat) && <> <span className="seat-tag">(partner)</span></>}
                </span>
                <span className="seat-count">{handCounts[seat]} cards{seat === dealer && ', dealer'}</span>
                {note && <span className="seat-bid">{note}</span>}
              </div>
            );
          })}
          <div className="trick" aria-label="The trick">
            {phase === 'bidding' || phase === 'discard' || phase === 'trump' || phase === 'callPartner' ? (
              <div className="nest">
                <Card card={null} />
                <span className="nest-label">{nestLabel}</span>
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
