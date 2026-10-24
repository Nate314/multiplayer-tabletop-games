import { Die } from '../../../src/components/Dice';

export default function Dice({ dice }: { dice: [number, number] | null }) {
  if (!dice) return null;
  return (
    <div className="dice" role="img" aria-label={`Last roll: ${dice[0]} and ${dice[1]}`}>
      {dice.map((value, index) => <Die key={index} value={value} className="die" />)}
    </div>
  );
}
