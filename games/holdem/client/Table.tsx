import PlayingCard from '../../../src/components/PlayingCard';
import { boardKey } from './animateMove.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import { chipText } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog
  showLastMove?: boolean; // outlines the player who made the last move, for the history dialog
};

const plural = (count: number, word: string) => `${chipText(count)} ${word}${count === 1 ? '' : 's'}`;

// What a seat is doing in this hand, beside its chips
function seatNote(state: PublicGameState, seat: Seat): string {
  const { dealtIn, folded, chips, handResult } = state;
  if (!dealtIn.includes(seat)) return (chips[seat] ?? 0) === 0 ? 'Out of chips' : 'Waiting for the next hand';
  if (folded.includes(seat)) return 'Folded';
  if (!handResult && chips[seat] === 0) return 'All in';
  return '';
}

// Every seat with its chips, bet and cards, then the board and the pots. Your own cards face up; at a showdown the
// hands still in are shown with their best hand named.
export default function Table({ gameState, viewer, showLastMove = false }: TableProps) {
  const {
    activePlayers, playerNames, chips, bets, button, currentPlayer, dealtIn, folded, handResult, myCards, board, pots,
    lastMove, winners, isGameOver, handNumber
  } = gameState;
  const shownPots = handResult ? [] : pots.filter(pot => pot.amount > 0);

  return (
    <div className="holdem-table">
      <ol className="holdem-seats">
        {activePlayers.map(seat => {
          const classes = ['holdem-seat'];
          if (seat === currentPlayer && !isGameOver) classes.push('holdem-seat-current');
          if (folded.includes(seat) || !dealtIn.includes(seat)) classes.push('holdem-seat-out');
          if ((handResult?.won[seat] ?? 0) > 0 || winners.includes(seat)) classes.push('holdem-seat-winner');
          if (showLastMove && lastMove?.playerNumber === seat) classes.push('holdem-seat-last');
          const inHand = dealtIn.includes(seat) && !folded.includes(seat);
          const shown = handResult?.shown[seat];
          const cards = shown?.cards ?? (seat === viewer && inHand ? myCards : null);
          const note = seatNote(gameState, seat);
          const bet = bets[seat] ?? 0;
          const won = handResult?.won[seat] ?? 0;
          return (
            <li key={seat} className={classes.join(' ')} aria-label={`${playerNames[seat]}'s seat`} data-anim-key={seatKey(seat)}>
              <div className="holdem-seat-header">
                <span className="holdem-seat-name">
                  {playerNames[seat]}{seat === viewer && ' (you)'}{winners.includes(seat) && ' ★'}
                </span>
                {seat === button && <span className="holdem-button" title="Dealer button" aria-label="Dealer button">D</span>}
              </div>
              <div className="holdem-seat-chips">{plural(chips[seat] ?? 0, 'chip')}</div>
              <div className="holdem-seat-cards">
                {inHand && (cards
                  ? cards.map((card, index) => <PlayingCard key={index} card={card} size="small" />)
                  : [0, 1].map(index => <PlayingCard key={index} card={null} size="small" />))}
              </div>
              {shown && <div className="holdem-seat-hand">{shown.hand}</div>}
              {bet > 0 && <div className="holdem-seat-bet">Bet {chipText(bet)}</div>}
              {won > 0 && <div className="holdem-seat-won">Won {chipText(won)}</div>}
              {note && <div className="holdem-seat-note">{note}</div>}
            </li>
          );
        })}
      </ol>
      <section className="holdem-middle" aria-label="Board">
        <div className="holdem-hand-number">{handNumber > 0 ? `Hand ${handNumber}` : 'Waiting for players'}</div>
        <div className="holdem-board">
          {[0, 1, 2, 3, 4].map(index => board[index]
            ? <PlayingCard key={index} card={board[index]} size="medium" animKey={boardKey(index)} />
            : <span key={index} className="holdem-board-empty" />)}
        </div>
        <ul className="holdem-pots" aria-label="Pots">
          {shownPots.map((pot, index) => (
            <li key={index} className="holdem-pot">
              {index === 0 ? 'Pot' : `Side pot ${index}`}: {chipText(pot.amount)}
              {index > 0 && <span className="holdem-pot-players"> ({pot.eligible.map(seat => playerNames[seat]).join(', ')})</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
