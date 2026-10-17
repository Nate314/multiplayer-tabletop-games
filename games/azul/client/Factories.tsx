import Tile from './Tile';
import { COLORS } from '../rules.ts';
import { sameSource, type Selection } from './selection.ts';
import type { Color, PublicGameState, Source } from '../types.ts';

type FactoriesProps = {
  gameState: PublicGameState;
  isMyTurn: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
};

const CENTER: Source = { type: 'center' };

const byColor = (tiles: Color[]): Color[] =>
  [...tiles].sort((a, b) => COLORS.indexOf(a) - COLORS.indexOf(b));

export default function Factories({ gameState, isMyTurn, selection, onSelect }: FactoriesProps) {
  const { factories, center, centerHasMarker, lastMove } = gameState;

  const pileClass = (base: string, source: Source) =>
    lastMove !== null && sameSource(lastMove.source, source) ? `${base} last-source` : base;

  function renderTiles(source: Source, tiles: Color[]) {
    return byColor(tiles).map((color, index) => {
      const selected = selection !== null && sameSource(selection.source, source) && selection.color === color;
      return (
        <button
          key={index}
          type="button"
          className="tile-button"
          disabled={!isMyTurn}
          aria-label={`Take ${color}`}
          onClick={() => onSelect(selected ? null : { source, color })}
        >
          <Tile kind={color} selected={selected} />
        </button>
      );
    });
  }

  return (
    <div className={isMyTurn ? 'table' : 'table table-waiting'}>
      <div className="factories">
        {factories.map((tiles, index) => {
          const source: Source = { type: 'factory', index };
          return (
            <div key={index} className={pileClass('factory', source)}>
              {renderTiles(source, tiles)}
            </div>
          );
        })}
      </div>
      <div className={pileClass('center', CENTER)}>
        <span className="center-label">Centre</span>
        {centerHasMarker && <Tile kind="first" />}
        {/* One group per colour: a group moves to the next row whole instead of wrapping */}
        {COLORS.filter(color => center.includes(color)).map(color => (
          <span key={color} className="center-group">
            {renderTiles(CENTER, center.filter(tile => tile === color))}
          </span>
        ))}
      </div>
    </div>
  );
}
