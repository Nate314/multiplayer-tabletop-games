import PlayingCard from '../../../src/components/PlayingCard';
import { battleKey, pileKey, shownBattle } from './animateMove.ts';
import type { PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog
  showLastMove?: boolean; // highlights the card the last flip turned up, for the history dialog
  onFlip?: () => void; // given only when the viewer may flip; their pile is then a button
};

function battleSummary(state: PublicGameState): string {
  const { battle, lastBattle, playerNames } = state;
  if (battle) return battle.wars > 0 ? `War! ${battle.wars === 1 ? 'One tie' : `${battle.wars} ties`} so far` : 'Battle under way';
  if (!lastBattle) return 'No battle yet';
  if (lastBattle.winner === null) return 'Tied with no cards left: each player took their own cards back';
  const taken = Object.values(lastBattle.cards).flat().length;
  return `${playerNames[lastBattle.winner]} won the ${lastBattle.wars > 0 ? 'war' : 'battle'} and took ${taken} cards`;
}

// Each player's pile with its count, and the cards they put into the battle in order (war cards face down, then face up)
export default function Table({ gameState, viewer, showLastMove = false, onFlip }: TableProps) {
  const { pileCounts, playerNames, currentPlayer, winners, lastMove, isGameOver, lastBattle, battle } = gameState;
  const seats = Object.keys(pileCounts).map(Number).sort((a, b) => a - b);
  // Your own seat sits at the bottom, nearest your Flip button
  const ordered = viewer !== null && seats.includes(viewer) ? [...seats.filter(seat => seat !== viewer), viewer] : seats;
  const shown = shownBattle(gameState);

  const sides = ordered.map(seat => {
    const count = pileCounts[seat];
    const laid = shown?.cards[seat] ?? [];
    const classes = ['war-seat'];
    if (seat === currentPlayer && !isGameOver) classes.push('war-seat-current');
    if (winners.includes(seat) || (!battle && lastBattle?.winner === seat)) classes.push('war-seat-winner');
    const lastUp = showLastMove && lastMove?.playerNumber === seat && lastMove.fresh ? laid.length - 1 : -1;
    return (
      <section key={seat} className={classes.join(' ')} aria-label={`${playerNames[seat]}'s side`}>
        <header className="war-seat-header">
          <span className="war-seat-name">
            {playerNames[seat]}{seat === viewer && ' (you)'}{winners.includes(seat) && ' ★'}
          </span>
          <span className="war-seat-count">{count} {count === 1 ? 'card' : 'cards'}</span>
        </header>
        <div className="war-seat-row">
          <div className="war-pile" data-anim-key={pileKey(seat)}>
            {count === 0
              ? <span className="war-pile-empty" aria-label="Empty pile" />
              : seat === viewer && onFlip
                ? <PlayingCard card={null} size="large" onClick={onFlip} />
                : <PlayingCard card={null} size="large" />}
          </div>
          <div className="war-battle" aria-label={`${playerNames[seat]}'s battle cards`}>
            {laid.map((card, index) => (
              <PlayingCard key={index} card={card} size={card ? 'large' : 'medium'} animKey={battleKey(seat, index)}
                highlighted={index === lastUp} />
            ))}
          </div>
        </div>
      </section>
    );
  });

  // The battle's result sits between the two sides
  return (
    <div className="war-table">
      {sides[0]}
      <div className="war-summary" role="status">{battleSummary(gameState)}</div>
      {sides.slice(1)}
    </div>
  );
}
