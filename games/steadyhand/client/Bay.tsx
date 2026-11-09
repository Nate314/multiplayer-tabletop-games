import type { PointerEvent } from 'react';
import { pointsText } from '../../../shared/standings.ts';
import { BAY_HEIGHT, BAY_WIDTH, EXIT_RADIUS, PARTS } from '../board.ts';
import PartArt from './PartArt';
import type { GameState, Point } from '../types.ts';

// The part in someone's hand and where to draw it; a watched part glides between streamed positions
export type Held = { part: number; at: Point; watched: boolean };

type BayProps = {
  gameState: Pick<GameState, 'outBy' | 'playerNames'>;
  factor: number; // the wall tolerance on each slot's width
  held: Held | null;
  highlight?: number | null;
  buzzAt?: Point | null;
  interactive?: boolean;
  shaking?: boolean;
  onPointerDown?: (event: PointerEvent<SVGSVGElement>) => void;
  onShaken?: () => void;
};

const points = (path: Point[]) => path.map(p => p.join(',')).join(' ');

// The repair bay: every slot at its width times the tolerance, each part at rest or where it is held, and a tray of parts already out
export default function Bay({ gameState, factor, held, highlight = null, buzzAt = null, interactive = false, shaking = false, onPointerDown, onShaken }: BayProps) {
  const { outBy, playerNames } = gameState;
  const out = PARTS.filter(p => outBy[p.id] !== undefined);
  const classes = ['sh-bay', interactive && 'sh-bay-interactive', shaking && 'sh-shake'].filter(Boolean).join(' ');
  return (
    <div className="sh-bay-wrap">
      <svg className={classes} viewBox={`0 0 ${BAY_WIDTH} ${BAY_HEIGHT}`} role="img" aria-label="Repair bay"
        onPointerDown={onPointerDown} onAnimationEnd={onShaken}>
        <rect className="sh-floor" width={BAY_WIDTH} height={BAY_HEIGHT} rx={16} />
        {PARTS.map(part => {
          const isOut = outBy[part.id] !== undefined;
          const exit = part.path[part.path.length - 1];
          return (
            <g key={part.id} className={isOut ? 'sh-slot sh-slot-empty' : 'sh-slot'}>
              <polyline className="sh-slot-wall" points={points(part.path)} strokeWidth={part.width * factor} />
              <polyline className="sh-slot-floor" points={points(part.path)} strokeWidth={part.width * factor - 6} />
              <circle className="sh-exit" cx={exit[0]} cy={exit[1]} r={EXIT_RADIUS} />
              {!isOut && <text className="sh-value" x={part.path[0][0]} y={part.path[0][1] + 34}>{part.value}</text>}
            </g>
          );
        })}
        {PARTS.filter(p => outBy[p.id] === undefined).map(part => {
          const holding = held?.part === part.id ? held : null;
          const className = ['sh-part', holding?.watched && 'sh-part-watched', highlight === part.id && 'sh-part-highlight'].filter(Boolean).join(' ');
          return <PartArt key={part.id} part={part} at={holding?.at ?? part.path[0]} className={className} />;
        })}
        {buzzAt && <path className="sh-buzz-mark" d={`M${buzzAt[0] - 12} ${buzzAt[1] - 12}l24 24m0 -24l-24 24`} />}
      </svg>
      <div className="sh-tray">
        <div className="sh-tray-heading">Out of the bay</div>
        {out.length === 0 ? <p className="sh-empty">No parts yet</p> : (
          <ul>
            {out.map(part => (
              <li key={part.id} className={highlight === part.id ? 'sh-tray-part sh-part-highlight' : 'sh-tray-part'}>
                <svg viewBox="-12 -12 24 24" aria-hidden="true"><PartArt part={part} at={[0, 0]} /></svg>
                <span>{part.name}, {pointsText(part.value)}, {playerNames[outBy[part.id]!]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
