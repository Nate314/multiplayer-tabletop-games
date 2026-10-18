import PlayingCard from '../../../src/components/PlayingCard';
import { bookKey, seatKey, STOCK_KEY } from './animateMove.ts';
import { describeAsk, rankPlural, TOTAL_BOOKS } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null for the table view in the history
  // Highlights who asked whom in the last move; for the history dialog
  showLastMove?: boolean;
  // Given only while the viewer may ask: each other player with cards is then a button
  onPickTarget?: (seat: Seat) => void;
  target?: Seat | null;
};

// Every player in seat order with their card count and books, the stock, and the ask log, newest first
export default function Table({ gameState, viewer, showLastMove = false, onPickTarget, target = null }: TableProps) {
  const { activePlayers, playerNames, handCounts, books, currentPlayer, winners, stockCount, log, lastMove } = gameState;
  const booksDown = Object.values(books).flat().length;
  const asker = showLastMove ? lastMove?.asker : undefined;
  const asked = showLastMove ? lastMove?.target : undefined;
  // Dismissed players keep their books, which still count toward the 13
  const left = Object.keys(books).map(Number).filter(seat => !activePlayers.includes(seat)).sort((a, b) => a - b);
  const bookParts = (seat: Seat) => {
    const held = books[seat] ?? [];
    return (
      <>
        <span className="player-books">{held.length} {held.length === 1 ? 'book' : 'books'}</span>
        <span className="book-list">
          {held.map(rank => (
            <span key={rank} className="book" data-anim-key={bookKey(rank)} title={`Book of ${rankPlural(rank)}`}>{rank}</span>
          ))}
        </span>
      </>
    );
  };

  return (
    <div className="table">
      <ol className="players">
        {activePlayers.map(seat => {
          const count = handCounts[seat] ?? 0;
          const classes = ['player'];
          if (seat === currentPlayer) classes.push('player-current');
          if (winners.includes(seat)) classes.push('player-winner');
          if (seat === asker) classes.push('player-last');
          if (seat === asked) classes.push('player-target');
          if (seat === target) classes.push('player-picked');
          const pickable = onPickTarget && seat !== viewer && count > 0;
          const body = (
            <>
              <span className="player-name">
                {playerNames[seat]}{seat === viewer && ' (you)'}{winners.includes(seat) && ' ★'}
              </span>
              <span className="player-count">
                {count === 0 && stockCount === 0 ? 'out of cards' : `${count} ${count === 1 ? 'card' : 'cards'}`}
              </span>
              {bookParts(seat)}
            </>
          );
          return (
            <li key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
              {pickable
                ? <button type="button" className="player-pick" aria-pressed={seat === target} onClick={() => onPickTarget(seat)}>{body}</button>
                : <div className="player-body">{body}</div>}
            </li>
          );
        })}
        {left.map(seat => (
          <li key={seat} className="player player-left">
            <div className="player-body">
              <span className="player-name">{playerNames[seat]} (left)</span>
              <span className="player-count">no longer playing</span>
              {bookParts(seat)}
            </div>
          </li>
        ))}
      </ol>
      <div className="table-middle">
        <div className="stock">
          {stockCount > 0
            ? <PlayingCard card={null} animKey={STOCK_KEY} />
            : <span className="stock-empty" data-anim-key={STOCK_KEY} />}
          <span className="stock-label">Stock: {stockCount}</span>
          <span className="stock-label">Books: {booksDown} of {TOTAL_BOOKS}</span>
        </div>
        <section className="ask-log" aria-label="Asks so far">
          <header className="ask-log-header">Asks so far</header>
          {log.length === 0
            ? <p className="ask-log-empty">No asks yet</p>
            : (
              <ol className="ask-log-list" reversed>
                {[...log].reverse().map((entry, index) => (
                  <li key={log.length - index}>{describeAsk(entry, playerNames)}</li>
                ))}
              </ol>
            )}
        </section>
      </div>
    </div>
  );
}
