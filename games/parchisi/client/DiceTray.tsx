import { Fragment } from 'react';
import type { PublicGameState } from '../types.ts';

const ROLLED_DICE = 2; // any dice after these are the faces underneath doubles

// Pip positions on a 3 by 3 grid, numbered 0-8 from the top left
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export default function DiceTray({ gameState }: { gameState: PublicGameState }) {
  const { dice, bonuses, roller, playerNames } = gameState;
  if (dice.length === 0 || roller === null) return null;

  return (
    <div className="dice-tray">
      <div className="panel-title">{playerNames[roller]}'s roll</div>
      <div className="dice">
        {dice.map((die, index) => {
          const underneath = index >= ROLLED_DICE;
          return (
            <Fragment key={index}>
              {index === ROLLED_DICE && <span className="dice-note">underneath</span>}
              <div
                className={['die', underneath ? 'underneath' : '', die.used ? 'used' : ''].join(' ')}
                role="img"
                aria-label={`${die.value}${underneath ? ', underneath' : ''}${die.used ? ', used' : ''}`}
                title={`${underneath ? 'Face underneath, ' : ''}${die.used ? 'used' : 'not used yet'}`}
              >
                {Array.from({ length: 9 }, (_, spot) => (
                  <span key={spot} className={PIPS[die.value].includes(spot) ? 'pip' : ''} />
                ))}
              </div>
            </Fragment>
          );
        })}
        {bonuses.map((bonus, index) => (
          <div key={`bonus-${index}`} className="bonus" title="Bonus move for one pawn">+{bonus}</div>
        ))}
      </div>
    </div>
  );
}
