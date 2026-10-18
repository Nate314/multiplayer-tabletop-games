import { diceToPlay } from '../rules.ts';

// Which of the nine cells of a die face hold a pip, for each value
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

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
        <div key={index} className={`bg-die${used ? ' used' : ''}`} aria-label={`${value}${used ? ' (used)' : ''}`}>
          {Array.from({ length: 9 }, (_, cell) => (
            <span key={cell} className={PIPS[value].includes(cell) ? 'bg-pip' : ''} />
          ))}
        </div>
      ))}
    </div>
  );
}
