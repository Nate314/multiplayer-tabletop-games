import CardView from './CardView';
import { cardKey } from './animateMove.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import { LAST_PHASE, handPlayers, phaseName, runValue } from '../rules.ts';
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

// Every player with their phase, score, card count and the groups they have laid down
export default function Table({ gameState, seats, playerNumber, canHit, onHit, lastMove = null }: TableProps) {
  const { groups, phases, scores, handCounts, playerNames, currentPlayer, activePlayers, winners, skipped, dealer } = gameState;
  const lit = highlighted(lastMove, groups);
  const playing = handPlayers(gameState);

  return (
    <div className="table">
      {seats.map(seat => {
        const phase = phases[seat];
        const classes = ['seat'];
        if (seat === currentPlayer) classes.push('seat-current');
        if (!activePlayers.includes(seat)) classes.push('seat-left');
        if (winners.includes(seat)) classes.push('seat-winner');
        const own = groups.map((group, index) => ({ group, index })).filter(({ group }) => group.owner === seat);

        return (
          <section key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
            <header className="seat-header">
              <span className="seat-name">
                {playerNames[seat]}
                {seat === playerNumber && ' (you)'}
                {!activePlayers.includes(seat) && ' (left)'}
                {winners.includes(seat) && ' ★'}
              </span>
              <span className="seat-score">{scores[seat]} pts</span>
            </header>
            <div className="seat-details">
              <span>{phase > LAST_PHASE ? 'All phases done' : `Phase ${phase}: ${phaseName(phase)}`}</span>
              <span>
                {handCounts[seat] ?? 0} {handCounts[seat] === 1 ? 'card' : 'cards'}
                {seat === dealer && ' · dealer'}
                {skipped.includes(seat) && ' · skipped next'}
                {!playing.includes(seat) && activePlayers.includes(seat) && ' · not in the tiebreaker'}
              </span>
            </div>
            {own.length > 0 && (
              <div className="groups">
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
