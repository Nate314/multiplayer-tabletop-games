import { CATEGORY_LABELS, LOWER, UPPER, UPPER_BONUS_AT, allowedCategories, scoreFor, totals } from '../rules.ts';
import type { Category, PublicGameState, Seat } from '../types.ts';

type ScoreSheetProps = {
  gameState: PublicGameState;
  viewer: Seat | null;
  // Given only when the viewer may score now; the sheet then offers the possible scores in their empty boxes
  onScore?: (category: Category) => void;
  showLastMove?: boolean;
};

// One table: a row per box, a column per player
export default function ScoreSheet({ gameState, viewer, onScore, showLastMove = false }: ScoreSheetProps) {
  const { activePlayers, playerNames, sheets, yahtzeeBonuses, currentPlayer, dice, isGameOver, winners, lastMove } = gameState;
  const scored = showLastMove && lastMove?.type === 'score' ? lastMove : null;

  const cell = (seat: Seat, category: Category) => {
    const sheet = sheets[seat];
    const className = scored?.playerNumber === seat && scored.category === category ? 'yz-cell yz-cell-last' : 'yz-cell';
    if (sheet[category] !== undefined) return <td key={seat} className={className}>{sheet[category]}</td>;
    if (onScore && seat === viewer) {
      const points = scoreFor(dice, category, sheet);
      const allowed = allowedCategories(dice, sheet).includes(category);
      return (
        <td key={seat} className={className}>
          <button type="button" className="yz-option" disabled={!allowed} aria-label={`Score ${points} in ${CATEGORY_LABELS[category]}`} onClick={() => onScore(category)}>
            {points}
          </button>
        </td>
      );
    }
    return <td key={seat} className={className} />;
  };

  const row = (category: Category) => (
    <tr key={category}>
      <th scope="row">{CATEGORY_LABELS[category]}</th>
      {activePlayers.map(seat => cell(seat, category))}
    </tr>
  );
  const totalOf = (seat: Seat) => totals(sheets[seat], yahtzeeBonuses[seat]);
  const sumRow = (label: string, value: (seat: Seat) => number, className = 'yz-sum') => (
    <tr className={className}>
      <th scope="row">{label}</th>
      {activePlayers.map(seat => <td key={seat}>{value(seat)}</td>)}
    </tr>
  );

  return (
    <div className="yz-sheet-wrap">
      <table className="yz-sheet">
        <caption className="yz-visually-hidden">Score sheet</caption>
        <thead>
          <tr>
            <th scope="col"><span className="yz-visually-hidden">Box</span></th>
            {activePlayers.map(seat => {
              const classes = ['yz-player'];
              if (seat === currentPlayer) classes.push('yz-player-current');
              if (isGameOver && winners.includes(seat)) classes.push('yz-player-winner');
              return (
                <th key={seat} scope="col" className={classes.join(' ')}>
                  {playerNames[seat]}{seat === viewer && ' (you)'}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {UPPER.map(row)}
          {sumRow('Upper total', seat => totalOf(seat).upper)}
          {sumRow(`Bonus (${UPPER_BONUS_AT}+)`, seat => totalOf(seat).upperBonus)}
          {LOWER.map(row)}
          {sumRow('Yahtzee bonus', seat => totalOf(seat).yahtzeeBonus)}
          {sumRow('Total', seat => totalOf(seat).total, 'yz-sum yz-total')}
        </tbody>
      </table>
    </div>
  );
}
