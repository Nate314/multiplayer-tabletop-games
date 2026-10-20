import { Die } from '../../../src/components/Dice';
import { diceToPlay } from '../rules.ts';

// This turn's dice, a double shown four times, with the used ones faded
export default function Dice({ dice, remaining }: { dice: number[]; remaining: number[] }) {
  const unused = [...remaining];
  const faces = diceToPlay(dice).map(value => {
    const index = unused.indexOf(value);
    if (index >= 0) unused.splice(index, 1);
    return { value, used: index < 0 };
  });

  return (
    <div className="bg-dice">
      {faces.map(({ value, used }, index) => (
        <Die key={index} value={value} className={`bg-die${used ? ' used' : ''}`} label={`${value}${used ? ' (used)' : ''}`} />
      ))}
    </div>
  );
}
