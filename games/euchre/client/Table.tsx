import PlayingCard from '../../../src/components/PlayingCard';
import { seatKey, trickKey } from './animateMove.ts';
import { SEATS, SUIT_SYMBOLS, TARGET_SCORE, cardName, nextSeat, sittingOut, teamNames, teamOf } from '../rules.ts';
import type { PublicGameState, Seat, Team } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog's table view
  showLastMove?: boolean; // highlights the last card played, for the history dialog
};

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// What a seat says about making trump: that it passed this round, or that it made trump or sits out
function seatNote(state: PublicGameState, seat: Seat): string | null {
  const { phase, passed, maker, alone } = state;
  if (seat === maker) return alone ? 'maker, alone' : 'maker';
  if (seat === sittingOut(state)) return 'sits out';
  return (phase === 'order' || phase === 'name') && passed.includes(seat) ? 'passed' : null;
}

// What the middle says while trump is being made
function kittyLabel(state: PublicGameState): string {
  const { phase, upcard, trump, dealer, playerNames } = state;
  const card = upcard ? cardName(upcard) : '';
  if (phase === 'order') return 'Turned up';
  if (phase === 'name') return `The ${card} was turned down`;
  if (trump === upcard?.suit && dealer !== null && sittingOut(state) !== dealer) {
    return phase === 'discard' ? `${playerNames[dealer]} picked up the ${card}` : `${playerNames[dealer]} picks up the ${card}`;
  }
  return 'The kitty';
}

// The scores, trump and the makers, then the four seats around the middle: you at the bottom, your partner across,
// play running to the left. The middle holds the turned card while trump is made, then the trick being played or
// the last one taken.
export default function Table({ gameState, viewer, showLastMove = false }: TableProps) {
  const { playerNames, currentPlayer, winners, handCounts, dealer, scores, tricksWon, trick, lastTrick, phase, trump, maker, alone, upcard, handNumber, lastMove } = gameState;
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
  const making = phase === 'order' || phase === 'name' || phase === 'alone' || phase === 'discard';
  const out = sittingOut(gameState);
  // The turned card shows face up until it is turned down or picked up
  const faceUp = phase === 'order' || (phase === 'alone' && trump === upcard?.suit);

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
        <span className="trump-info">
          Trump: {trump
            ? <><span className={`suit-symbol suit-${trump}`}>{SUIT_SYMBOLS[trump]}</span> <span className="suit-name">{trump}</span></>
            : 'not made yet'}
        </span>
        {maker !== null && <span className="maker-info">Made by {playerNames[maker]}{alone && ', alone'}</span>}
      </div>
      {seated && (
        <div className="seats">
          {placed.map(({ position, seat }) => {
            const classes = ['seat', `seat-${position}`];
            if (seat === currentPlayer && phase !== 'handOver') classes.push('seat-current');
            if (winners.includes(seat)) classes.push('seat-winner');
            if (seat === out) classes.push('seat-out');
            const note = seatNote(gameState, seat);
            return (
              <div key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
                <span className="seat-name">
                  {playerNames[seat]}
                  {seat === viewer && ' (you)'}
                  {viewer !== null && seat !== viewer && teamOf(seat) === teamOf(viewer) && ' (partner)'}
                </span>
                <span className="seat-count">{handCounts[seat]} cards{seat === dealer && ', dealer'}</span>
                {note && <span className="seat-note">{note}</span>}
              </div>
            );
          })}
          <div className="trick" aria-label="The trick">
            {making ? (
              <div className="kitty">
                <PlayingCard card={faceUp ? upcard : null} />
                <span className="kitty-label">{kittyLabel(gameState)}</span>
              </div>
            ) : (
              <>
                {placed.map(({ position, seat }) => {
                  const play = shown.find(p => p.seat === seat);
                  return (
                    <div key={seat} className={`trick-slot trick-${position}`}>
                      {play && (
                        <PlayingCard card={play.card} animKey={trickKey(seat)} highlighted={seat === lastPlayed || seat === takenBy} />
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
