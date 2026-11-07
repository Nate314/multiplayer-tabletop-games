import { useSyncExternalStore } from 'react';
import { lengthOf } from '../options.ts';
import { ROAD, isStop, type Space } from '../road.ts';
import { money } from '../roadRules.ts';
import { BOARD_HEIGHT, BOARD_WIDTH, SPACE_RADIUS, roadLayout } from './roadLayout.ts';
import { tokenKey } from './animateMove.ts';
import type { PublicGameState, Seat } from '../types.ts';

const LABEL: Record<Space['kind'], string> = {
  start: 'Start', payday: 'Pay', job: 'Job', event: '', house: 'Home', family: 'Kin', risk: 'Risk',
  graduation: 'Grad', marriage: 'Wed', houseStop: 'Buy', retirement: 'Retire', fork: 'Fork'
};
const TITLE: Record<Space['kind'], string> = {
  start: 'Start', payday: 'Payday: collect your salary', job: 'Job: two careers are offered', event: 'Event',
  house: 'House: two houses are offered', family: 'Family: a partner, then a child', risk: 'Risk: spin to win or lose',
  graduation: 'Graduation: stop and pick a career', marriage: 'Wedding: stop here; a partner joins if you have none',
  houseStop: 'House stop: stop and look at houses', retirement: 'Retirement', fork: 'Fork: choose the safe road or the fast lane'
};

const label = (space: Space): string => (space.kind === 'event' ? (space.amount! > 0 ? 'Gain' : 'Loss') : LABEL[space.kind]);
const title = (space: Space): string => (space.kind === 'event' ? `${space.text} ${space.amount! > 0 ? '+' : ''}${money(space.amount!)}` : TITLE[space.kind]);

// Up to six tokens share a space, three above its middle and three below
const tokenOffset = (seat: Seat): { dx: number; dy: number } => ({ dx: (((seat - 1) % 3) - 1) * 8, dy: seat <= 3 ? -5 : 5 });

// A narrow window draws the road top to bottom
const NARROW = '(max-width: 719px)';
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const useNarrow = (): boolean => useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches, () => false);

// The winding road with a circle per space and every player's token; `highlight` outlines one space (the history's last move)
export default function RoadBoard({ gameState, highlight }: { gameState: PublicGameState; highlight: number | null }) {
  const vertical = useNarrow();
  const points = roadLayout(vertical);
  const [width, height] = vertical ? [BOARD_HEIGHT, BOARD_WIDTH] : [BOARD_WIDTH, BOARD_HEIGHT];
  const short = lengthOf(gameState) === 'short';
  const players = gameState.road?.players ?? {};

  return (
    <svg className="road-board" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="The road from start to retirement">
      <g className="road-lines">
        {ROAD.flatMap((space, i) => space.next.map(n => (
          <line key={`${i}-${n}`} x1={points[i].x} y1={points[i].y} x2={points[n].x} y2={points[n].y} />
        )))}
      </g>
      {ROAD.map((space, i) => {
        const classNames = ['space', `kind-${space.kind}`];
        if (space.kind === 'event') classNames.push(space.amount! > 0 ? 'gain' : 'loss');
        if (isStop(space.kind)) classNames.push('stop');
        if (short && space.fullOnly) classNames.push('skipped');
        if (i === highlight) classNames.push('highlight');
        return (
          <g key={i} className={classNames.join(' ')} data-space={i}>
            <title>{short && space.fullOnly ? `${title(space)} (skipped in the short game)` : title(space)}</title>
            <circle cx={points[i].x} cy={points[i].y} r={SPACE_RADIUS} />
            <text x={points[i].x} y={points[i].y} dy="0.35em">{label(space)}</text>
          </g>
        );
      })}
      {Object.entries(players).map(([key, player]) => {
        const seat = Number(key);
        const { dx, dy } = tokenOffset(seat);
        const at = points[player.space];
        return (
          <g key={seat} className={`token seat${seat}`} data-anim-key={tokenKey(seat)}>
            <title>{gameState.playerNames[seat]}</title>
            <circle cx={at.x + dx} cy={at.y + dy} r={5} />
          </g>
        );
      })}
    </svg>
  );
}
