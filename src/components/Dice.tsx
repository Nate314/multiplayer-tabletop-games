// Pip positions on a 3 by 3 grid, numbered 0-8 from the top left
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

type DiceProps = {
  values: number[];
  selected?: boolean[]; // which dice are picked, e.g. held
  // Given only when the player can pick dice; without it the dice are not buttons
  onToggle?: (index: number) => void;
  disabled?: boolean;
  label: string;
  animKeyPrefix?: string; // for move animations: each die gets `${animKeyPrefix}-${index}`
};

// A row of six-sided dice, shared by the games that roll them
export default function Dice({ values, selected = [], onToggle, disabled = false, label, animKeyPrefix }: DiceProps) {
  return (
    <div className="dice-row" role="group" aria-label={label}>
      {values.map((value, index) => {
        const props = {
          className: selected[index] ? 'dice-die dice-die-selected' : 'dice-die',
          'data-anim-key': animKeyPrefix ? `${animKeyPrefix}-${index}` : undefined,
        };
        const pips = Array.from({ length: 9 }, (_, spot) => <span key={spot} className={PIPS[value]?.includes(spot) ? 'dice-pip' : ''} />);
        return onToggle ? (
          <button key={index} {...props} type="button" aria-pressed={Boolean(selected[index])} aria-label={`die ${index + 1}: ${value}`} disabled={disabled} onClick={() => onToggle(index)}>{pips}</button>
        ) : (
          <span key={index} {...props} role="img" aria-label={`die ${index + 1}: ${value}`}>{pips}</span>
        );
      })}
    </div>
  );
}
