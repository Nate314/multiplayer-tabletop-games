// Pip positions on a 3 by 3 grid, numbered 0-8 from the top left
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export default function Dice({ dice }: { dice: [number, number] | null }) {
  if (!dice) return null;
  return (
    <div className="dice" role="img" aria-label={`Last roll: ${dice[0]} and ${dice[1]}`}>
      {dice.map((value, index) => (
        <div key={index} className="die">
          {Array.from({ length: 9 }, (_, spot) => <span key={spot} className={PIPS[value]?.includes(spot) ? 'pip' : ''} />)}
        </div>
      ))}
    </div>
  );
}
