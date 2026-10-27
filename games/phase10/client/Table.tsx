import YouTag from '../../../src/components/YouTag.tsx';
import CardView from './CardView';
import { cardKey } from './animateMove.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import { LAST_PHASE, anyOrder, handPlayers, phaseName, phasesDoneOf, runValue } from '../rules.ts';
import type { Group, LastMove, PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  seats: Seat[]; // in the order the players are shown
  playerNumber: Seat | null; // null in the history
  // True when the viewer may hit now and has cards selected
  canHit: boolean;
  onHit: (group: number) => void;
  // The move to highlight, in the history dialog; null on the live screen
  lastMove?: LastMove | null;
};

function groupLabel(group: Group): string {
  if (group.kind === 'set') return `Set of ${group.value}s`;
  if (group.kind === 'color') return `All ${group.color}`;
  return `Run ${group.start} to ${group.start + group.cards.length - 1}`;
}

// The groups the last move laid down or hit
function highlighted(lastMove: LastMove | null, groups: Group[]): number[] {
  if (lastMove?.type === 'hit') return [lastMove.group];
  if (lastMove?.type === 'layDown') {
    return groups.map((group, index) => (group.owner === lastMove.playerNumber ? index : -1)).filter(index => index >= 0);
  }
  return [];
}

// Which phase a player is on, or with phases in any order, which they have completed
function progress(gameState: PublicGameState, seat: Seat): string {
  const { phases, tiebreak } = gameState;
  if (!anyOrder(gameState) || tiebreak.includes(seat)) {
    return phases[seat] > LAST_PHASE ? 'All phases done' : `Phase ${phases[seat]}: ${phaseName(phases[seat])}`;
  }
  const done = phasesDoneOf(gameState, seat);
  if (done.length === LAST_PHASE) return 'All phases done';
  return done.length === 0 ? 'No phases done yet' : `Done: ${done.join(', ')} (${done.length}/${LAST_PHASE})`;
}

// Every player with their phase, score, card count and the groups they have laid down
export default function Table({ gameState, seats, playerNumber, canHit, onHit, lastMove = null }: TableProps) {
  const { groups, scores, handCounts, playerNames, currentPlayer, activePlayers, winners, skipped, dealer } = gameState;
  const lit = highlighted(lastMove, groups);
  const playing = handPlayers(gameState);

  return (
    <div className="table">
      {seats.map(seat => {
        const classes = ['seat'];
        if (seat === currentPlayer) classes.push('seat-current');
        if (!activePlayers.includes(seat)) classes.push('seat-left');
        if (winners.includes(seat)) classes.push('seat-winner');
        const mine = seat === playerNumber;
        const own = groups.map((group, index) => ({ group, index })).filter(({ group }) => group.owner === seat);
        // Another player matters only for the groups you can hit
        if (!mine) classes.push(own.length > 0 ? 'hand-only-board' : 'hand-only-hide');

        return (
          <section key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
            <header className="seat-header">
              <span className="seat-name">
                {playerNames[seat]}
                <YouTag when={seat === playerNumber} />
                {!activePlayers.includes(seat) && ' (left)'}
                {winners.includes(seat) && ' ★'}
              </span>
              <span className="seat-score">{scores[seat]} pts</span>
            </header>
            <div className={mine ? 'seat-details' : 'seat-details hand-only-hide'}>
              <span>{progress(gameState, seat)}</span>
              <span>
                {handCounts[seat] ?? 0} {handCounts[seat] === 1 ? 'card' : 'cards'}
                {seat === dealer && ' · dealer'}
                {skipped.includes(seat) && ' · skipped next'}
                {!playing.includes(seat) && activePlayers.includes(seat) && ' · not in the tiebreaker'}
              </span>
            </div>
            {own.length > 0 && (
              <div className="groups hand-only-board">
                {own.map(({ group, index }) => (
                  <div key={index} className={lit.includes(index) ? 'group group-last' : 'group'}>
                    <div className="group-label">{groupLabel(group)}</div>
                    <div className="group-cards">
                      {group.cards.map((card, position) => (
                        <CardView key={card.id} card={card} small animKey={cardKey(card.id)} standsFor={runValue(group, position)} />
                      ))}
                    </div>
                    {canHit && (
                      <button type="button" className="hit-button" onClick={() => onHit(index)}>Hit here</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
