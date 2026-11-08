import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import { BORDERS, CONTINENTS, TERRITORIES } from '../map.ts';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { CONTINENT_LABELS, MAP_HEIGHT, MAP_WIDTH, SEAT_SYMBOLS, TERRITORY_RADIUS, seatClass, territoryKey } from './layout.ts';
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
// disc in its owner's color with its army count
export default function WorldMap({ gameState, source = null, target = null, targets = [], highlight = [], draft = {}, canSelect, onSelect }: WorldMapProps) {
  const { owners, armies, playerNames } = gameState;
  return (
    <svg className="world-map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label="World map">
      <ServerSvg url={svgUrl('territories-land')} inSvg svgProps={{ width: MAP_WIDTH, height: MAP_HEIGHT }} />
      {CONTINENTS.map(({ id, name, bonus }) => (
        <text key={id} className="continent-label" x={CONTINENT_LABELS[id].x} y={CONTINENT_LABELS[id].y}>{name} +{bonus}</text>
      ))}
      {BORDERS.map(({ a, b, sea }) => {
        const from = byId.get(a)!;
        const to = byId.get(b)!;
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
          <g key={id} className={classNames.join(' ')} data-anim-key={territoryKey(id)} data-drop={onSelect ? `land-${id}` : undefined}
            role={selectable ? 'button' : undefined} tabIndex={selectable ? 0 : undefined} aria-label={label}
            onClick={selectable ? () => onSelect?.(id) : undefined}
            onKeyDown={selectable ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(id); } } : undefined}>
            <title>{label}</title>
            <circle className="disc" cx={x} cy={y} r={TERRITORY_RADIUS} />
            <text className="army-count" x={x} y={y}>{count}</text>
            <ColorSymbol color={owner ? SEAT_SYMBOLS[owner] : null} className="disc-symbol"
              svgProps={{ x: x - SYMBOL_SIZE / 2, y: y + 7, width: SYMBOL_SIZE, height: SYMBOL_SIZE }} />
            <text className="territory-name" x={x} y={y + TERRITORY_RADIUS + 11}>{name}</text>
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
