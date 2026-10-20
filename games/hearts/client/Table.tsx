import PlayingCard from '../../../src/components/PlayingCard';
import { plural } from '../../../shared/text.ts';
import { seatKey, trickKey } from '../../../src/animation/animKeys.ts';
import { SEATS, TARGET_SCORE, nextSeat, passDirection, passPhrase } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog's table view
  showLastMove?: boolean; // highlights the last card played, for the history dialog
};

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// The scores, the hand's pass and whether hearts are broken, then the four seats around the middle: you at the
// bottom, play running to the left. The middle holds the trick being played, or the last one taken.
export default function Table({ gameState, viewer, showLastMove = false }: TableProps) {
  const {
    playerNames, currentPlayer, winners, handCounts, scores, taken, trick, lastTrick, phase, handNumber, heartsBroken,
    passed, lastMove
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
  const direction = passDirection(handNumber);

  return (
    <div className="table">
      <ol className="scoreboard" aria-label="Scores">
        {SEATS.filter(seat => playerNames[seat] !== undefined).map(seat => (
          <li key={seat} className={winners.includes(seat) ? 'score score-winner' : 'score'}>
            <span className="score-name">{playerNames[seat]}{seat === viewer && ' (you)'}</span>
            <span className="score-total">{scores[seat]}</span>
            <span className="score-taken">{taken[seat]} this hand</span>
          </li>
        ))}
      </ol>
      <div className="hand-info">
        <span>Hand {handNumber}, game ends at {TARGET_SCORE}</span>
        <span>{direction === 'none' ? 'No pass this hand' : `Pass: ${direction}`}</span>
        <span className="hearts-broken">{heartsBroken ? 'Hearts broken' : 'Hearts not broken'}</span>
      </div>
      {seated && (
        <div className="seats">
          {placed.map(({ position, seat }) => {
            const classes = ['seat', `seat-${position}`];
            if (seat === currentPlayer && phase === 'play') classes.push('seat-current');
            if (winners.includes(seat)) classes.push('seat-winner');
            return (
              <div key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
                <span className="seat-name">{playerNames[seat]}{seat === viewer && ' (you)'}</span>
                <span className="seat-count">{plural(handCounts[seat], 'card')}, {plural(taken[seat], 'point')}</span>
                {phase === 'passing' && <span className="seat-note">{passed.includes(seat) ? 'passed' : 'choosing'}</span>}
              </div>
            );
          })}
          <div className="trick" aria-label="The trick">
            {phase === 'passing' ? (
              <div className="trick-message">Everyone passes three cards {passPhrase(direction)}</div>
            ) : (
              <>
                {placed.map(({ position, seat }) => {
                  const play = shown.find(p => p.seat === seat);
                  return (
                    <div key={seat} className={`trick-slot trick-${position}`}>
                      {play && (
                        <PlayingCard card={play.card} size="small" animKey={trickKey(seat)}
                          highlighted={seat === lastPlayed || seat === takenBy} />
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
