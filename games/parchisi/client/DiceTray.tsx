import { Fragment } from 'react';
import { Die } from '../../../src/components/Dice';
import type { PublicGameState } from '../types.ts';

const ROLLED_DICE = 2; // any dice after these are the faces underneath doubles

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
              <Die
                value={die.value}
                className={['die', underneath ? 'underneath' : '', die.used ? 'used' : ''].join(' ')}
                label={`${die.value}${underneath ? ', underneath' : ''}${die.used ? ', used' : ''}`}
                title={`${underneath ? 'Face underneath, ' : ''}${die.used ? 'used' : 'not used yet'}`}
              />
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
