import { BORDERS, CONTINENTS, TERRITORIES } from '../map.ts';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { CONTINENT_LABELS, CONTINENT_SHAPES, MAP_HEIGHT, MAP_WIDTH, SEAT_SYMBOLS, TERRITORY_RADIUS, seatClass, shortName, territoryKey } from './layout.ts';
import type { PublicGameState } from '../types.ts';

type WorldMapProps = {
  gameState: Pick<PublicGameState, 'owners' | 'armies' | 'playerNames'>;
  source?: string | null; // the territory chosen to attack or move from
  target?: string | null;
  targets?: string[]; // where the chosen source can attack or move to
  highlight?: string[]; // territories the last move touched, outlined in the history
  draft?: Record<string, number>; // armies about to be placed, shown as +n
  canSelect?: (id: string) => boolean;
  onSelect?: (id: string) => void;
};

const SYMBOL_SIZE = 9; // under the army count, inside the disc

const byId = new Map(TERRITORIES.map(territory => [territory.id, territory]));

// The world: continents as soft land shapes, every border as a line (dashed across the sea), and each territory as a
// disc in its owner's color with its army count. Alaska and Kamchatka meet across the edge of the map.
export default function WorldMap({ gameState, source = null, target = null, targets = [], highlight = [], draft = {}, canSelect, onSelect }: WorldMapProps) {
  const { owners, armies, playerNames } = gameState;
  return (
    <svg className="world-map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label="World map">
      <rect className="sea" x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} rx={12} />
      {CONTINENTS.map(({ id, name, bonus }) => (
        <g key={id} className={`continent continent-${id}`}>
          <polygon className="land" points={CONTINENT_SHAPES[id]} />
          <text className="continent-label" x={CONTINENT_LABELS[id].x} y={CONTINENT_LABELS[id].y}>{name} +{bonus}</text>
        </g>
      ))}
      {BORDERS.map(({ a, b, sea }) => {
        const from = byId.get(a)!;
        const to = byId.get(b)!;
        if (a === 'kamchatka' && b === 'alaska') {
          return (
            <g key={`${a}-${b}`} className="border sea-lane">
              <line x1={from.x} y1={from.y} x2={MAP_WIDTH} y2={from.y - 6} />
              <line x1={0} y1={to.y - 6} x2={to.x} y2={to.y} />
            </g>
          );
        }
        return <line key={`${a}-${b}`} className={sea ? 'border sea-lane' : 'border'} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}
      {TERRITORIES.map(({ id, name, x, y }) => {
        const owner = owners[id];
        const selectable = canSelect?.(id) ?? false;
        const classNames = ['territory', seatClass(owner)];
        if (selectable) classNames.push('selectable');
        if (id === source) classNames.push('source');
        if (id === target) classNames.push('target');
        if (targets.includes(id)) classNames.push('can-target');
        if (highlight.includes(id)) classNames.push('highlight');
        const ownerName = owner === null ? 'neutral' : owner === undefined ? 'unclaimed' : playerNames[owner];
        const count = armies[id] ?? 0;
        const label = `${name}: ${ownerName}, ${count} ${count === 1 ? 'army' : 'armies'}`;
        const added = draft[id] ?? 0;
        return (
          <g key={id} className={classNames.join(' ')} data-anim-key={territoryKey(id)}
            role={selectable ? 'button' : undefined} tabIndex={selectable ? 0 : undefined} aria-label={label}
            onClick={selectable ? () => onSelect?.(id) : undefined}
            onKeyDown={selectable ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(id); } } : undefined}>
            <title>{label}</title>
            <circle className="disc" cx={x} cy={y} r={TERRITORY_RADIUS} />
            <text className="army-count" x={x} y={y}>{count}</text>
            <ColorSymbol color={owner ? SEAT_SYMBOLS[owner] : null} className="disc-symbol"
              svgProps={{ x: x - SYMBOL_SIZE / 2, y: y + 7, width: SYMBOL_SIZE, height: SYMBOL_SIZE }} />
            <text className="territory-name" x={x} y={y + TERRITORY_RADIUS + 11}>{shortName(id)}</text>
            {added > 0 && (
              <g className="draft-badge">
                <circle cx={x + TERRITORY_RADIUS - 2} cy={y - TERRITORY_RADIUS + 2} r={10} />
                <text x={x + TERRITORY_RADIUS - 2} y={y - TERRITORY_RADIUS + 2}>+{added}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
