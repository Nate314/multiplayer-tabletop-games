import { BOARD, HOTEL, RAILROAD_RENTS, UTILITY_MULTIPLIERS, ownable, unmortgageCost } from '../board.ts';
import { buildError, mortgageError, sellError, unmortgageError } from '../buildings.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

type PropertyPanelProps = {
  gameState: PublicGameState;
  space: number;
  playerNumber: Seat;
  canManage: boolean; // it is this player's move to make
  onMove: (move: Move) => void;
  onClose: () => void;
};

const RENT_LABELS = ['Rent', 'With 1 house', 'With 2 houses', 'With 3 houses', 'With 4 houses', 'With a hotel'];

function Rents({ space }: { space: number }) {
  const target = BOARD[space];
  if (target.kind === 'street') {
    return (
      <table className="deed-rents">
        <tbody>
          {target.rents.map((rent, level) => (
            <tr key={level}><td>{RENT_LABELS[level]}</td><td>${rent}</td></tr>
          ))}
          <tr><td>Whole color group, no houses</td><td>${target.rents[0] * 2}</td></tr>
          <tr><td>Each house or hotel costs</td><td>${target.houseCost}</td></tr>
        </tbody>
      </table>
    );
  }
  if (target.kind === 'railroad') {
    return (
      <table className="deed-rents">
        <tbody>
          {RAILROAD_RENTS.map((rent, index) => (
            <tr key={index}><td>{index + 1} railroad{index > 0 ? 's' : ''} owned</td><td>${rent}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="deed-rents">
      <tbody>
        {UTILITY_MULTIPLIERS.map((times, index) => (
          <tr key={index}><td>{index + 1} utilit{index > 0 ? 'ies' : 'y'} owned</td><td>{times} times the dice</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// A Title Deed for the chosen property, with the owner's building and mortgage buttons
export default function PropertyPanel({ gameState, space, playerNumber, canManage, onMove, onClose }: PropertyPanelProps) {
  const property = ownable(space);
  if (!property) return null;
  const target = BOARD[space];
  const { owners, playerNames, buildings, mortgaged, debts, auction } = gameState;
  const owner = owners[space];
  const level = buildings[space] ?? 0;
  const mine = owner === playerNumber && canManage;
  // A debtor may only raise money, and nothing is built during an auction
  const raisingOnly = debts.length > 0 || auction !== null;

  const action = (type: 'build' | 'sellBuilding' | 'mortgage' | 'unmortgage', label: string, error: string | null) => (
    <button type="button" onClick={() => onMove({ type, space })} disabled={error !== null} title={error ?? undefined}>
      {label}
    </button>
  );

  return (
    <section className="panel deed" aria-label={`${property.name} title deed`}>
      <div className={`deed-header ${target.kind === 'street' ? `group-${target.group}` : 'deed-plain'}`}>
        <span className="deed-name">{property.name}</span>
        <button type="button" className="deed-close" onClick={onClose} aria-label="Close the title deed">×</button>
      </div>
      <div className="deed-owner">
        {owner === undefined ? `For sale by the bank: $${property.price}` : `Owned by ${playerNames[owner]}`}
        {level > 0 && `, ${level === HOTEL ? 'a hotel' : `${level} house${level > 1 ? 's' : ''}`}`}
        {mortgaged.includes(space) && ', mortgaged'}
      </div>
      <Rents space={space} />
      <div className="deed-mortgage">Mortgage value ${property.mortgage}; lifting it costs ${unmortgageCost(space)}</div>
      {mine && (
        <div className="deed-actions">
          {target.kind === 'street' && action('build', level === 4 ? 'Build hotel' : 'Build house',
            raisingOnly ? 'Not while money is owed or an auction runs' : buildError(gameState, playerNumber, space))}
          {target.kind === 'street' && action('sellBuilding', 'Sell building', sellError(gameState, playerNumber, space))}
          {mortgaged.includes(space)
            ? action('unmortgage', 'Lift mortgage', raisingOnly ? 'Not while money is owed or an auction runs' : unmortgageError(gameState, playerNumber, space))
            : action('mortgage', 'Mortgage', mortgageError(gameState, playerNumber, space))}
        </div>
      )}
    </section>
  );
}
