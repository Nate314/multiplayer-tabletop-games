import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { CITIES, ROUTES, routeName } from '../map.ts';
import { CITY_RADIUS, MAP_HEIGHT, MAP_LEFT, MAP_WIDTH, TRACK_WIDTH, labelPlacement, routeSpaces } from './geometry.ts';
import type { Space } from './geometry.ts';
import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { routeKey } from './animateMove.ts';
import { DOUBLES_FROM } from '../rules.ts';
import type { PublicGameState, Route } from '../types.ts';

type MapBoardProps = {
  gameState: Pick<PublicGameState, 'claimed' | 'playerCount' | 'playerNames'>;
  selected?: number | null;           // the route picked for claiming
  highlight?: number | null;          // the route of the last move
  cities?: number[];                  // cities to ring, such as a hovered ticket's
  onRoute?: (route: number) => void;  // clicking a route; none on the history board
};

// Each track's spaces are computed once; the map never changes
const SPACES = ROUTES.map(routeSpaces);
const SYMBOL_SIZE = TRACK_WIDTH; // as wide as a car, so it sits inside it

function trackTitle(route: Route, owner: string | null, closed: boolean): string {
  const base = `${routeName(route)}: ${route.length} ${route.color}`;
  if (owner) return `${base}, claimed by ${owner}`;
  return closed ? `${base}, closed (the other track is taken)` : base;
}

// One symbol, centered on the middle car of a route: an open colored route's color, or a claimed route's owner
function RouteSymbol({ color, space, className }: { color: SymbolColor | undefined; space: Space; className?: string }) {
  const size = SYMBOL_SIZE;
  return <ColorSymbol color={color} className={className} svgProps={{ x: space.x - size / 2, y: space.y - size / 2, width: size, height: size, style: { width: size, height: size } }} />;
}

// The map drawn in SVG: land, every route as a chain of train spaces, and the cities on top
export default function MapBoard({ gameState, selected = null, highlight = null, cities = [], onRoute }: MapBoardProps) {
  const { claimed, playerCount, playerNames } = gameState;
  return (
    // On a narrow window the map keeps a usable size and scrolls sideways
    <div className="map-frame">
      <svg className="map" viewBox={`${MAP_LEFT} 0 ${MAP_WIDTH - MAP_LEFT} ${MAP_HEIGHT}`} role="group" aria-label="Map of the United States with its railway routes">
        <ServerSvg url={svgUrl('tickettoride-land')} inSvg svgProps={{ x: MAP_LEFT, y: 0, width: MAP_WIDTH - MAP_LEFT, height: MAP_HEIGHT }} />
        {ROUTES.map(route => {
          const owner = claimed[route.id];
          const twinOwner = route.twin === null ? undefined : claimed[route.twin];
          const closed = owner === undefined && twinOwner !== undefined && playerCount < DOUBLES_FROM;
          const classes = [
            'track',
            owner === undefined ? `track-${route.color}` : `owned seat${owner}`,
            closed ? 'closed' : '',
            selected === route.id ? 'selected' : '',
            highlight === route.id ? 'highlight' : '',
            onRoute && owner === undefined && !closed ? 'clickable' : ''
          ].filter(Boolean).join(' ');
          const title = trackTitle(route, owner === undefined ? null : playerNames[owner], closed);
          const open = onRoute && owner === undefined && !closed;
          return (
            <g
              key={route.id}
              className={classes}
              data-anim-key={routeKey(route.id)}
              role={open ? 'button' : undefined}
              tabIndex={open ? 0 : undefined}
              aria-label={open ? title : undefined}
              onClick={open ? () => onRoute(route.id) : undefined}
              onKeyDown={open ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRoute(route.id); } } : undefined}
            >
              <title>{title}</title>
              {open && <polyline className="hit-area" points={SPACES[route.id].map(space => `${space.x},${space.y}`).join(' ')} />}
              {SPACES[route.id].map((space, index) => (
                <rect
                  key={index}
                  x={space.x - space.length / 2}
                  y={space.y - TRACK_WIDTH / 2}
                  width={space.length}
                  height={TRACK_WIDTH}
                  rx={2}
                  transform={`rotate(${space.angle} ${space.x} ${space.y})`}
                />
              ))}
              {owner !== undefined && SPACES[route.id].map((space, index) => <circle key={`dot-${index}`} cx={space.x} cy={space.y} r={2} />)}
              {owner === undefined && route.color !== 'gray' && <RouteSymbol color={route.color} space={SPACES[route.id][Math.floor(route.length / 2)]} />}
              {owner !== undefined && <RouteSymbol color={SEAT_SYMBOLS[owner]} space={SPACES[route.id][Math.floor(route.length / 2)]} />}
            </g>
          );
        })}
        {CITIES.map(city => {
          const { dx, dy, anchor } = labelPlacement(city.label);
          return (
            <g key={city.id} className={cities.includes(city.id) ? 'city ringed' : 'city'}>
              <circle cx={city.x} cy={city.y} r={CITY_RADIUS} />
              <text x={city.x + dx} y={city.y + dy} textAnchor={anchor}>{city.name}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
