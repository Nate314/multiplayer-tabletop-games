import YouTag from '../../../src/components/YouTag.tsx';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { COLOR_NAMES } from '../rules.ts';
import type { Color, PublicGameState, Seat } from '../types.ts';
import { SYMBOLS } from './draw.ts';

const COLORS: Color[] = [0, 1, 2, 3];

// Each color's owner and score, then each seat's total; the shared color scores for nobody
export default function Scores({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { owners, colorScores, scores, playerNames, activePlayers, out, turnColor, isGameOver } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);
  return (
    <>
      <ul className="corners-colors">
        {COLORS.map(color => {
          const owner = owners[color];
          const classes = ['corners-color-row'];
          if (color === turnColor && !isGameOver) classes.push('to-move');
          if (out.includes(color)) classes.push('corners-out');
          return (
            <li key={color} className={classes.join(' ')}>
              <span className={`corners-swatch corners-fill corners-c${color}`} aria-hidden="true">
                <ColorSymbol color={SYMBOLS[color]} className="corners-swatch-symbol" />
              </span>
              <span className="corners-color-name">
                {COLOR_NAMES[color]}: {owner === 'shared' ? 'shared' : playerNames[owner]}
                {owner !== 'shared' && <YouTag when={owner === viewer} />}
                {out.includes(color) && ' (out)'}
              </span>
              <span className="corners-score">{colorScores[color]}</span>
            </li>
          );
        })}
      </ul>
      <div className="corners-totals">
        Scores:{' '}
        {seats.map((seat, index) => (
          <span key={seat} className={activePlayers.includes(seat) ? '' : 'player-left'}>
            {index > 0 && ' · '}
            {playerNames[seat]} {scores[seat] ?? 0}
            {!activePlayers.includes(seat) && ' (left)'}
          </span>
        ))}
      </div>
    </>
  );
}
