import Tile from './Tile';
import { COLORS } from '../rules.ts';
import { CENTER_MARKER_KEY, byColor, centerKey, factoryKey } from './animateMove.ts';
import { sameSource, type Selection } from './selection.ts';
import type { Color, PublicGameState, Source } from '../types.ts';

type FactoriesProps = {
  gameState: PublicGameState;
  isMyTurn: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
};

const CENTER: Source = { type: 'center' };

export default function Factories({ gameState, isMyTurn, selection, onSelect }: FactoriesProps) {
  const { factories, center, centerHasMarker } = gameState;
  const centerShown = byColor(center);

  // keyOf(index) names the slot of the index-th tile shown, for move animations
  function renderTiles(source: Source, tiles: Color[], keyOf: (index: number) => string) {
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
          <Tile kind={color} selected={selected} animKey={keyOf(index)} />
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
            <div key={index} className="factory">
              {renderTiles(source, tiles, slot => factoryKey(index, slot))}
            </div>
          );
        })}
      </div>
      <div className="center">
        <span className="center-label">Center</span>
        {centerHasMarker && <Tile kind="first" animKey={CENTER_MARKER_KEY} />}
        {/* One group per color: a group moves to the next row whole instead of wrapping */}
        {COLORS.filter(color => center.includes(color)).map(color => {
          const start = centerShown.indexOf(color);
          return (
            <span key={color} className="center-group">
              {renderTiles(CENTER, center.filter(tile => tile === color), slot => centerKey(start + slot))}
            </span>
          );
        })}
      </div>
    </div>
  );
}
